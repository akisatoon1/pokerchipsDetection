// 指定した画像のチップの数を検出する.
// 輝度プロファイル法: ユーザが囲んだスタック領域を1次元信号に射影し,
// チップの合わせ目(影)の周期を数えて枚数を推定する.

#include <iostream>
#include <opencv2/opencv.hpp>
#include <optional>
#include <string>
#include <vector>

// ---- パラメータ ----------------------------------------------------------

// プロファイルの平滑化に使うガウシアンの標準偏差(ピクセル).
// 小さすぎるとノイズを拾い, 大きすぎると合わせ目が潰れる.
const double kSmoothSigma = 2.0;

// 自己相関で探索するチップ1枚あたりの高さの範囲(ピクセル).
const int kMinPeriod = 4;
const int kMaxPeriod = 200;

// ピーク検出時, 隣接ピークとして許す最小間隔を周期の何割にするか.
const double kMinDistanceRatio = 0.6;

// ピークの顕著さ(prominence)のしきい値. 信号の標準偏差に対する比.
const double kProminenceRatio = 0.3;

// ---- 入力 ----------------------------------------------------------------

std::optional<std::string> getFilepathFromArgs(int argc, char *argv[])
{
    if (argc != 2)
    {
        std::cerr << "Usage: " << argv[0] << " <image_file_path>" << std::endl;
        return std::nullopt;
    }

    return std::string(argv[1]);
}

cv::Rect selectRoiScaled(const cv::Mat &img, const std::string &win, int maxSide = 900)
{
    double s = std::min(1.0, double(maxSide) / std::max(img.cols, img.rows));

    cv::Mat disp;
    cv::resize(img, disp, cv::Size(), s, s, cv::INTER_AREA);

    cv::Rect r = cv::selectROI(win, disp, false, false);
    cv::destroyWindow(win);
    if (r.width <= 0 || r.height <= 0)
        return cv::Rect();

    cv::Rect roi(cvRound(r.x / s), cvRound(r.y / s),
                 cvRound(r.width / s), cvRound(r.height / s));
    return roi & cv::Rect(0, 0, img.cols, img.rows);
}

// ---- 1. 射影: 2次元画像を1次元プロファイルへ -----------------------------

// ROIの各行について横方向のSobel縦勾配の絶対値を平均し, 高さ方向の1次元信号を作る.
// 生の輝度ではなくSobel勾配を使うのは, チップ表面の模様や全体的な明るさの変化に
// 影響されず「明るさが急変する場所 = 合わせ目そのもの」を拾うため.
// 戻り値は合わせ目で山になる信号 (谷ではなく山であることに注意).
std::vector<double> computeGradientProfile(const cv::Mat &roi)
{
    cv::Mat gray;
    cv::cvtColor(roi, gray, cv::COLOR_BGR2GRAY);

    // 横方向に軽くぼかして, チップ表面の模様(赤白の柄)を均す.
    cv::GaussianBlur(gray, gray, cv::Size(0, 0), 3.0, 0.5);

    // y方向の1次微分. 合わせ目は水平な暗い線なので縦勾配が大きくなる.
    cv::Mat sobelY;
    cv::Sobel(gray, sobelY, CV_32F, 0, 1, 3);
    sobelY = cv::abs(sobelY);

    // 各行を横方向に平均して1次元に潰す(integral projection).
    cv::Mat rowMean;
    cv::reduce(sobelY, rowMean, 1, cv::REDUCE_AVG, CV_32F);

    std::vector<double> profile(rowMean.rows);
    for (int i = 0; i < rowMean.rows; ++i)
        profile[i] = rowMean.at<float>(i, 0);

    return profile;
}

// ---- 2. 前処理: 平滑化とトレンド除去 -------------------------------------

std::vector<double> smoothProfile(const std::vector<double> &profile, double sigma)
{
    cv::Mat src(int(profile.size()), 1, CV_64F);
    for (size_t i = 0; i < profile.size(); ++i)
        src.at<double>(int(i), 0) = profile[i];

    cv::Mat dst;
    cv::GaussianBlur(src, dst, cv::Size(1, 0), 0, sigma);

    std::vector<double> out(profile.size());
    for (size_t i = 0; i < profile.size(); ++i)
        out[i] = dst.at<double>(int(i), 0);

    return out;
}

// 大きなσでぼかした信号を「ゆるやかな明るさの傾き」とみなして差し引く.
// これで照明ムラや上下の明暗差を消し, 周期成分だけを残す.
std::vector<double> removeTrend(const std::vector<double> &profile, double sigma)
{
    std::vector<double> trend = smoothProfile(profile, sigma);

    std::vector<double> out(profile.size());
    for (size_t i = 0; i < profile.size(); ++i)
        out[i] = profile[i] - trend[i];

    return out;
}

// ---- 3. 自己相関による基本周期(チップ1枚の高さ)の推定 -------------------

// ラグをずらしながら相関を取り, 最も相関の高いラグを周期とする.
// 影が薄くて合わせ目を数個見逃しても, この大域的な周期で補正が効く.
std::optional<double> estimatePeriod(const std::vector<double> &signal)
{
    int n = int(signal.size());
    int maxLag = std::min(kMaxPeriod, n / 2);
    if (maxLag < kMinPeriod)
        return std::nullopt;

    double mean = 0.0;
    for (double v : signal)
        mean += v;
    mean /= n;

    std::vector<double> centered(n);
    for (int i = 0; i < n; ++i)
        centered[i] = signal[i] - mean;

    double bestScore = -1.0;
    int bestLag = -1;

    for (int lag = kMinPeriod; lag <= maxLag; ++lag)
    {
        double dot = 0.0, normA = 0.0, normB = 0.0;
        for (int i = 0; i + lag < n; ++i)
        {
            dot += centered[i] * centered[i + lag];
            normA += centered[i] * centered[i];
            normB += centered[i + lag] * centered[i + lag];
        }
        if (normA <= 0.0 || normB <= 0.0)
            continue;

        double score = dot / std::sqrt(normA * normB);
        if (score > bestScore)
        {
            bestScore = score;
            bestLag = lag;
        }
    }

    if (bestLag < 0 || bestScore <= 0.0)
        return std::nullopt;

    std::cout << "autocorrelation: period = " << bestLag
              << " px, score = " << bestScore << std::endl;

    return double(bestLag);
}

// ---- 4. ピーク検出 -------------------------------------------------------

// あるピークの顕著さ(prominence). ピークから左右に下っていき,
// より高い峰にぶつかるまでの間の最も低い谷との高低差を返す.
// 単なるしきい値と違い, 大きな山の肩にできた小さな凹凸を排除できる.
double computeProminence(const std::vector<double> &signal, int peak)
{
    int n = int(signal.size());
    double peakValue = signal[peak];

    double leftMin = peakValue;
    for (int i = peak - 1; i >= 0; --i)
    {
        if (signal[i] > peakValue)
            break;
        leftMin = std::min(leftMin, signal[i]);
    }

    double rightMin = peakValue;
    for (int i = peak + 1; i < n; ++i)
    {
        if (signal[i] > peakValue)
            break;
        rightMin = std::min(rightMin, signal[i]);
    }

    return peakValue - std::max(leftMin, rightMin);
}

// 極大点のうち, 顕著さが十分で, かつ互いに minDistance 以上離れたものを返す.
// 値の大きい順に採用していくので, 近接した候補では強い方が残る.
std::vector<int> findPeaks(const std::vector<double> &signal,
                           int minDistance, double minProminence)
{
    int n = int(signal.size());

    std::vector<int> candidates;
    for (int i = 1; i < n - 1; ++i)
    {
        if (signal[i] >= signal[i - 1] && signal[i] > signal[i + 1])
        {
            if (computeProminence(signal, i) >= minProminence)
                candidates.push_back(i);
        }
    }

    std::sort(candidates.begin(), candidates.end(),
              [&signal](int a, int b)
              { return signal[a] > signal[b]; });

    std::vector<int> peaks;
    for (int c : candidates)
    {
        bool tooClose = false;
        for (int p : peaks)
        {
            if (std::abs(c - p) < minDistance)
            {
                tooClose = true;
                break;
            }
        }
        if (!tooClose)
            peaks.push_back(c);
    }

    std::sort(peaks.begin(), peaks.end());
    return peaks;
}

double standardDeviation(const std::vector<double> &v)
{
    if (v.empty())
        return 0.0;

    double mean = 0.0;
    for (double x : v)
        mean += x;
    mean /= double(v.size());

    double var = 0.0;
    for (double x : v)
        var += (x - mean) * (x - mean);

    return std::sqrt(var / double(v.size()));
}

// ---- 5. 可視化 -----------------------------------------------------------

// ROIの右隣にプロファイルのグラフを並べ, 検出したピークを横線で描く.
cv::Mat renderDebugView(const cv::Mat &roi, const std::vector<double> &signal,
                        const std::vector<int> &peaks)
{
    const int graphWidth = 300;
    int h = roi.rows;

    cv::Mat roiView;
    cv::cvtColor(roi, roiView, cv::COLOR_BGR2BGRA);
    cv::cvtColor(roiView, roiView, cv::COLOR_BGRA2BGR);

    cv::Mat graph(h, graphWidth, CV_8UC3, cv::Scalar(30, 30, 30));

    double lo = *std::min_element(signal.begin(), signal.end());
    double hi = *std::max_element(signal.begin(), signal.end());
    double range = std::max(hi - lo, 1e-9);

    // 信号を折れ線で描く. 縦がROIの高さ, 横が信号の値.
    for (int y = 1; y < h && y < int(signal.size()); ++y)
    {
        int x0 = cvRound((signal[y - 1] - lo) / range * (graphWidth - 1));
        int x1 = cvRound((signal[y] - lo) / range * (graphWidth - 1));
        cv::line(graph, cv::Point(x0, y - 1), cv::Point(x1, y),
                 cv::Scalar(200, 220, 200), 1);
    }

    for (int p : peaks)
    {
        cv::line(graph, cv::Point(0, p), cv::Point(graphWidth - 1, p),
                 cv::Scalar(0, 160, 255), 1);
        cv::line(roiView, cv::Point(0, p), cv::Point(roiView.cols - 1, p),
                 cv::Scalar(0, 160, 255), 1);
    }

    cv::Mat combined;
    cv::hconcat(roiView, graph, combined);

    // 画面に収まるよう縮小.
    double s = std::min(1.0, 900.0 / combined.rows);
    if (s < 1.0)
        cv::resize(combined, combined, cv::Size(), s, s, cv::INTER_AREA);

    return combined;
}

// ---- 本体 ---------------------------------------------------------------

void countChips(const std::string &filepath)
{
    cv::Mat img = cv::imread(filepath);
    if (img.empty())
    {
        std::cerr << "Error: Could not open or find the image." << std::endl;
        return;
    }

    cv::Rect regionOfChipStack = selectRoiScaled(img, "Select ROI");
    if (regionOfChipStack.empty())
    {
        std::cerr << "Error: ROI was not selected." << std::endl;
        return;
    }
    std::cout << "Selected ROI: " << regionOfChipStack << std::endl;

    cv::Mat roi = img(regionOfChipStack);

    // 射影 -> 平滑化 -> トレンド除去.
    // 合わせ目で山になる信号が得られる.
    std::vector<double> raw = computeGradientProfile(roi);
    std::vector<double> signal = smoothProfile(raw, kSmoothSigma);

    // トレンド除去のσは周期より十分大きく取りたいが, 周期はまだ未知なので
    // 一度粗く推定してから決める.
    std::optional<double> roughPeriod = estimatePeriod(signal);
    if (roughPeriod.has_value())
        signal = removeTrend(signal, roughPeriod.value() * 2.0);

    std::optional<double> period = estimatePeriod(signal);
    if (!period.has_value())
    {
        std::cerr << "Error: Failed to estimate chip period. "
                  << "ROI may be too small or lack visible seams." << std::endl;
        return;
    }

    int minDistance = std::max(1, int(period.value() * kMinDistanceRatio));
    double minProminence = standardDeviation(signal) * kProminenceRatio;
    std::vector<int> peaks = findPeaks(signal, minDistance, minProminence);

    // 数え方1: 検出した合わせ目の「間隔」から数える (推奨).
    //
    // 合わせ目はチップとチップの境界にできるので, 最初のピークから最後のピークまでの
    // 区間にはちょうど (peaks-1) 枚ぶんのチップが挟まっている. さらにその上下には
    // 端のチップが1枚ずつあるので, 合計 (peaks-1) + 2 = peaks + 1 枚.
    //
    // 重要なのは, この数え方が ROI の上端・下端の位置に依存しないこと.
    // ROI を多少大きめに囲んでも, 使うのは検出されたピークの位置だけなので
    // 余白のぶんだけ過大に数える, ということが起きない.
    //
    // ただし注意点があり, スタックの最上面・最下面の「縁」も背景との境界として
    // 強い勾配を作るため, 合わせ目と区別がつかずピークとして検出されてしまう.
    // これを合わせ目として数えると端のチップを二重に数えることになる.
    //
    // 見分け方: 内側の合わせ目は必ず両隣とチップ1枚ぶん(周期)の間隔で並ぶ.
    // 一方スタックの縁は, その外側にもう合わせ目が無いので「外側に周期ぶんの
    // 余白があるか」で判定できる. 端のピークの外側の余白が半周期に満たなければ,
    // それはチップの中身ではなくスタックの縁とみなして除外する.
    int countByPeaks = 0;
    if (peaks.size() >= 2)
    {
        double p = period.value();
        int first = peaks.front();
        int last = peaks.back();

        // 端のピークの外側に, チップ1枚ぶんの実体が残っているか.
        bool topIsEdge = double(first) < p * 0.5;
        bool bottomIsEdge = double(roi.rows - 1 - last) < p * 0.5;

        // 合わせ目とみなせるピークの数.
        int seams = int(peaks.size()) - (topIsEdge ? 1 : 0) - (bottomIsEdge ? 1 : 0);

        // 内側の合わせ目 n 個 -> チップ n+1 枚.
        countByPeaks = seams + 1;

        double spacing = double(last - first) / double(peaks.size() - 1);
        std::cout << "peak spacing = " << spacing << " px "
                  << "(period = " << p << " px)" << std::endl;
        std::cout << "edge peak excluded: top = " << (topIsEdge ? "yes" : "no")
                  << ", bottom = " << (bottomIsEdge ? "yes" : "no") << std::endl;
    }

    // 数え方2: スタック全体の高さを周期で割る.
    // 谷を数個見逃しても大域的な周期で補正が効くので, 合わせ目が薄い場合に強い.
    // ただし ROI にスタック以外の余白が入るとその分だけ過大になるため,
    // ROI はスタックの上端・下端にできるだけ密着させて囲むこと.
    int countByPeriod = int(std::lround(roi.rows / period.value()));

    std::cout << "profile length = " << signal.size() << " px" << std::endl;
    std::cout << "detected seams = " << peaks.size() << std::endl;
    std::cout << "count by peaks  = " << countByPeaks << std::endl;
    std::cout << "count by period = " << countByPeriod << std::endl;
    std::cout << "chip count = " << countByPeaks << std::endl;

    cv::Mat debug = renderDebugView(roi, signal, peaks);
    cv::imshow("Profile", debug);
    std::cout << "Press any key on the window to exit." << std::endl;
    cv::waitKey(0);
    cv::destroyAllWindows();
}

int main(int argc, char *argv[])
{
    std::optional<std::string> filepath = getFilepathFromArgs(argc, argv);
    if (!filepath.has_value())
    {
        return 1;
    }
    countChips(filepath.value());
    return 0;
}

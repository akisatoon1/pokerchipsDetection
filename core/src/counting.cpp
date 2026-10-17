#include "pokerchip/counting.hpp"

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <opencv2/imgproc.hpp>

namespace {

// ---- パラメータ ----------------------------------------------------------

/**
 * @brief プロファイルの平滑化に使うガウシアンの標準偏差(ピクセル).
 *
 * 小さすぎるとノイズを拾い, 大きすぎると合わせ目が潰れる.
 */
const double kSmoothSigma = 2.0;

/**
 * @brief 周期とみなす自己相関の山の高さの下限. 最も高い山に対する比.
 *
 * 周期の整数倍のラグにも同じくらいの高さの山ができ,
 * 最も高い山を選ぶと周期の2倍を選ぶことがある (IMG_5723).
 * この比以上の山のうちラグが最小のものを周期にする.
 * テスト画像では 0.5〜0.9 で結果が変わらなかったので, 間の値にした.
 */
const double kPeriodPeakRatio = 0.8;

//! ピーク検出時, 隣接ピークとして許す最小間隔を周期の何割にするか.
const double kMinDistanceRatio = 0.6;

//! ピークの顕著さ(prominence)のしきい値. 信号の標準偏差に対する比.
const double kMinProminenceRatio = 0.3;

// ---- 内部処理 ------------------------------------------------------------

/**
 * @brief 縦方向の輝度変化の大きさを, 行ごとの1次元のデータにする.
 *
 * グレースケール化して縦方向の微分の大きさを計算し,
 * 各行を平均して1次元のデータに変換する. チップは縦に積まれていて,
 * チップの境界は溝があって暗いので,
 * チップ境界を縦に微分すると絶対値が大きくなると考えられるから.
 * @param roi スタック領域の画像 (BGR).
 * @return 各行の縦方向の微分の絶対値の平均. 長さは roi の行数.
 */
std::vector<double> convertToBrightnessDiff(const cv::Mat &roi) {
  cv::Mat gray;
  cv::cvtColor(roi, gray, cv::COLOR_BGR2GRAY);

  // 横方向にぼかす. 意味があるかどうかは不明.
  cv::GaussianBlur(gray, gray, cv::Size(0, 0), 3.0, 0.5);

  // 縦にのみ微分する.
  cv::Mat sobelY;
  cv::Sobel(gray, sobelY, CV_32F, 0, 1, 3);
  sobelY = cv::abs(sobelY);

  // 各行を横方向に平均して1次元に潰す.
  cv::Mat rowMean;
  cv::reduce(sobelY, rowMean, 1, cv::REDUCE_AVG, CV_32F);

  std::vector<double> profile(rowMean.rows);
  for (int i = 0; i < rowMean.rows; ++i) profile[i] = rowMean.at<float>(i, 0);

  return profile;
}

/**
 * @brief 1次元のデータをガウシアンで平滑化する.
 *
 * この関数は[明るさの差が要素であるベクトル]の平滑化に使われる.
 * 平滑化に意味があるかどうかは不明.
 * @param profile 平滑化するデータ.
 * @param sigma ガウシアンの標準偏差 (要素数).
 * @return 平滑化したデータ. 長さは profile と同じ.
 */
std::vector<double> smoothProfile(const std::vector<double> &profile,
                                  double sigma) {
  cv::Mat src(static_cast<int>(profile.size()), 1, CV_64F);
  for (size_t i = 0; i < profile.size(); ++i) {
    src.at<double>(static_cast<int>(i), 0) = profile[i];
  }

  cv::Mat dst;
  cv::GaussianBlur(src, dst, cv::Size(1, 0), 0, sigma);

  std::vector<double> out(profile.size());
  for (size_t i = 0; i < profile.size(); ++i) {
    out[i] = dst.at<double>(static_cast<int>(i), 0);
  }

  return out;
}

/**
 * @brief 信号の自己相関 (相関係数) をラグ 0 から maxLag まで計算する.
 * @param signal 信号.
 * @param maxLag 計算するラグの上限 (要素数). signal の長さ未満にする.
 * @return 各ラグの相関係数. 長さは maxLag + 1.
 *         分散が 0 になるラグは 0.
 */
std::vector<double> autocorrelation(const std::vector<double> &signal,
                                    int maxLag) {
  // 相関係数を計算するために各要素から平均を引く必要があるらしい.
  // それが本当かどうかは知らない.
  int n = static_cast<int>(signal.size());
  double mean = 0.0;
  for (double v : signal) mean += v;
  mean /= n;

  std::vector<double> centered(n);
  for (int i = 0; i < n; ++i) centered[i] = signal[i] - mean;

  std::vector<double> acf(maxLag + 1, 0.0);
  for (int lag = 0; lag <= maxLag; ++lag) {
    double dot = 0.0, normA = 0.0, normB = 0.0;
    for (int i = 0; i + lag < n; ++i) {
      dot += centered[i] * centered[i + lag];
      normA += centered[i] * centered[i];
      normB += centered[i + lag] * centered[i + lag];
    }
    if (normA <= 0.0 || normB <= 0.0) continue;

    acf[lag] = dot / std::sqrt(normA * normB);
  }

  return acf;
}

/**
 * @brief 自己相関の山から信号の周期を推定する.
 *
 * 信号の周期を推定して正しいピークを見つけられるようにするため.
 * 周期が分かれば大まかにピークの位置が分かり,
 * チップの境界ではないピークの誤検出を減らせるかもしれない.
 *
 * 自己相関はラグ 0 で 1 になり, 平滑化のため小さいラグでも高い.
 * 単に最大のラグを選ぶとこの裾を選んでしまう (IMG_5721, 5731, 5732)
 * ので, 自己相関が初めて 0 以下になったより後の山だけを候補にする.
 * また周期の整数倍のラグにも山ができるので,
 * 最も高い山の kPeriodPeakRatio 倍以上の山のうちラグが最小のものを選ぶ.
 * @param signal 周期を推定する信号.
 * @return 推定した周期 (要素数). 信号が短すぎる場合や,
 *         正の相関を持つ山がない場合は nullopt.
 */
std::optional<double> estimatePeriod(const std::vector<double> &signal) {
  // ラグが大きすぎると自己相関を計算する範囲が狭くなり,
  // 自己相関の信頼性が低くなるため, ラグの上限を信号の半分にする.
  int n = static_cast<int>(signal.size());
  int maxLag = n / 2;
  if (maxLag < 2) return std::nullopt;

  std::vector<double> acf = autocorrelation(signal, maxLag);

  // ラグ 0 の山を飛ばす.
  int start = 1;
  while (start <= maxLag && acf[start] > 0.0) ++start;

  // 正の相関を持つ山 (極大) を集める.
  std::vector<int> peakLags;
  double highest = 0.0;
  for (int lag = start; lag < maxLag; ++lag) {
    if (acf[lag] > 0.0 && acf[lag] >= acf[lag - 1] && acf[lag] > acf[lag + 1]) {
      peakLags.push_back(lag);
      highest = std::max(highest, acf[lag]);
    }
  }
  if (peakLags.empty()) return std::nullopt;

  for (int lag : peakLags) {
    if (acf[lag] >= highest * kPeriodPeakRatio) {
      return static_cast<double>(lag);
    }
  }

  return std::nullopt;
}

/**
 * @brief ピークの顕著さ (prominence) を計算する.
 *
 * この関数はピーク検出のために使われる.
 * 顕著さがの処理が必要かどうかは確かめていないので不明.
 * 自身の点より高い点(峰)がでてくるまで進んで,
 * その間の最小値(谷)を左右に対して2回求める.
 * 自身の点と谷の差を顕著さとしている.
 * 山のような周りの高さが高いとこでちょっとしたノイズでできた極大値をピークとして扱わないようにするため
 * だと考えられる.
 * @param signal 信号.
 * @param peak 顕著さを求める点の位置.
 * @return 顕著さ. 0 以上.
 */
double computeProminence(const std::vector<double> &signal, int peak) {
  int n = static_cast<int>(signal.size());
  double peakValue = signal[peak];

  double leftMin = peakValue;
  for (int i = peak - 1; i >= 0; --i) {
    if (signal[i] > peakValue) break;
    leftMin = std::min(leftMin, signal[i]);
  }

  double rightMin = peakValue;
  for (int i = peak + 1; i < n; ++i) {
    if (signal[i] > peakValue) break;
    rightMin = std::min(rightMin, signal[i]);
  }

  return peakValue - std::max(leftMin, rightMin);
}

/**
 * @brief 信号の極大値のうち, 条件を満たすものをピークとして返す.
 *
 * チップの境界にピークが来ると考えられるから.
 * 高いピークから順に採用し, 採用済みのピークに近すぎるものは捨てる.
 * @param signal 信号.
 * @param minDistance ピーク同士の最小間隔 (要素数).
 * @param minProminence ピークとみなす顕著さの下限.
 * @return ピークの位置. 昇順に並ぶ. 信号の両端はピークにならない.
 */
std::vector<int> findPeaks(const std::vector<double> &signal, int minDistance,
                           double minProminence) {
  int n = static_cast<int>(signal.size());

  std::vector<int> candidates;
  for (int i = 1; i < n - 1; ++i) {
    if (signal[i] >= signal[i - 1] && signal[i] > signal[i + 1]) {
      if (computeProminence(signal, i) >= minProminence) {
        candidates.push_back(i);
      }
    }
  }

  std::sort(candidates.begin(), candidates.end(),
            [&signal](int a, int b) { return signal[a] > signal[b]; });

  std::vector<int> peaks;
  for (int c : candidates) {
    bool tooClose = false;
    for (int p : peaks) {
      if (std::abs(c - p) < minDistance) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) peaks.push_back(c);
  }

  std::sort(peaks.begin(), peaks.end());
  return peaks;
}

/**
 * @brief 信号の両端の近くや両端そのものもピークになりうるようにして,
 *        ピークを探す.
 *
 * YOLO の枠の端が最上段・最下段の境目のすぐ外にあると,
 * 信号が山を下りきる前に終わり, 顕著さが小さくなって山を捨ててしまう
 * (IMG_5727, 5582 で最下段を拾わなかった).
 * ROI の外は境目のない平らな背景とみなし, 両端に信号の最小値を足して探す.
 * @param signal 信号.
 * @param minDistance ピーク同士の最小間隔 (要素数).
 * @param minProminence ピークとみなす顕著さの下限.
 * @return ピークの位置 (signal の添字). 昇順に並ぶ.
 */
std::vector<int> findPeaksIncludingEdges(const std::vector<double> &signal,
                                         int minDistance,
                                         double minProminence) {
  if (signal.empty()) return {};

  double lowest = *std::min_element(signal.begin(), signal.end());
  std::vector<double> padded;
  padded.reserve(signal.size() + 2);
  padded.push_back(lowest);
  padded.insert(padded.end(), signal.begin(), signal.end());
  padded.push_back(lowest);

  // 足した値は最小値なのでピークにならない. 位置を元の信号に戻す.
  std::vector<int> peaks = findPeaks(padded, minDistance, minProminence);
  for (int &p : peaks) --p;

  return peaks;
}

/**
 * @brief 信号の標準偏差を計算する.
 *
 * ピークの顕著さのしきい値を決めるために使う.
 * @param v 信号.
 * @return 母標準偏差. v が空なら 0.
 */
double standardDeviation(const std::vector<double> &v) {
  if (v.empty()) return 0.0;

  double mean = 0.0;
  for (double x : v) mean += x;
  mean /= static_cast<double>(v.size());

  double var = 0.0;
  for (double x : v) var += (x - mean) * (x - mean);

  return std::sqrt(var / static_cast<double>(v.size()));
}

}  // namespace

std::optional<CountResult> countChips(const cv::Mat &roi) {
  // 射影 -> 平滑化.
  // 合わせ目で山になる信号が得られる.
  std::vector<double> raw = convertToBrightnessDiff(roi);
  std::vector<double> signal = smoothProfile(raw, kSmoothSigma);

  std::optional<double> period = estimatePeriod(signal);
  if (!period.has_value()) return std::nullopt;

  int minDistance =
      std::max(1, static_cast<int>(period.value() * kMinDistanceRatio));
  double minProminence = standardDeviation(signal) * kMinProminenceRatio;
  std::vector<int> peaks =
      findPeaksIncludingEdges(signal, minDistance, minProminence);

  if (peaks.size() < 2) return std::nullopt;

  CountResult result;
  result.count = static_cast<int>(peaks.size()) - 1;
  result.signal = signal;
  result.peaks = peaks;
  result.period = period.value();

  return result;
}

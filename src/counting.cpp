#include "counting.hpp"

namespace {

// ---- パラメータ ----------------------------------------------------------

// プロファイルの平滑化に使うガウシアンの標準偏差(ピクセル).
// 小さすぎるとノイズを拾い, 大きすぎると合わせ目が潰れる.
const double kSmoothSigma = 2.0;

// 自己相関で探索するチップ1枚あたりの高さの範囲(ピクセル).
const int kMinChipThicknessPx = 4;
const int kMaxChipThicknessPx = 200;

// ピーク検出時, 隣接ピークとして許す最小間隔を周期の何割にするか.
const double kMinDistanceRatio = 0.6;

// ピークの顕著さ(prominence)のしきい値. 信号の標準偏差に対する比.
const double kMinProminenceRatio = 0.3;

// ---- 内部処理 ------------------------------------------------------------

// グレースケール化して縦方向の微分の大きさを計算し,
// 各行を平均して1次元のデータに変換する. チップは縦に積まれていて,
// チップの境界は溝があって暗いので,
// チップ境界を縦に微分すると絶対値が大きくなると考えられるから.
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

// この関数は[明るさの差が要素であるベクトル]の平滑化とトレンド除去に使われる.
// [明るさの差が要素であるベクトル]の平滑化に意味があるかどうかは不明.
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

// トレンド除去をすると信号の周期推定が行いやすくなるため.
std::vector<double> removeTrend(const std::vector<double> &profile,
                                double sigma) {
  std::vector<double> trend = smoothProfile(profile, sigma);

  std::vector<double> out(profile.size());
  for (size_t i = 0; i < profile.size(); ++i) out[i] = profile[i] - trend[i];

  return out;
}

// 信号の周期を推定して正しいピークを見つけられるようにするため.
// 周期が分かれば大まかにピークの位置が分かり,
// チップの境界ではないピークの誤検出を減らせるかもしれない.
std::optional<double> estimatePeriod(const std::vector<double> &signal) {
  // ラグが大きすぎると自己相関を計算する範囲が狭くなり,
  // 自己相関の信頼性が低くなるため, ラグの上限を設定する.
  // チップの高さが推定したい周期なので,
  // ラグの上限はチップの最大高さよりは小さくする.
  // ラグの上限がチップの最小高さより小さい場合は周期推定ができないので,
  // 失敗する.
  int n = static_cast<int>(signal.size());
  int maxLag = std::min(kMaxChipThicknessPx, n / 2);
  if (maxLag < kMinChipThicknessPx) return std::nullopt;

  // 相関係数を計算するために各要素から平均を引く必要があるらしい.
  // それが本当かどうかは知らない.
  double mean = 0.0;
  for (double v : signal) mean += v;
  mean /= n;

  std::vector<double> centered(n);
  for (int i = 0; i < n; ++i) centered[i] = signal[i] - mean;

  double bestScore = -1.0;
  int bestLag = -1;

  // もっとも相関の高いラグを見つける.
  // 周期の倍数のラグのときに相関が大きくなるため,
  // この方法では不十分である可能性があるが,
  // 今はうまくいってそうなのでこの方法で行う.
  for (int lag = kMinChipThicknessPx; lag <= maxLag; ++lag) {
    double dot = 0.0, normA = 0.0, normB = 0.0;
    for (int i = 0; i + lag < n; ++i) {
      dot += centered[i] * centered[i + lag];
      normA += centered[i] * centered[i];
      normB += centered[i + lag] * centered[i + lag];
    }
    if (normA <= 0.0 || normB <= 0.0) continue;

    double score = dot / std::sqrt(normA * normB);
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  if (bestLag < 0 || bestScore <= 0.0) return std::nullopt;

  return static_cast<double>(bestLag);
}

// この関数はピーク検出のために使われる.
// 顕著さがの処理が必要かどうかは確かめていないので不明.
// 自身の点より高い点(峰)がでてくるまで進んで,
// その間の最小値(谷)を左右に対して2回求める.
// 自身の点と谷の差を顕著さとしている.
// 山のような周りの高さが高いとこでちょっとしたノイズでできた極大値をピークとして扱わないようにするため
// だと考えられる.
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

// チップの境界にピークが来ると考えられるから.
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

// 信号の標準偏差を計算する. ピークの顕著さのしきい値を決めるために使う.
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
  // 射影 -> 平滑化 -> トレンド除去.
  // 合わせ目で山になる信号が得られる.
  std::vector<double> raw = convertToBrightnessDiff(roi);
  std::vector<double> signal = smoothProfile(raw, kSmoothSigma);

  // トレンド除去のσは周期より十分大きく取りたいが, 周期はまだ未知なので
  // 一度粗く推定してから決める.
  std::optional<double> roughPeriod = estimatePeriod(signal);
  if (roughPeriod.has_value()) {
    signal = removeTrend(signal, roughPeriod.value() * 2.0);
  }

  std::optional<double> period = estimatePeriod(signal);
  if (!period.has_value()) return std::nullopt;

  int minDistance =
      std::max(1, static_cast<int>(period.value() * kMinDistanceRatio));
  double minProminence = standardDeviation(signal) * kMinProminenceRatio;
  std::vector<int> peaks = findPeaks(signal, minDistance, minProminence);

  if (peaks.size() < 2) return std::nullopt;

  CountResult result;
  result.count = static_cast<int>(peaks.size()) - 1;
  result.signal = signal;
  result.peaks = peaks;
  result.period = period.value();

  return result;
}

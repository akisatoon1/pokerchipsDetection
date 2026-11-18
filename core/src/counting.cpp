#include "pokerchip/counting.hpp"

#include <algorithm>
#include <cmath>
#include <opencv2/imgproc.hpp>

#include "working_scale.hpp"

namespace {

// ---- パラメータ ----------------------------------------------------------
// 長さは研究で使った箱の幅 600px のときの値. scaledLength で幅に合わせる.

/**
 * @brief チップ 1 枚の 厚さ / 直径 の見込み. 周期を探す範囲を決める.
 *
 * 研究で, 角度が小さい画像の周期 / 箱の幅 から測った値.
 * 標準的なチップ (3.3mm / 39mm = 0.085) に近い.
 */
const double kThicknessRatio = 0.0909;

/**
 * @brief 周期を探す範囲. 見込みの周期に対する比.
 *
 * 合わせ目の模様の半周期や 2 周期を周期と取り違えないよう,
 * 見込みの近くだけを探す.
 */
const double kPeriodSearchLow = 0.7;
const double kPeriodSearchHigh = 1.4;

//! 周期を測るとき, 上の面の縁からさらに下げる量 (幅 600px のとき).
const double kPeriodTopMarginAt600 = 12.0;

//! 周期を測る信号から, ゆるやかな明るさの変化を除くぼかしの σ (幅 600px
//! のとき).
const double kTrendSigmaAt600 = 40.0;

/**
 * @brief 周期を測る列の範囲 (幅に対する比). 端は合わせ目がつぶれるので除く.
 */
const double kPeriodColumnLeft = 0.2;
const double kPeriodColumnRight = 0.8;

//! 合わせ目を追う列の範囲 (幅に対する比).
const double kTrackColumnLeft = 0.25;
const double kTrackColumnRight = 0.75;

/**
 * @brief 合わせ目を追う信号から, ゆるやかな変化を除くぼかしの σ
 * (周期に対する比).
 */
const double kTrackTrendSigma = 1.5;

//! 次の合わせ目を探す範囲. 前の合わせ目から 1 周期の位置の ± この比.
const double kTrackSearchRange = 0.3;

/**
 * @brief 追跡する周期の更新の重み.
 *
 * 透視で上ほどチップが薄く写るので周期を少しずつ更新するが,
 * 1 つの合わせ目の取り違えで大きく崩れないよう, 変化を抑える.
 */
const double kTrackUpdateWeight = 0.3;
const double kTrackMaxChange = 0.2;

//! 箱の上端からこの距離 (周期に対する比) までは合わせ目を探さない.
const double kTrackStopRatio = 0.3;

/**
 * @brief 帯の行のそろい方を測るとき, 帯の上下を削る割合.
 *
 * 合わせ目の溝そのものは縞がないので, 帯の中央の行だけを見る.
 */
const double kBandMargin = 0.2;

//! 帯の色を比べる「スタックの中ほど」の範囲 (ROI の高さに対する比).
const double kMiddleTop = 0.4;
const double kMiddleBottom = 0.8;

//! 帯の特徴を取る列の範囲 (幅に対する比).
const double kBandColumnLeft = 0.15;
const double kBandColumnRight = 0.85;

//! これより低い帯 (px) はチップとみなさない.
const int kMinBandHeight = 3;

//! 低すぎる帯の色の距離. チップらしくないことを表す大きな値.
const double kTooThinColorDistance = 99.0;

/**
 * @brief チップらしさで, 色の距離に掛ける重み.
 *
 * 研究 (v17) で, 行のそろい方と色の差を合わせて選んだ値.
 */
const double kColorDistanceWeight = 0.01;

//! 見当から離れた枚数への罰の強さ (見当との差の 2 乗に掛ける).
const double kEstimatePenalty = 2.0;

/**
 * @brief 一番上のチップの上に帯がないときの, その帯のチップらしさ.
 *
 * 箱の上端までチップが詰まっている場合. 上の面がないとみなす.
 */
const double kNoBandAboveScore = -0.5;

/**
 * @brief 見当の 2 つの推定 (形の式と周期) が合うとみなす差 (枚).
 *
 * 合うときだけ平均し, 合わなければ形の式だけを使う.
 */
const double kEstimateAgreement = 1.0;

//! 傾きを測る行の範囲 (ROI の高さに対する比). 上の面を避ける.
const double kLeanTop = 0.45;
const double kLeanBottom = 0.97;

//! 傾きと行の幅を測るとき, 箱の左右に広げる量 (箱の幅に対する比).
const double kLeanMargin = 0.1;
const double kRowWidthMargin = 0.08;

//! 傾きを測るときの背景の色を取る, 左右の端の列数 (幅 600px のとき).
const double kLeanBackgroundAt600 = 36.0;

//! 傾きを測るとき, 背景との Lab の距離がこれを超える画素をスタックとみなす.
const double kLeanForegroundDistance = 12.0;

//! 行の幅を測る行の範囲の上限 (ROI の高さに対する比).
const double kRowWidthTop = 0.15;
const double kRowWidthBottom = 0.97;

//! 行の幅を測るときの背景の色を取る, 左右の端の列数 (幅 600px のとき).
const double kRowWidthBackgroundAt600 = 20.0;

/**
 * @brief 行の幅の縁とみなす, 背景からの距離 (背景のばらつきに対する比).
 *
 * 背景は左右で違うことがあるので, 左右それぞれの背景の色とばらつきで測る.
 */
const double kRowEdgeThreshold = 5.0;

//! 縁とみなすには, この列数だけ続けて背景から離れていること.
const int kRowEdgeRun = 4;

//! 背景のばらつきに足す下限 (8bit の Lab). 一様な背景で 0 で割らないため.
const double kBackgroundSpreadFloor = 2.0;

//! スタックの行とみなす幅の下限 (箱の幅に対する比).
const double kMinRowWidth = 0.5;

/**
 * @brief 行の幅の補正を効かせる強さ (べき).
 *
 * そのまま割ると効きすぎるので, 研究 (研究回 7) で 0.5 乗にした.
 */
const double kRowWidthExponent = 0.5;

/**
 * @brief 枚数の見当の式の係数.
 *
 * 形の式: 高さ/幅 ÷ 行の幅の補正 = N (a0 + a1 s) + (b0 + b1 s + b2 s²).
 * 周期の式: 高さ/幅 = k N 周期/幅 + c s + d.
 * s は sin(見下ろし角). testimages/v2/single_color の 140 枚のうち
 * sin 0.6 未満の画像で当てはめた (pyscript/fit_count_model.py).
 * チップのセットや検出器が変わったら当てはめ直す.
 */
const double kShapeA0 = 0.0907901;
const double kShapeA1 = -0.0475910;
const double kShapeB0 = -0.0795206;
const double kShapeB1 = 1.2795076;
const double kShapeB2 = -0.2030144;
const double kPeriodK = 0.8991877;
const double kPeriodC = 0.9206530;
const double kPeriodD = -0.0213259;

//! 正規化で 0 で割らないための小さな値.
const double kEpsilon = 1e-6;

// ---- 小さな道具 ----------------------------------------------------------

/**
 * @brief 中央値を求める. 要素数が偶数なら中央の 2 つの平均.
 * @param v 値. 並べ替えるので値で受け取る.
 * @return 中央値. v が空なら 0.
 */
double median(std::vector<double> v) {
  if (v.empty()) return 0.0;
  size_t mid = v.size() / 2;
  std::nth_element(v.begin(), v.begin() + mid, v.end());
  double upper = v[mid];
  if (v.size() % 2 == 1) return upper;
  double lower = *std::max_element(v.begin(), v.begin() + mid);
  return (lower + upper) / 2.0;
}

/**
 * @brief 列 [left, right) の, 行ごとの中央値をとる.
 * @param img 画像 (CV_32F, 1 チャンネル).
 * @param left 左端の列.
 * @param right 右端の列 (含まない).
 * @return 行ごとの中央値. 長さは img の行数.
 */
std::vector<double> rowMedians(const cv::Mat &img, int left, int right) {
  std::vector<double> out(img.rows);
  std::vector<double> row(right - left);
  for (int y = 0; y < img.rows; ++y) {
    const auto *p = img.ptr<float>(y);
    for (int x = left; x < right; ++x) row[x - left] = p[x];
    out[y] = median(row);
  }
  return out;
}

/**
 * @brief 1 次元の信号をガウシアンでぼかす.
 * @param v 信号.
 * @param sigma 標準偏差 (要素数).
 * @return ぼかした信号. 長さは v と同じ. 端は折り返して埋める.
 */
std::vector<double> smooth(const std::vector<double> &v, double sigma) {
  cv::Mat src(v, true);  // 長さ × 1 の列 (CV_64F).
  cv::Mat dst;
  cv::GaussianBlur(src, dst, cv::Size(1, 0), 0, sigma);
  return std::vector<double>(dst.begin<double>(), dst.end<double>());
}

/**
 * @brief 信号から, ゆるやかな変化 (ぼかした信号) を引く.
 * @param v 信号.
 * @param sigma ぼかしの標準偏差 (要素数).
 * @return 引いた信号. 長さは v と同じ.
 */
std::vector<double> removeTrend(const std::vector<double> &v, double sigma) {
  std::vector<double> trend = smooth(v, sigma);
  std::vector<double> out(v.size());
  for (size_t i = 0; i < v.size(); ++i) out[i] = v[i] - trend[i];
  return out;
}

/**
 * @brief スタックの画像の Lab を求める.
 * @param bgr 画像 (BGR, 8bit).
 * @return 8bit の Lab を CV_32F にしたもの (L は 0〜255).
 */
cv::Mat toLab(const cv::Mat &bgr) {
  cv::Mat lab;
  cv::cvtColor(bgr, lab, cv::COLOR_BGR2Lab);
  lab.convertTo(lab, CV_32F);
  return lab;
}

/**
 * @brief 縦の明るさの変化の大きさを求める. 合わせ目の溝で大きくなる.
 * @param bgr 画像 (BGR).
 * @return Lab の L を 3x3 でぼかし, 縦に微分した絶対値 (CV_32F).
 */
cv::Mat seamStrength(const cv::Mat &bgr) {
  cv::Mat lightness;
  cv::extractChannel(toLab(bgr), lightness, 0);
  cv::GaussianBlur(lightness, lightness, cv::Size(3, 3), 0);
  cv::Mat gradient;
  cv::Sobel(lightness, gradient, CV_32F, 0, 1);
  return cv::abs(gradient);
}

/**
 * @brief 箱を左右に広げて切り出し, 解析用の大きさに縮める.
 * @param bgr 元画像.
 * @param box スタックの領域 (元画像の px).
 * @param marginRatio 左右に広げる量 (箱の幅に対する比).
 * @param scale 解析用の縮小率.
 * @return 切り出して縮めた画像. 広げた部分は画像の範囲で切る.
 */
cv::Mat cropWithMargin(const cv::Mat &bgr, const cv::Rect &box,
                       double marginRatio, double scale) {
  int margin = static_cast<int>(marginRatio * box.width);
  int left = std::max(0, box.x - margin);
  int right = std::min(bgr.cols, box.x + box.width + margin);
  cv::Rect region(left, box.y, right - left, box.height);
  return toWorkingScale(bgr(region), scale);
}

// ---- 周期 ----------------------------------------------------------------

/**
 * @brief 見込みの周期の近くで, 自己相関の山から周期を求める.
 * @param signal 周期を測る信号.
 * @param expected 見込みの周期 (要素数).
 * @return 周期 (要素数. 山の頂点を放物線で補った小数).
 *         探す範囲が取れないほど信号が短い場合は expected.
 */
double periodNear(const std::vector<double> &signal, double expected) {
  int n = static_cast<int>(signal.size());
  int lo = std::max(3, static_cast<int>(expected * kPeriodSearchLow));
  int hi = std::min(n - 2, static_cast<int>(expected * kPeriodSearchHigh) + 1);
  if (hi <= lo + 2) return expected;

  // 平均を引かない自己相関 (ラグ 0 で割る). 研究の FFT による計算と同じ値.
  auto lagProduct = [&signal, n](int lag) {
    double sum = 0.0;
    for (int i = 0; i + lag < n; ++i) sum += signal[i] * signal[i + lag];
    return sum;
  };
  double zero = lagProduct(0) + 1e-9;
  std::vector<double> ac(hi + 1);
  for (int lag = lo - 1; lag <= hi; ++lag) ac[lag] = lagProduct(lag) / zero;

  int best = lo;
  for (int lag = lo; lag < hi; ++lag) {
    if (ac[lag] > ac[best]) best = lag;
  }
  double period = best;
  if (best > lo && best < hi - 1) {
    double denom = ac[best - 1] - 2.0 * ac[best] + ac[best + 1];
    if (denom != 0.0) period += 0.5 * (ac[best - 1] - ac[best + 1]) / denom;
  }
  return period;
}

/**
 * @brief 弧を水平に戻した合わせ目の信号から, チップ 1 枚の周期を求める.
 *
 * 上の面は合わせ目と違う模様を持つので, 上の面の縁より下だけを使う.
 * @param strength seamStrength の結果 (解析用の大きさ).
 * @param s sin(見下ろし角).
 * @return 周期 (解析用の大きさの px). 上の面より下が短すぎれば nullopt.
 */
std::optional<double> estimatePeriod(const cv::Mat &strength, double s) {
  int width = strength.cols;
  cv::Mat flat = flattenArcs(strength, std::vector<double>(strength.rows, s),
                             cv::BORDER_CONSTANT);
  std::vector<double> profile =
      rowMedians(flat, static_cast<int>(width * kPeriodColumnLeft),
                 static_cast<int>(width * kPeriodColumnRight));

  int top = static_cast<int>(
      std::min(static_cast<double>(strength.rows - 10),
               width * s + scaledLength(kPeriodTopMarginAt600, width)));
  if (top < 0 || strength.rows - top < 8) return std::nullopt;

  std::vector<double> below(profile.begin() + top, profile.end());
  below = removeTrend(below, scaledLength(kTrendSigmaAt600, width));
  double expected = width * kThicknessRatio * std::sqrt(1.0 - s * s);
  return periodNear(below, expected);
}

// ---- 箱の形 --------------------------------------------------------------

/**
 * @brief 行の左右の背景の色の中央値を求める.
 * @param row 行の画素 (Lab).
 * @param width 行の画素数.
 * @param columns 背景とみなす左右の端の列数.
 * @return 左右の端の画素をまとめた中央値.
 */
cv::Vec3d sideBackground(const cv::Vec3f *row, int width, int columns) {
  cv::Vec3d bg;
  for (int c = 0; c < 3; ++c) {
    std::vector<double> v;
    for (int x = 0; x < columns; ++x) {
      v.push_back(row[x][c]);
      v.push_back(row[width - 1 - x][c]);
    }
    bg[c] = median(v);
  }
  return bg;
}

/**
 * @brief スタックの左右の傾き (中心の横のずれ / 高さ) を測る.
 *
 * 傾いたスタックは箱が低く写り, 枚数を少なく見積もるため.
 * 行ごとに左右の背景と違う画素の範囲の中心を求め, 高さに対して直線を当てる.
 * @param bgr 元画像.
 * @param box スタックの領域 (元画像の px).
 * @param scale 解析用の縮小率.
 * @return 傾き. 測れる行が足りなければ 0.
 */
double measureLean(const cv::Mat &bgr, const cv::Rect &box, double scale) {
  cv::Mat lab = toLab(cropWithMargin(bgr, box, kLeanMargin, scale));
  cv::GaussianBlur(lab, lab, cv::Size(5, 5), 0);
  int boxWidth = cvRound(box.width * scale);
  int background = scaledLength(kLeanBackgroundAt600, boxWidth);
  int minPixels = scaledLength(10.0, boxWidth);
  if (2 * background >= lab.cols) return 0.0;

  // (行, その行のスタックの中心の列)
  std::vector<std::pair<double, double>> centers;
  int step = scaledLength(4.0, boxWidth);
  for (int y = static_cast<int>(lab.rows * kLeanTop);
       y < static_cast<int>(lab.rows * kLeanBottom); y += step) {
    const auto *row = lab.ptr<cv::Vec3f>(y);
    cv::Vec3d bg = sideBackground(row, lab.cols, background);
    int first = -1, last = -1, count = 0;
    for (int x = 0; x < lab.cols; ++x) {
      if (cv::norm(cv::Vec3d(row[x]) - bg) <= kLeanForegroundDistance) continue;
      if (first < 0) first = x;
      last = x;
      ++count;
    }
    if (count > minPixels) centers.emplace_back(y, (first + last) / 2.0);
  }
  if (centers.size() < 10) return 0.0;

  // 中心の列を行の 1 次式で当てる. 傾きだけが要る.
  double meanRow = 0.0, meanCenter = 0.0;
  for (const auto &[row, center] : centers) {
    meanRow += row;
    meanCenter += center;
  }
  meanRow /= static_cast<double>(centers.size());
  meanCenter /= static_cast<double>(centers.size());
  double num = 0.0, den = 0.0;
  for (const auto &[row, center] : centers) {
    num += (row - meanRow) * (center - meanCenter);
    den += (row - meanRow) * (row - meanRow);
  }
  return den > 0.0 ? num / den : 0.0;
}

/**
 * @brief 行の片側の背景.
 */
struct Background {
  //! 背景の色 (各チャンネルの中央値).
  cv::Vec3d color;

  //! 背景の色からの距離の中央値に kBackgroundSpreadFloor を足した値.
  double spread;

  /**
   * @brief 画素が背景から十分に離れているか (スタックの画素か).
   * @param pixel 画素 (Lab).
   * @return 背景のばらつきの kRowEdgeThreshold 倍より離れていれば true.
   */
  bool isFar(const cv::Vec3f &pixel) const {
    return cv::norm(cv::Vec3d(pixel) - color) / spread > kRowEdgeThreshold;
  }
};

/**
 * @brief 行の列 [from, to) を背景とみなし, その色とばらつきを求める.
 * @param row 行の画素 (Lab).
 * @param from 背景の列の始まり.
 * @param to 背景の列の終わり (含まない).
 * @return 背景.
 */
Background backgroundOf(const cv::Vec3f *row, int from, int to) {
  Background bg;
  for (int c = 0; c < 3; ++c) {
    std::vector<double> v;
    for (int x = from; x < to; ++x) v.push_back(row[x][c]);
    bg.color[c] = median(v);
  }
  std::vector<double> dist;
  for (int x = from; x < to; ++x) {
    dist.push_back(cv::norm(cv::Vec3d(row[x]) - bg.color));
  }
  bg.spread = median(dist) + kBackgroundSpreadFloor;
  return bg;
}

/**
 * @brief 1 行のスタックの左右の縁を, 左右それぞれの背景から外から内へ探す.
 *
 * 左右で背景の色が違う写真があるので, 背景を 1 つにまとめない.
 * @param row 行の画素 (Lab).
 * @param width 行の画素数.
 * @param background 背景とみなす左右の端の列数.
 * @return 左の縁と右の縁の列. 見つからなければ nullopt.
 */
std::optional<std::pair<int, int>> rowEdges(const cv::Vec3f *row, int width,
                                            int background) {
  Background leftBg = backgroundOf(row, 0, background);
  Background rightBg = backgroundOf(row, width - background, width);

  // kRowEdgeRun 列続けて背景から離れた, 最も外の位置を縁にする.
  int left = -1, right = -1, run = 0;
  for (int x = background; x < width - 1 && left < 0; ++x) {
    run = leftBg.isFar(row[x]) ? run + 1 : 0;
    if (run == kRowEdgeRun) left = x - kRowEdgeRun + 1;
  }
  run = 0;
  for (int x = width - background - 1; x > 1 && right < 0; --x) {
    run = rightBg.isFar(row[x]) ? run + 1 : 0;
    if (run == kRowEdgeRun) right = x + kRowEdgeRun - 1;
  }
  if (left < 0 || right < 0) return std::nullopt;
  return std::make_pair(left, right);
}

/**
 * @brief 行ごとのスタックの幅の中央値を, 箱の幅に対する比で求める.
 *
 * チップが左右にずれて積まれると箱の幅が 1 枚の直径より広がるので,
 * 形の式の幅をこの値で直す.
 * @param bgr 元画像.
 * @param box スタックの領域 (元画像の px).
 * @param scale 解析用の縮小率.
 * @param s sin(見下ろし角). 上の面の行を除くのに使う.
 * @return 幅の比. 測れる行が足りなければ 1.
 */
double measureRowWidth(const cv::Mat &bgr, const cv::Rect &box, double scale,
                       double s) {
  cv::Mat lab = toLab(cropWithMargin(bgr, box, kRowWidthMargin, scale));
  cv::GaussianBlur(lab, lab, cv::Size(5, 5), 0);
  int boxWidth = cvRound(box.width * scale);
  int background = scaledLength(kRowWidthBackgroundAt600, boxWidth);
  if (2 * background >= lab.cols) return 1.0;

  int top = static_cast<int>(std::max(
      lab.rows * kRowWidthTop, boxWidth * s + scaledLength(10.0, boxWidth)));
  int step = scaledLength(2.0, boxWidth);
  std::vector<double> widths;
  for (int y = top; y < static_cast<int>(lab.rows * kRowWidthBottom);
       y += step) {
    auto edges = rowEdges(lab.ptr<cv::Vec3f>(y), lab.cols, background);
    if (!edges.has_value()) continue;
    int w = edges->second - edges->first;
    if (w > kMinRowWidth * boxWidth) {
      widths.push_back(static_cast<double>(w) / boxWidth);
    }
  }
  if (widths.size() <= 10) return 1.0;
  return median(widths);
}

/**
 * @brief 箱の縦横比と周期から, 枚数の見当を出す.
 * @param f 箱の形と周期の特徴.
 * @param s sin(見下ろし角).
 * @return 枚数の見当 (小数).
 */
double estimateFromShape(const CountFeatures &f, double s) {
  double corrected =
      f.heightRatio / std::pow(f.rowWidthRatio, kRowWidthExponent);
  double byShape = (corrected - kShapeB0 - kShapeB1 * s - kShapeB2 * s * s) /
                   (kShapeA0 + kShapeA1 * s);
  double byPeriod =
      (f.heightRatio - kPeriodC * s - kPeriodD) / (kPeriodK * f.periodRatio);
  if (std::abs(byPeriod - byShape) < kEstimateAgreement) {
    return (byShape + byPeriod) / 2.0;
  }
  return byShape;
}

// ---- 合わせ目の追跡と枚数の選択 ------------------------------------------

/**
 * @brief 下端から上へ, 合わせ目を 1 つずつ追う.
 *
 * 1 周期上の付近で信号が最大の行を次の合わせ目とし, 周期を少しずつ更新する.
 * @param profile 弧を水平に戻した合わせ目の信号 (行ごと).
 * @param period 周期 (要素数).
 * @return 合わせ目の行. 下から順 (降順). 一番下の縁 (下端) は含まない.
 */
std::vector<int> trackSeams(const std::vector<double> &profile, double period) {
  std::vector<double> seg = removeTrend(profile, period * kTrackTrendSigma);
  std::vector<double> absSeg(seg.size());
  for (size_t i = 0; i < seg.size(); ++i) absSeg[i] = std::abs(seg[i]);
  double norm = median(absSeg) + kEpsilon;
  for (double &v : seg) v /= norm;

  int y = static_cast<int>(profile.size()) - 1;
  double d = period;
  double stop = kTrackStopRatio * period;
  std::vector<int> seams;
  while (true) {
    double c = y - d;
    int lo = static_cast<int>(c - kTrackSearchRange * d);
    int hi = static_cast<int>(c + kTrackSearchRange * d) + 1;
    if (lo < stop) break;
    int j = static_cast<int>(
        std::max_element(seg.begin() + lo, seg.begin() + hi) - seg.begin());
    if (j >= y) break;  // 周期が縮みきったとき無限に回らないように.
    seams.push_back(j);
    double change =
        std::clamp(static_cast<double>(y - j), (1.0 - kTrackMaxChange) * d,
                   (1.0 + kTrackMaxChange) * d);
    d = (1.0 - kTrackUpdateWeight) * d + kTrackUpdateWeight * change;
    y = j;
  }
  return seams;
}

/**
 * @brief 帯 [top, bottom) の中央の行が, 帯の中央値の行とどれだけそろうか.
 * @param flat 弧を水平に戻した Lab の画像 (CV_32FC3).
 * @param top 帯の上端の行.
 * @param bottom 帯の下端の行 (含まない).
 * @return 行と中央値の行の相関の平均. 行が足りなければ nullopt.
 */
std::optional<double> rowAlignment(const cv::Mat &flat, int top, int bottom) {
  int height = bottom - top;
  int u = static_cast<int>(top + kBandMargin * height);
  int v = static_cast<int>(bottom - kBandMargin * height);
  if (v - u < 2) return std::nullopt;

  cv::Mat rows = flat.rowRange(u, v).clone().reshape(1, v - u);  // 行 × (幅*3)
  int n = rows.cols;
  std::vector<double> med(n);
  std::vector<double> column(v - u);
  for (int i = 0; i < n; ++i) {
    for (int r = 0; r < v - u; ++r) column[r] = rows.at<float>(r, i);
    med[i] = median(column);
  }
  cv::Mat medRow(1, n, CV_64F, med.data());
  medRow -= cv::mean(medRow)[0];
  double medNorm = cv::norm(medRow);

  double sum = 0.0;
  for (int r = 0; r < v - u; ++r) {
    cv::Mat row;
    rows.row(r).convertTo(row, CV_64F);
    row -= cv::mean(row)[0];
    sum += row.dot(medRow) / (cv::norm(row) * medNorm + kEpsilon);
  }
  return sum / (v - u);
}

/**
 * @brief 画素の色の中央値を, チャンネルごとに求める.
 * @param flat Lab の画像 (CV_32FC3).
 * @param top 範囲の上端の行.
 * @param bottom 範囲の下端の行 (含まない).
 * @return 色の中央値.
 */
cv::Vec3d medianColor(const cv::Mat &flat, int top, int bottom) {
  cv::Vec3d out;
  std::vector<double> v;
  for (int c = 0; c < 3; ++c) {
    v.clear();
    for (int y = top; y < bottom; ++y) {
      const auto *p = flat.ptr<cv::Vec3f>(y);
      for (int x = 0; x < flat.cols; ++x) v.push_back(p[x][c]);
    }
    out[c] = median(v);
  }
  return out;
}

/**
 * @brief 合わせ目で区切った帯ごとに, チップの側面らしさの特徴を求める.
 * @param flat 弧を水平に戻した Lab の画像 (中央の列だけ. CV_32FC3).
 * @param bounds 帯の境目の行. 下から順 (降順). 先頭は下端, 最後は 0.
 * @return 帯ごとの特徴. 下の帯から順. 長さは bounds.size() - 1.
 */
std::vector<BandScore> scoreBands(const cv::Mat &flat,
                                  const std::vector<int> &bounds) {
  cv::Vec3d middle = medianColor(flat, static_cast<int>(flat.rows * kMiddleTop),
                                 static_cast<int>(flat.rows * kMiddleBottom));
  std::vector<BandScore> bands;
  for (size_t k = 0; k + 1 < bounds.size(); ++k) {
    int top = bounds[k + 1];
    int bottom = bounds[k];
    BandScore band;
    if (bottom - top < kMinBandHeight) {
      band.colorDistance = kTooThinColorDistance;
    } else {
      band.alignment = rowAlignment(flat, top, bottom).value_or(0.0);
      band.colorDistance = cv::norm(medianColor(flat, top, bottom) - middle);
    }
    bands.push_back(band);
  }
  return bands;
}

/**
 * @brief 見当の前後から,
 * 一番上のチップと上の面の境目が最ももっともらしい枚数を選ぶ.
 *
 * 枚数が N なら, 下から N 番目の帯 (一番上のチップ) はチップらしく,
 * その上の帯 (上の面) はチップらしくないはず. その差から,
 * 見当から離れた分の罰を引いた値が最大の N を選ぶ.
 * 上の面の見える厚さは角度からは 0.4 周期の精度でしか分からないので,
 * 画像から直接見分ける (研究回 8).
 * @param bands scoreBands の結果.
 * @param estimate 枚数の見当.
 * @return 枚数. 見当が数でないか, 見当の前後に合う帯がなければ nullopt.
 */
std::optional<int> chooseCount(const std::vector<BandScore> &bands,
                               double estimate) {
  // 周期や幅が測れず見当が無限大になったときに, 整数へ変換しないため.
  if (!std::isfinite(estimate) ||
      estimate > static_cast<double>(bands.size()) + 2.0) {
    return std::nullopt;
  }
  // 下の半分 (少なくとも 3 つ) の帯を, 側面のそろい方の基準にする.
  size_t refCount =
      std::min(bands.size(), std::max<size_t>(3, bands.size() / 2));
  std::vector<double> refs;
  for (size_t k = 0; k < refCount; ++k) refs.push_back(bands[k].alignment);
  double reference = median(refs) + kEpsilon;
  auto chipLike = [&](const BandScore &b) {
    return b.alignment / reference - kColorDistanceWeight * b.colorDistance;
  };

  int center = static_cast<int>(std::nearbyint(estimate));
  std::optional<int> best;
  double bestScore = 0.0;
  for (int n = center - 1; n <= center + 1; ++n) {
    if (n < 1 || n > static_cast<int>(bands.size())) continue;
    double above = n < static_cast<int>(bands.size()) ? chipLike(bands[n])
                                                      : kNoBandAboveScore;
    double score = chipLike(bands[n - 1]) - above -
                   kEstimatePenalty * (n - estimate) * (n - estimate);
    if (!best.has_value() || score > bestScore) {
      best = n;
      bestScore = score;
    }
  }
  return best;
}

/**
 * @brief 解析用の大きさの信号を, 元画像の行の数に引き伸ばす.
 * @param v 信号.
 * @param rows 元画像の行の数.
 * @return 長さ rows の信号 (直線で補う).
 */
std::vector<double> resampleRows(const std::vector<double> &v, int rows) {
  cv::Mat src(v, true);  // 長さ × 1 の列 (CV_64F).
  cv::Mat dst;
  cv::resize(src, dst, cv::Size(1, rows), 0, 0, cv::INTER_LINEAR);
  return std::vector<double>(dst.begin<double>(), dst.end<double>());
}

}  // namespace

std::optional<CountResult> countChips(const cv::Mat &bgr, const cv::Rect &box,
                                      const TiltEstimate &tilt) {
  double scale = workingScale(box.width);
  cv::Mat roi = toWorkingScale(bgr(box), scale);
  cv::Mat strength = seamStrength(roi);
  int width = roi.cols;

  std::optional<double> period = estimatePeriod(strength, tilt.sin);
  if (!period.has_value()) return std::nullopt;

  CountFeatures features;
  double lean = measureLean(bgr, box, scale);
  features.heightRatio = box.height * std::sqrt(1.0 + lean * lean) / box.width;
  features.rowWidthRatio = measureRowWidth(bgr, box, scale, tilt.sin);
  features.periodRatio = period.value() / width;
  double estimate = estimateFromShape(features, tilt.sin);

  // 透視で上と下の角度が違うので, 行ごとの角度で弧を戻す.
  std::vector<double> sins = rowTiltSins(tilt, roi.rows);
  cv::Mat flatStrength = flattenArcs(strength, sins, cv::BORDER_REPLICATE);
  std::vector<double> profile =
      rowMedians(flatStrength, static_cast<int>(width * kTrackColumnLeft),
                 static_cast<int>(width * kTrackColumnRight));
  std::vector<int> seams = trackSeams(profile, period.value());

  std::vector<int> bounds{roi.rows - 1};
  bounds.insert(bounds.end(), seams.begin(), seams.end());
  bounds.push_back(0);
  cv::Mat flatLab = flattenArcs(toLab(roi), sins, cv::BORDER_REPLICATE)
                        .colRange(static_cast<int>(width * kBandColumnLeft),
                                  static_cast<int>(width * kBandColumnRight))
                        .clone();
  cv::GaussianBlur(flatLab, flatLab, cv::Size(5, 1), 0);
  std::vector<BandScore> bands = scoreBands(flatLab, bounds);

  std::optional<int> count = chooseCount(bands, estimate);
  if (!count.has_value()) return std::nullopt;

  CountResult result;
  result.count = count.value();
  // 一番上のチップの上の縁から下端まで. 上から順に並べ, 元画像の px に戻す.
  for (int k = count.value(); k >= 0; --k) {
    int y = cvRound(bounds[k] / scale);
    result.peaks.push_back(std::clamp(y, 0, box.height - 1));
  }
  result.signal = resampleRows(profile, box.height);
  result.period = period.value() / scale;
  result.features = features;
  result.estimate = estimate;
  result.bands = bands;
  return result;
}

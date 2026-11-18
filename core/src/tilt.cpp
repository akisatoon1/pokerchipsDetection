#include "pokerchip/tilt.hpp"

#include <algorithm>
#include <cmath>
#include <opencv2/imgproc.hpp>

#include "working_scale.hpp"

namespace {

// ---- パラメータ ----------------------------------------------------------
// 長さは研究で使った箱の幅 600px のときの値. scaledLength で幅に合わせる.

//! 弧を測るとき, 中央から外へ列をずらす回数.
const int kArcSteps = 20;

/**
 * @brief 列を 1 回ずらす量 (幅 600px のとき).
 *
 * kArcSteps 回で中央から幅の 1/3 まで進む. 端の近くは円柱の側面が
 * 浅い角度で写り, 合わせ目がつぶれるので使わない.
 */
const double kArcStepAt600 = 10.0;

//! 相互相関をとる列の束の半幅 (幅 600px のとき).
const double kArcColumnHalfWidthAt600 = 6.0;

//! 隣り合う列の束の, 縦のずれを探す範囲 (幅 600px のとき).
const double kArcMaxShiftAt600 = 12.0;

/**
 * @brief 最初に角度を測る帯 (ROI の高さに対する比).
 *
 * 角度が分からないうちは上の面の大きさも分からないので,
 * 上の面が入りにくい下の帯で測る.
 */
const double kFirstBandTop = 0.45;
const double kFirstBandBottom = 0.95;

//! 測り直すときの帯の下端 (ROI の高さに対する比). 台の影を避ける.
const double kBandBottom = 0.97;

/**
 * @brief 測り直す帯の上端の下限と上限 (ROI の高さに対する比).
 *
 * 上端は上の面の楕円の手前の縁 (箱の上端から 幅 × sin) に置く.
 * 背の低いスタックでも帯が残るよう上限を設ける.
 */
const double kMinBandTop = 0.15;
const double kMaxBandTop = 0.8;

//! 上の面を避けて測り直す回数. 研究で 2 回で落ち着いた.
const int kRemeasureCount = 2;

//! 上の帯と下の帯を重ねる量 (ROI の高さに対する比).
const double kBandOverlap = 0.05;

//! 相関の正規化で, 0 で割らないための小さな値.
const double kEpsilon = 1e-6;

// ---- 内部処理 ------------------------------------------------------------

/**
 * @brief 縦の明るさの変化 (符号付き) を求める.
 * @param roi 解析用の大きさに縮めたスタックの画像 (BGR).
 * @return Lab の L を 5x5 でぼかし, 縦に微分した画像 (CV_32F).
 */
cv::Mat verticalGradient(const cv::Mat &roi) {
  cv::Mat lab;
  cv::cvtColor(roi, lab, cv::COLOR_BGR2Lab);
  cv::Mat lightness;
  cv::extractChannel(lab, lightness, 0);
  lightness.convertTo(lightness, CV_32F);
  cv::GaussianBlur(lightness, lightness, cv::Size(5, 5), 0);

  cv::Mat gradient;
  cv::Sobel(lightness, gradient, CV_32F, 0, 1);
  return gradient;
}

/**
 * @brief 列 [left, right) の, 行ごとの平均をとる.
 * @param img 画像 (CV_32F, 1 チャンネル).
 * @param left 左端の列.
 * @param right 右端の列 (含まない).
 * @return 行ごとの平均. 長さは img の行数.
 */
std::vector<double> columnMean(const cv::Mat &img, int left, int right) {
  cv::Mat mean;
  cv::reduce(img.colRange(left, right), mean, 1, cv::REDUCE_AVG, CV_64F);
  return std::vector<double>(mean.begin<double>(), mean.end<double>());
}

/**
 * @brief 信号を平均 0, 標準偏差 1 にそろえる.
 * @param v 信号.
 * @return そろえた信号. 長さは v と同じ.
 */
std::vector<double> standardize(const std::vector<double> &v) {
  cv::Scalar mean, stddev;
  cv::meanStdDev(v, mean, stddev);
  std::vector<double> out(v.size());
  for (size_t i = 0; i < v.size(); ++i) {
    out[i] = (v[i] - mean[0]) / (stddev[0] + kEpsilon);
  }
  return out;
}

/**
 * @brief 2 つの縦の信号のずれを, 相互相関の山から小数で求める.
 * @param a 基準の信号.
 * @param b 比べる信号. a と同じ長さ.
 * @param maxShift 探すずれの範囲 (要素数). 長さの半分未満にする.
 * @return b が a より下にずれている量 (要素数). 上なら負.
 */
double verticalShift(const std::vector<double> &a, const std::vector<double> &b,
                     int maxShift) {
  std::vector<double> za = standardize(a);
  std::vector<double> zb = standardize(b);
  int n = static_cast<int>(a.size());

  std::vector<double> cc;
  for (int s = -maxShift; s <= maxShift; ++s) {
    double dot = 0.0;
    for (int k = maxShift; k < n - maxShift; ++k) dot += za[k] * zb[k + s];
    cc.push_back(dot);
  }

  int best =
      static_cast<int>(std::max_element(cc.begin(), cc.end()) - cc.begin());
  double offset = 0.0;
  if (best > 0 && best + 1 < static_cast<int>(cc.size())) {
    // 山の頂点を放物線で補う. 1px より細かいずれが角度に効くため.
    double denom = cc[best - 1] - 2.0 * cc[best] + cc[best + 1];
    if (denom != 0.0) offset = 0.5 * (cc[best - 1] - cc[best + 1]) / denom;
  }
  return best - maxShift + offset;
}

/**
 * @brief 帯 [top, bottom) で, 合わせ目の弧のたわみから sin(見下ろし角) を測る.
 *
 * 中央から左右へ列の束をずらし, 隣の束との縦のずれを積み上げる.
 * 中央から x 離れた位置の高さは, 弧なら (幅/2) × sin × (1 - √(1 - (2x/幅)²))
 * だけ上がるので, 積み上げたずれにこの形を最小二乗で当てる.
 * @param gradient verticalGradient の結果.
 * @param top 帯の上端 (ROI の高さに対する比).
 * @param bottom 帯の下端 (ROI の高さに対する比).
 * @return sin(見下ろし角). 頭打ちにはしない. 帯が短すぎて測れなければ nullopt.
 */
std::optional<double> measureArcSag(const cv::Mat &gradient, double top,
                                    double bottom) {
  int width = gradient.cols;
  int maxShift = scaledLength(kArcMaxShiftAt600, width);
  cv::Mat band = gradient.rowRange(static_cast<int>(gradient.rows * top),
                                   static_cast<int>(gradient.rows * bottom));
  if (band.rows <= 2 * maxShift + 2) return std::nullopt;

  int step = scaledLength(kArcStepAt600, width);
  int halfWidth = scaledLength(kArcColumnHalfWidthAt600, width);
  int center = width / 2;
  if (center + kArcSteps * step + halfWidth > width) return std::nullopt;

  // 左右で積み上げたずれの平均. 添字は中央からのずらした回数.
  std::vector<double> rise(kArcSteps + 1, 0.0);
  for (int side : {1, -1}) {
    double cumulative = 0.0;
    std::vector<double> prev =
        columnMean(band, center - halfWidth, center + halfWidth);
    for (int k = 1; k <= kArcSteps; ++k) {
      int c = center + side * k * step;
      std::vector<double> cur = columnMean(band, c - halfWidth, c + halfWidth);
      cumulative += verticalShift(prev, cur, maxShift);
      rise[k] += cumulative / 2.0;
      prev = cur;
    }
  }

  double halfSpan = width / 2.0;
  double num = 0.0, den = 0.0;
  for (int k = 1; k <= kArcSteps; ++k) {
    double u = k * step / halfSpan;
    double shape = 1.0 - std::sqrt(std::max(0.0, 1.0 - u * u));
    num += shape * rise[k];
    den += shape * shape;
  }
  if (den <= 0.0) return std::nullopt;

  // 外ほど上がる (ずれが負) ので, 符号を反転して正のたわみにする.
  return -num / den / halfSpan;
}

/**
 * @brief sin を 0 〜 kMaxTiltSin に収める.
 * @param s sin(見下ろし角).
 * @return 収めた値.
 */
double clampTilt(double s) { return std::clamp(s, 0.0, kMaxTiltSin); }

/**
 * @brief 上の面の楕円の手前の縁より下に, 測る帯の上端を置く.
 *
 * 上の面の楕円の短軸は 幅 × sin なので, 箱の上端からその分だけ下げる.
 * @param s いま分かっている sin(見下ろし角).
 * @param size 解析用の画像の大きさ.
 * @return 帯の上端 (ROI の高さに対する比).
 */
double bandTopBelowTopFace(double s, const cv::Size &size) {
  return std::clamp(size.width * s / size.height, kMinBandTop, kMaxBandTop);
}

}  // namespace

std::optional<TiltEstimate> estimateTilt(const cv::Mat &roi) {
  if (roi.empty()) return std::nullopt;
  cv::Mat working = toWorkingScale(roi, workingScale(roi.cols));
  cv::Mat gradient = verticalGradient(working);

  std::optional<double> first =
      measureArcSag(gradient, kFirstBandTop, kFirstBandBottom);
  if (!first.has_value()) return std::nullopt;
  double s = clampTilt(first.value());
  for (int i = 0; i < kRemeasureCount; ++i) {
    double top = bandTopBelowTopFace(s, gradient.size());
    std::optional<double> again = measureArcSag(gradient, top, kBandBottom);
    if (!again.has_value()) return std::nullopt;
    s = clampTilt(again.value());
  }

  // 帯を上下に分けて測る. 透視で下ほど見下ろす角度が大きいため.
  double top = bandTopBelowTopFace(s, gradient.size());
  double mid = (top + kBandBottom) / 2.0;
  std::optional<double> upper =
      measureArcSag(gradient, top, mid + kBandOverlap);
  std::optional<double> lower =
      measureArcSag(gradient, mid - kBandOverlap, kBandBottom);
  if (!upper.has_value() || !lower.has_value()) return std::nullopt;

  TiltEstimate tilt;
  tilt.sin = s;
  tilt.upperSin = upper.value();
  tilt.lowerSin = lower.value();
  tilt.upperY = (top + mid) / 2.0;
  tilt.lowerY = (mid + kBandBottom) / 2.0;
  return tilt;
}

std::vector<double> rowTiltSins(const TiltEstimate &tilt, int rows) {
  std::vector<double> sins(rows);
  double slope = (tilt.lowerSin - tilt.upperSin) / (tilt.lowerY - tilt.upperY);
  for (int y = 0; y < rows; ++y) {
    double ratio = static_cast<double>(y) / rows;
    sins[y] = clampTilt(tilt.upperSin + slope * (ratio - tilt.upperY));
  }
  return sins;
}

cv::Mat flattenArcs(const cv::Mat &img, const std::vector<double> &rowSin,
                    int borderMode) {
  int width = img.cols;
  double halfSpan = width / 2.0;

  // 列ごとの弧の形 1 - √(1 - u²). 中央で 0, 左右の端で 1.
  std::vector<float> shape(width);
  for (int x = 0; x < width; ++x) {
    double u = (x - halfSpan) / halfSpan;
    shape[x] = static_cast<float>(1.0 - std::sqrt(std::max(0.0, 1.0 - u * u)));
  }

  cv::Mat mapX(img.size(), CV_32F);
  cv::Mat mapY(img.size(), CV_32F);
  for (int y = 0; y < img.rows; ++y) {
    auto *mx = mapX.ptr<float>(y);
    auto *my = mapY.ptr<float>(y);
    auto rise = static_cast<float>(halfSpan * rowSin[y]);
    for (int x = 0; x < width; ++x) {
      mx[x] = static_cast<float>(x);
      my[x] = static_cast<float>(y) - rise * shape[x];
    }
  }

  cv::Mat out;
  cv::remap(img, out, mapX, mapY, cv::INTER_LINEAR, borderMode);
  return out;
}

cv::Mat flattenStack(const cv::Mat &roi, const TiltEstimate &tilt) {
  return flattenArcs(roi, rowTiltSins(tilt, roi.rows), cv::BORDER_REPLICATE);
}

// 角度の推定と枚数の計数で使う, 解析用の縮小の決まり (core の中だけで使う).
// 計数の定数は, 研究 (research/2026-10-30-v2-color-count) で箱の幅を 600px
// にそろえて決めた. 長さの定数は箱の幅に対する比で書き,
// 大きい箱だけ縮めて計算量を抑える. 小さい箱は拡大しない
// (細部を作り出さないため).

#pragma once

#include <algorithm>
#include <opencv2/core.hpp>
#include <opencv2/imgproc.hpp>

//! 解析に使う箱の幅の上限 (px). これより広い箱は縮める.
constexpr double kMaxWorkingWidth = 600.0;

/**
 * @brief 箱の幅から, 解析用の縮小率を決める.
 * @param boxWidth 箱の幅 (元画像の px).
 * @return 縮小率. 1 以下. 箱が kMaxWorkingWidth 以下なら 1.
 */
inline double workingScale(int boxWidth) {
  if (boxWidth <= kMaxWorkingWidth) return 1.0;
  return kMaxWorkingWidth / boxWidth;
}

/**
 * @brief 画像を縮小率に合わせて縮める.
 * @param img 元の画像.
 * @param scale workingScale の縮小率.
 * @return 縮めた画像. scale が 1 なら元の画像をそのまま返す (複製しない).
 */
inline cv::Mat toWorkingScale(const cv::Mat &img, double scale) {
  if (scale >= 1.0) return img;
  cv::Mat out;
  cv::resize(img, out, cv::Size(), scale, scale, cv::INTER_AREA);
  return out;
}

/**
 * @brief 研究で 600px の箱に対して決めた長さを, 解析用の幅での長さにする.
 * @param pixelsAt600 箱の幅 600px のときの長さ (px).
 * @param width 解析用の画像での箱の幅 (px).
 * @return 長さ (px). 1 以上に丸める.
 */
inline int scaledLength(double pixelsAt600, int width) {
  return std::max(1, cvRound(pixelsAt600 * width / kMaxWorkingWidth));
}

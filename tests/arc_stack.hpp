// テスト用の人工のスタックの画像. 合わせ目を, 見下ろし角に応じた弧に描く.

#pragma once

#include <algorithm>
#include <cmath>
#include <opencv2/core.hpp>

/**
 * @brief 斜め上から見たスタックの画像を作る.
 *
 * 行 y の合わせ目は, 列 x で中央より (幅/2) × sin × (1 - √(1 - u²))
 * だけ上に写る (u は中央を 0, 左右の端を ±1 とした横の位置).
 * チップは明るさを交互に変え, 合わせ目は暗い線にする. 上の面は描かない.
 * @param width 画像の幅 (px).
 * @param height 画像の高さ (px).
 * @param tiltSin sin(見下ろし角).
 * @param period チップ 1 枚の高さ (px).
 * @return BGR の画像.
 */
inline cv::Mat makeArcStack(int width, int height, double tiltSin,
                            double period) {
  cv::Mat img(height, width, CV_8UC3);
  double half = width / 2.0;
  for (int x = 0; x < width; ++x) {
    double u = (x - half) / half;
    double rise =
        half * tiltSin * (1.0 - std::sqrt(std::max(0.0, 1.0 - u * u)));
    for (int y = 0; y < height; ++y) {
      // 中央の列での高さに直すと, 合わせ目は等間隔に並ぶ.
      double atCenter = y + rise;
      double phase = std::fmod(atCenter, period);
      int chip = static_cast<int>(std::floor(atCenter / period));
      uchar v = phase < 3.0 ? 30 : (chip % 2 == 0 ? 110 : 160);
      img.at<cv::Vec3b>(y, x) = cv::Vec3b(v, v, v);
    }
  }
  return img;
}

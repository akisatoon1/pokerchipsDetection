// 画像を表示し, ユーザに矩形領域を選ばせる. Linuxでの実験用.

#pragma once

#include <opencv2/core.hpp>
#include <string>

/**
 * @brief 画像を表示し, ユーザに矩形を選ばせる.
 *
 * 画像は画面に収まるサイズに縮小して表示する.
 * @param img 元画像.
 * @param win 表示するウィンドウの名前.
 * @param maxSide 表示する画像の長辺の上限 (px).
 * @return 選ばれた矩形. 元画像の座標系. 選択されなかった場合は空の矩形.
 * @throws cv::Exception GUIなしでビルドしたOpenCVの場合.
 */
cv::Rect selectRoiWithUser(const cv::Mat &img, const std::string &win,
                           int maxSide = 900);

// 画像を表示し, ユーザに矩形領域を選ばせる. Linuxでの実験用.

#pragma once

#include <opencv2/core.hpp>
#include <string>

// 画像を画面に収まるサイズに縮小して表示し, ユーザに矩形を選ばせる.
// 返す矩形は元画像の座標系. 選択されなかった場合は空の矩形.
cv::Rect selectRoiWithUser(const cv::Mat &img, const std::string &win,
                           int maxSide = 900);

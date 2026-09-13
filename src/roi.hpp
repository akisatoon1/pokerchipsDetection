// 画像からユーザが囲んだ矩形領域を切り出す.

#pragma once

#include <opencv2/opencv.hpp>
#include <optional>
#include <string>

// 画像を画面に収まるサイズに縮小して表示し, ユーザに矩形を選ばせる.
// 返す矩形は元画像の座標系. 選択されなかった場合は空の矩形.
cv::Rect selectRoiScaled(const cv::Mat &img, const std::string &win,
                         int maxSide = 900);

// ROIを選択させ, その領域を切り出して返す.
// 選択されなかった場合は nullopt.
// outRect が非nullなら, 選択された矩形を書き込む.
std::optional<cv::Mat> cropSelectedRegion(const cv::Mat &img,
                                          cv::Rect *outRect = nullptr);

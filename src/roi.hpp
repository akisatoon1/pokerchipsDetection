// 画像からユーザが囲んだ矩形領域を切り出す.

#pragma once

#include <opencv2/opencv.hpp>
#include <optional>
#include <string>

// ROIを選択させ, その領域を切り出して返す.
// 選択されなかった場合は nullopt.
// outRect が非nullなら, 選択された矩形を書き込む.
std::optional<cv::Mat> cropSelectedRegion(const cv::Mat &img,
                                          cv::Rect *outRect = nullptr);

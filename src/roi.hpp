// 画像からユーザが囲んだ矩形領域を切り出す.

#pragma once

#include <opencv2/opencv.hpp>
#include <optional>
#include <string>

// YOLOの推論スクリプトを起動し, 検出した矩形を返す.
// 返す矩形は元画像の座標系. 検出に失敗した場合は空の矩形.
// 境界は外側に丸めるので, 画像の端をはみ出しうる.
// 呼び出し側で画像の範囲にクランプすること.
cv::Rect selectRoiWithYOLO(const std::string &imagePath);

// ROIを選択させ, その領域を切り出して返す.
// 選択されなかった場合は nullopt.
// outRect が非nullなら, 選択された矩形を書き込む.
std::optional<cv::Mat> cropSelectedRegion(const cv::Mat &img,
                                          cv::Rect *outRect = nullptr);

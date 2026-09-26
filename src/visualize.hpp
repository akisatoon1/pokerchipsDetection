// カウント結果をデバッグ用に可視化する.

#pragma once

#include <opencv2/opencv.hpp>
#include <vector>

#include "color.hpp"

// ROIの右隣にプロファイルのグラフを並べ, 検出したピークを横線で描く.
// さらにその右に, 各チップの判定色を区間ごとに記載する.
cv::Mat renderDebugView(const cv::Mat &roi, const std::vector<double> &signal,
                        const std::vector<int> &peaks,
                        const std::vector<ChipColor> &colors);

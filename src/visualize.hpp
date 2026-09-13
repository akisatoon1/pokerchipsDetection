// カウント結果をデバッグ用に可視化する.

#pragma once

#include <opencv2/opencv.hpp>
#include <vector>

// ROIの右隣にプロファイルのグラフを並べ, 検出したピークを横線で描く.
cv::Mat renderDebugView(const cv::Mat &roi, const std::vector<double> &signal,
                        const std::vector<int> &peaks);

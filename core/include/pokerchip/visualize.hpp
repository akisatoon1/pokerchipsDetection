// カウント結果をデバッグ用に可視化する.

#pragma once

#include <opencv2/core.hpp>
#include <vector>

#include "pokerchip/color.hpp"

/**
 * @brief カウント結果をデバッグ用の画像にする.
 *
 * ROIの右隣にプロファイルのグラフを並べ, 検出したピークを横線で描く.
 * さらにその右に, 各チップの判定色を区間ごとに記載する.
 * @param roi スタック領域の画像 (BGR).
 * @param signal countChips が返したプロファイル.
 * @param peaks countChips が返した合わせ目の位置.
 * @param colors classifyChipColors が返した各チップの色.
 * @return 3つを横に並べた画像 (BGR). 画面に収まるよう縮小してある.
 */
cv::Mat renderDebugView(const cv::Mat &roi, const std::vector<double> &signal,
                        const std::vector<int> &peaks,
                        const std::vector<ChipColor> &colors);

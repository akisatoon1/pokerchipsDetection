// 合わせ目と合わせ目の間の領域をチップ1枚とみなし, その色を判定する.
// HSVで各画素を色クラスに分類し, 最も画素数の多いクラスをチップの色とする.

#pragma once

#include <opencv2/core.hpp>
#include <string>
#include <vector>

#include "pokerchip/counting.hpp"

enum class ChipColor {
  kRed,
  kBlue,
  kYellow,
  kBlack,
  kGray,
  kPurple,
  kGreen,
  kUnknown
};

// peaks[i] から peaks[i+1] の各区間の色を判定する.
// 戻り値のサイズは result.count で, 上のチップから順に並ぶ.
// どのクラスにも属する画素がない区間は kUnknown.
std::vector<ChipColor> classifyChipColors(const cv::Mat &roi,
                                          const CountResult &result);

// 表示用の色名. cv::putText で描けるようASCIIのみ.
std::string chipColorName(ChipColor c);

// 可視化用の代表色(BGR).
cv::Scalar chipColorBgr(ChipColor c);

// 合わせ目と合わせ目の間の領域をチップ1枚とみなし, その色を判定する.
// HSVで各画素を色クラスに分類し, 最も画素数の多いクラスをチップの色とする.

#pragma once

#include <opencv2/core.hpp>
#include <string>
#include <vector>

#include "pokerchip/counting.hpp"

/**
 * @brief チップの色クラス.
 */
enum class ChipColor {
  kRed,
  kBlue,
  kYellow,
  kBlack,
  kGray,
  kPurple,
  kGreen,

  //! どのクラスにも属さない. 最後に置き, クラス数として使う.
  kUnknown
};

/**
 * @brief peaks[i] から peaks[i+1] の各区間の色を判定する.
 * @param roi スタック領域の画像 (BGR). countChips に渡したもの.
 * @param result roi に対する countChips の結果.
 * @return 各チップの色. サイズは result.count で, 上のチップから順に並ぶ.
 *         どのクラスにも属する画素がない区間は kUnknown.
 */
std::vector<ChipColor> classifyChipColors(const cv::Mat &roi,
                                          const CountResult &result);

/**
 * @brief 表示用の色名を返す.
 * @param c 色クラス.
 * @return 色名. cv::putText で描けるようASCIIのみ.
 */
std::string chipColorName(ChipColor c);

/**
 * @brief 可視化用の代表色を返す.
 * @param c 色クラス.
 * @return 代表色 (BGR).
 */
cv::Scalar chipColorBgr(ChipColor c);

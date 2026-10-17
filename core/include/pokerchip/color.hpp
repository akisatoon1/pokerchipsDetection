// 合わせ目と合わせ目の間の領域をチップ1枚とみなし, その色を判定する.
// チップの白い縞を白の基準にして照明の色と明るさを補正し,
// 各画素を Lab で最も近い基準色のクラスに分類して,
// 最も画素数の多いクラスをチップの色とする.

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
 *         色を判定する画素がない区間は kUnknown.
 */
std::vector<ChipColor> classifyChipColors(const cv::Mat &roi,
                                          const CountResult &result);

/**
 * @brief peaks[i] から peaks[i+1] の各区間の代表色を Lab で求める.
 *
 * classifyChipColors と同じ補正と画素の選び方で, 画素の Lab の中央値をとる.
 * 色判定の基準色 (color.cpp の kReferences) を作り直すときと, デバッグに使う.
 * @param roi スタック領域の画像 (BGR). countChips に渡したもの.
 * @param result roi に対する countChips の結果.
 * @return 各チップの代表色 (L: 0-100, a, b: およそ -127-127).
 *         サイズは result.count で, 上のチップから順に並ぶ.
 *         画素がない区間は (0, 0, 0).
 */
std::vector<cv::Vec3f> measureChipLab(const cv::Mat &roi,
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

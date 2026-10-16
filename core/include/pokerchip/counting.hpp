// 輝度プロファイル法によるチップ枚数のカウント.
// スタック領域を1次元信号に射影し,
// チップの合わせ目(影)の周期を数えて枚数を推定する.

#pragma once

#include <opencv2/core.hpp>
#include <optional>
#include <vector>

/**
 * @brief チップ枚数のカウント結果と, その途中結果.
 */
struct CountResult {
  //! チップ枚数 (peaks.size() - 1)
  int count;

  //! トレンド除去後のプロファイル
  std::vector<double> signal;

  //! 検出した合わせ目の位置
  std::vector<int> peaks;

  //! 推定周期 (px)
  double period;
};

/**
 * @brief 切り出し済みのスタック画像からチップ枚数を数える.
 * @param roi スタック領域の画像 (BGR).
 * @return カウント結果. 周期の推定に失敗した場合や,
 *         ピークが足りない場合は nullopt.
 */
std::optional<CountResult> countChips(const cv::Mat &roi);

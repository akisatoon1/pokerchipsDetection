// 輝度プロファイル法によるチップ枚数のカウント.
// スタック領域を1次元信号に射影し,
// チップの合わせ目(影)の周期を数えて枚数を推定する.

#pragma once

#include <opencv2/opencv.hpp>
#include <optional>
#include <vector>

struct CountResult {
  int count;                   // チップ枚数 (peaks.size() - 1)
  std::vector<double> signal;  // トレンド除去後のプロファイル
  std::vector<int> peaks;      // 検出した合わせ目の位置
  double period;               // 推定周期 (px)
};

// 切り出し済みのスタック画像からチップ枚数を数える.
// 周期の推定に失敗した場合や, ピークが足りない場合は nullopt.
std::optional<CountResult> countChips(const cv::Mat &roi);

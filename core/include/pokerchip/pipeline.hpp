// 画像1枚を解析する一連の処理.
// スタックの検出 -> 枚数のカウント -> 色の判定 をまとめる.
// LinuxのCLIとAndroidのJNIはこのファイルの関数だけを呼ぶ.

#pragma once

#include <opencv2/core.hpp>
#include <optional>
#include <string>
#include <vector>

#include "pokerchip/color.hpp"
#include "pokerchip/counting.hpp"
#include "pokerchip/detector.hpp"

// 1つのスタックの解析結果.
struct StackResult {
  cv::Rect box;                      // 元画像の座標系.
  float score = 1.0F;                // 検出スコア. 手動選択なら 1.
  std::optional<CountResult> count;  // カウントに失敗したら nullopt.
  std::vector<ChipColor> colors;  // 上のチップから順. 失敗時は空.
};

struct AnalysisResult {
  std::vector<StackResult> stacks;  // 左のスタックから順.
};

// 検出器の出力を整数の矩形にする.
// 検出領域が狭いよりは広い方がいいので外側に丸め, 画像の範囲にクランプする.
cv::Rect toPixelRect(const cv::Rect2f &box, const cv::Size &imageSize);

// 指定した領域を1つのスタックとして枚数と色を求める.
// 手動でROIを選ぶ場合 (Linuxでの実験) はこれを直接呼ぶ.
StackResult analyzeRegion(const cv::Mat &bgr, const cv::Rect &region,
                          float score = 1.0F);

// YOLOでスタックを検出し, 見つかったスタックそれぞれを解析する.
AnalysisResult analyzeImage(YoloDetector &detector, const cv::Mat &bgr);

// 解析結果をJSONにする. Androidへの受け渡しと, 環境間の結果比較に使う.
std::string toJson(const AnalysisResult &result);

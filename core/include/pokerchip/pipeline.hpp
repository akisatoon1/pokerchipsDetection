// 画像1枚を解析する一連の処理.
// スタックの検出 -> 見下ろし角の推定 -> 枚数のカウント -> 色の判定 をまとめる.
// LinuxのCLIとAndroidのJNIはこのファイルの関数だけを呼ぶ.

#pragma once

#include <opencv2/core.hpp>
#include <optional>
#include <string>
#include <vector>

#include "pokerchip/color.hpp"
#include "pokerchip/counting.hpp"
#include "pokerchip/detector.hpp"
#include "pokerchip/tilt.hpp"

/**
 * @brief 数えられる sin(見下ろし角) の上限. これ以上の角度のスタックは数えない.
 *
 * 研究 (research/2026-10-30-v2-color-count) では, sin 0.6 (約 37°) 未満で
 * 色別計数 97.7% だったが, それ以上ではどの方法でも 40〜70% にとどまった.
 * 誤った枚数を出すより, 横から撮り直すよう知らせるほうがよいため.
 */
constexpr double kMaxCountableTiltSin = 0.6;

/**
 * @brief スタックを数えられたか.
 */
enum class StackStatus {
  //! 枚数と色を求めた.
  kCounted,

  //! 見下ろし角が kMaxCountableTiltSin 以上で, 数えなかった.
  kTiltTooLarge,

  //! 角度か枚数を求められなかった (領域が空, 小さすぎる, 合わせ目が見えない).
  kCountFailed
};

/**
 * @brief 1つのスタックの解析結果.
 */
struct StackResult {
  //! スタックの領域. 元画像の座標系.
  cv::Rect box;

  //! 検出スコア. 手動選択なら 1.
  float score = 1.0F;

  //! 数えられたか.
  StackStatus status = StackStatus::kCountFailed;

  //! 見下ろし角の推定. 推定に失敗したら nullopt.
  std::optional<TiltEstimate> tilt;

  //! 枚数のカウント結果. 数えなかったら nullopt.
  std::optional<CountResult> count;

  //! 各チップの色. 上のチップから順. 数えなかったら空.
  std::vector<ChipColor> colors;
};

/**
 * @brief 画像1枚の解析結果.
 */
struct AnalysisResult {
  //! 各スタックの解析結果. 左のスタックから順.
  std::vector<StackResult> stacks;
};

/**
 * @brief 検出器の出力を整数の矩形にする.
 *
 * 検出領域が狭いよりは広い方がいいので外側に丸め, 画像の範囲にクランプする.
 * @param box 検出器が返した矩形. 元画像の座標系.
 * @param imageSize 元画像の大きさ.
 * @return 外側に丸めて画像の範囲にクランプした矩形.
 */
cv::Rect toPixelRect(const cv::Rect2f &box, const cv::Size &imageSize);

/**
 * @brief 指定した領域を1つのスタックとして枚数と色を求める.
 *
 * 手動でROIを選ぶ場合 (Linuxでの実験) はこれを直接呼ぶ.
 * 見下ろし角が大きすぎるスタックは数えず, status で知らせる.
 * 色は, 合わせ目の弧を水平に戻した画像 (flattenStack) の区間で判定する.
 * @param bgr 元画像 (BGR).
 * @param region スタックの領域. 画像の範囲外の部分は切り捨てる.
 * @param score 結果に記録する検出スコア.
 * @return 解析結果. 領域が空なら status は kCountFailed で, カウントも色も空.
 */
StackResult analyzeRegion(const cv::Mat &bgr, const cv::Rect &region,
                          float score = 1.0F);

/**
 * @brief 数えられたかを, JSON と表示に使う名前にする.
 * @param status 数えられたか.
 * @return "counted", "tilt_too_large", "count_failed" のいずれか.
 */
std::string stackStatusName(StackStatus status);

/**
 * @brief YOLOでスタックを検出し, 見つかったスタックそれぞれを解析する.
 * @param detector スタックの検出器.
 * @param bgr 元画像 (BGR).
 * @return 解析結果. スタックは左から順に並ぶ.
 * @throws std::invalid_argument 画像が空, または CV_8UC3 でない場合.
 * @throws std::runtime_error 推論の出力の形が想定と違う場合.
 */
AnalysisResult analyzeImage(YoloDetector &detector, const cv::Mat &bgr);

/**
 * @brief 解析結果をJSONにする.
 *
 * Androidへの受け渡しと, 環境間の結果比較に使う.
 * peaks (合わせ目の位置) は元画像でなくROIの上端からのy (px) で出す.
 * Androidでチップごとの区切り線を描くのに使う.
 * status は "counted", "tilt_too_large", "count_failed" のいずれか.
 * tilt は sin(見下ろし角). 推定に失敗したら null.
 * @param result 解析結果.
 * @return JSON 文字列.
 */
std::string toJson(const AnalysisResult &result);

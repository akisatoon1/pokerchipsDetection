// 見下ろし角の推定と, 合わせ目の弧を水平に戻す処理.
// スタックを斜め上から撮ると, チップの合わせ目は中央が低い弧 (楕円の手前の半分)
// に写る. 弧のたわみから sin(見下ろし角) を求め, それを使って弧を水平に戻す.
// 方法は研究 (research/2026-10-30-v2-color-count の研究回 1, 3) による.
// 理由は docs/architecture.md の 12.

#pragma once

#include <opencv2/core.hpp>
#include <optional>
#include <vector>

/**
 * @brief 見下ろし角の推定の結果.
 *
 * 角度は sin(見下ろし角) で表す. 0 は真横, 1 は真上から見下ろした向き.
 * 透視のため下のチップほど見下ろす角度が大きいので, 上と下の帯でも測る.
 */
struct TiltEstimate {
  //! スタック全体の sin(見下ろし角). 0 〜 kMaxTiltSin.
  double sin = 0.0;

  //! 上の帯で測った sin(見下ろし角).
  double upperSin = 0.0;

  //! 下の帯で測った sin(見下ろし角).
  double lowerSin = 0.0;

  //! 上の帯の中心の高さ. ROI の高さに対する比 (0 が上端, 1 が下端).
  double upperY = 0.0;

  //! 下の帯の中心の高さ. ROI の高さに対する比.
  double lowerY = 1.0;
};

/**
 * @brief 推定する sin(見下ろし角) の上限.
 *
 * 弧のたわみの測り方は, 真上に近いと上の面の楕円を拾って大きく外れるため,
 * この値で頭打ちにする (研究と同じ).
 */
constexpr double kMaxTiltSin = 0.95;

/**
 * @brief 切り出したスタックの画像から, 見下ろし角を推定する.
 *
 * 列を少しずつ外へずらしながら縦の明るさの変化の相互相関をとり,
 * ずれを積み上げて合わせ目の弧の形を求める. 弧のたわみ / 半幅 が
 * sin(見下ろし角) になる. 一番上には上の面 (楕円) が写り, 測る帯に入ると
 * 角度を大きく見積もるので, 上の面の縁より下の帯で 2 回測り直す.
 * @param roi スタック領域の画像 (BGR). YOLO の箱を切り出したもの.
 * @return 推定の結果. ROI が小さすぎて測れない場合は nullopt.
 */
std::optional<TiltEstimate> estimateTilt(const cv::Mat &roi);

/**
 * @brief 行ごとの sin(見下ろし角) を, 上と下の帯の値から直線で補う.
 * @param tilt estimateTilt の結果.
 * @param rows 行の数 (ROI の高さ. 縮小した画像でもよい).
 * @return 各行の sin. 長さは rows. 0 〜 kMaxTiltSin に収める.
 */
std::vector<double> rowTiltSins(const TiltEstimate &tilt, int rows);

/**
 * @brief 合わせ目の弧を水平に戻す.
 *
 * 行 y の弧は, 列 x で中央より (幅/2) × sin × (1 - √(1 - u²)) だけ上に写る
 * (u は中央を 0, 左右の端を ±1 とした横の位置). その分だけ下からずらして
 * 読み, 弧を水平にする. 中央の列は動かないので, 中央での y は元の画像と同じ.
 * @param img 画像 (チャンネル数と型は問わない).
 * @param rowSin 行ごとの sin(見下ろし角). 長さは img の行数.
 * @param borderMode 画像の外を読むときの埋め方 (cv::BorderTypes).
 * @return 弧を水平に戻した画像. 大きさと型は img と同じ.
 */
cv::Mat flattenArcs(const cv::Mat &img, const std::vector<double> &rowSin,
                    int borderMode);

/**
 * @brief スタックの画像の合わせ目を, 推定した角度で水平に戻す.
 *
 * 色の判定と確認用の画像で, 区間をチップ 1 枚ずつに分けるために使う.
 * 画像の外は端の画素で埋める.
 * @param roi スタック領域の画像 (BGR).
 * @param tilt roi に対する estimateTilt の結果.
 * @return 弧を水平に戻した画像. 大きさは roi と同じ.
 */
cv::Mat flattenStack(const cv::Mat &roi, const TiltEstimate &tilt);

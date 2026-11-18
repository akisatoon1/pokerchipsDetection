// 見下ろし角を使ったチップ枚数のカウント.
// 合わせ目の弧を水平に戻し, 箱の縦横比と周期から枚数の見当を出す.
// 下端から合わせ目を 1 つずつ追い, 見当の前後から
// 「一番上のチップと, その上の面の境目」が最ももっともらしい枚数を選ぶ.
// 方法は研究 (research/2026-10-30-v2-color-count の v17) による.
// 理由は docs/architecture.md の 12.

#pragma once

#include <opencv2/core.hpp>
#include <optional>
#include <vector>

#include "pokerchip/tilt.hpp"

/**
 * @brief 枚数の見当に使う, 箱の形と周期の特徴.
 *
 * どれも箱の幅に対する比なので, 画像の解像度によらない.
 * 見当の式の係数を当てはめ直すとき (pyscript/fit_count_model.py) にも使う.
 */
struct CountFeatures {
  /**
   * @brief 傾きを補正した箱の高さ / 箱の幅.
   *
   * スタックが左右に傾いていると箱が低く写るので, 傾きの分だけ伸ばす.
   */
  double heightRatio = 0.0;

  /**
   * @brief 行ごとのスタックの幅の中央値 / 箱の幅.
   *
   * チップが左右にずれて積まれると, 箱の幅が 1 枚の直径より広がるため.
   */
  double rowWidthRatio = 1.0;

  //! 合わせ目の周期 / 箱の幅.
  double periodRatio = 0.0;
};

/**
 * @brief 合わせ目で区切った帯の 1 つが, チップの側面らしいかの特徴.
 *
 * 帯は下から数える. 一番上の帯は, 最後の合わせ目から箱の上端まで.
 */
struct BandScore {
  /**
   * @brief 帯の中の行のそろい方 (行と, 帯の中央値の行との相関の平均).
   *
   * チップの側面は縦の縞が上下でそろい, 上の面 (楕円) はそろわない.
   */
  double alignment = 0.0;

  //! 帯の色と, スタックの中ほどの色との Lab の距離 (8bit の Lab).
  double colorDistance = 0.0;
};

/**
 * @brief チップ枚数のカウント結果と, その途中結果.
 */
struct CountResult {
  //! チップ枚数 (peaks.size() - 1)
  int count;

  //! 合わせ目を追った縦の信号. ROI の行ごと (元画像の px).
  std::vector<double> signal;

  /**
   * @brief 合わせ目の位置. ROI の上端からの y (元画像の px). 昇順.
   *
   * 弧を水平に戻した画像での位置で, 中央の列では元の画像の位置と同じ.
   * 先頭は一番上のチップの上の縁, 最後は一番下のチップの下の縁.
   */
  std::vector<int> peaks;

  //! 推定周期 (元画像の px).
  double period;

  //! 枚数の見当に使った特徴.
  CountFeatures features;

  //! 箱の縦横比と周期から出した枚数の見当 (小数).
  double estimate = 0.0;

  //! 合わせ目で区切った帯ごとの特徴. 下の帯から順.
  std::vector<BandScore> bands;
};

/**
 * @brief スタックのチップ枚数を数える.
 *
 * 見下ろし角が大きい写真 (sin 0.6 以上) は想定していない.
 * 呼ぶ側で analyzeRegion のように除いておく.
 * @param bgr 元画像 (BGR). スタックの左右の背景も使う.
 * @param box スタックの領域. 元画像の範囲に収まっていること.
 * @param tilt bgr(box) に対する estimateTilt の結果.
 * @return カウント結果. 周期を測れない場合や,
 *         枚数の見当に合う合わせ目がない場合は nullopt.
 */
std::optional<CountResult> countChips(const cv::Mat &bgr, const cv::Rect &box,
                                      const TiltEstimate &tilt);

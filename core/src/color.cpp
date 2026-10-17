#include "pokerchip/color.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <opencv2/imgproc.hpp>

namespace {

// ---- パラメータ ----------------------------------------------------------

/**
 * @brief 区間の左右端をこの割合だけ削る.
 *
 * YOLO の矩形の余白に写った背景 (机) と, 円柱の側面の端で
 * 光が浅く当たって暗くなったりテカったりする画素を除くため.
 */
const double kSideMarginRatio = 0.15;

/**
 * @brief 区間の上下端をこの割合だけ削る.
 *
 * 合わせ目の影と, 境目の位置がずれたときに入る隣のチップの画素を除くため.
 */
const double kSeamMarginRatio = 0.2;

/**
 * @brief 白の候補にする画素の, 最大のチャンネル値の上限 (0-255).
 *
 * 255 付近に張り付いた画素は本当の明るさが分からず,
 * 照明の強さを小さく見積もってしまうため除く.
 */
const int kWhiteMaxValue = 250;

//! 白の候補にする画素の, 彩度 ((最大 - 最小) / 最大) の上限.
const float kWhiteMaxSaturation = 0.35F;

/**
 * @brief 白の候補のうち, 明るい方から何割を白い縞とみなすか.
 *
 * 候補には灰のチップや影になった縞も入るので, 明るいものだけを使う.
 */
const double kWhiteTopFraction = 0.1;

//! 補正後の Lab で, L がこれより大きく彩度が kStripeMaxChroma 未満なら白い縞.
const float kStripeMinL = 75.0F;

//! 白い縞とみなす彩度 (a, b の原点からの距離) の上限.
const float kStripeMaxChroma = 20.0F;

/**
 * @brief 白い縞を除いた画素がこの割合以下なら, 除かずに全部の画素を使う.
 *
 * 区間のほとんどが白い縞と判定された場合に,
 * 判定する画素がなくならないようにする.
 */
const double kMinColoredFraction = 0.05;

/**
 * @brief 基準色との距離で, L の差に掛ける重み.
 *
 * 明るさは影や照明のむらが残りやすく, a, b より不安定なため軽くする.
 * 黒と灰は L でしか分けられないので 0 にはしない.
 */
const float kLightnessWeight = 0.5F;

//! kUnknown を除いたクラス数. カウント用の配列の大きさに使う.
const int kNumColorClasses = static_cast<int>(ChipColor::kUnknown);

/**
 * @brief 色クラスの基準色.
 */
struct Reference {
  //! 色クラス.
  ChipColor color;

  //! 補正後の Lab の L (0-100).
  float l;

  //! 補正後の Lab の a.
  float a;

  //! 補正後の Lab の b.
  float b;
};

/**
 * @brief 各色クラスの基準色. ChipColor の順に並ぶ.
 *
 * testimages/yoko/stack/multicolor_jpg の正解 (answers.txt) から
 * pyscript/make_color_references.py で求めた, チップの代表色の色ごとの中央値.
 * 今のチップセットに合わせた値なので, チップセットが変わったら作り直す.
 */
const std::array<Reference, kNumColorClasses> kReferences = {{
    {ChipColor::kRed, 35.5F, 35.6F, 22.3F},
    {ChipColor::kBlue, 18.3F, 12.4F, -27.9F},
    {ChipColor::kYellow, 70.0F, 1.9F, 53.0F},
    {ChipColor::kBlack, 9.3F, 0.2F, -2.0F},
    {ChipColor::kGray, 49.4F, -2.3F, -0.9F},
    {ChipColor::kPurple, 37.3F, 27.5F, -7.2F},
    {ChipColor::kGreen, 37.8F, -19.9F, 4.8F},
}};

// ---- 内部処理 ------------------------------------------------------------

/**
 * @brief 値の中央値を返す.
 * @param values 値. 並べ替えるので中身は変わる.
 * @return 中央値. 空なら 0.
 */
float median(std::vector<float> &values) {
  if (values.empty()) return 0.0F;
  auto mid = values.begin() + static_cast<std::ptrdiff_t>(values.size() / 2);
  std::nth_element(values.begin(), mid, values.end());
  return *mid;
}

/**
 * @brief チップの白い縞の色を求める.
 *
 * どのチップにも白い縞があるので, スタックそのものを白の基準に使える.
 * 明るくて色の薄い画素を候補にし, その中で明るい方の画素の中央値を白とする.
 * @param bgr 白を探す画像 (BGR, CV_8UC3).
 * @return 白の色 (BGR, 0-255). 候補の画素がなければ (255, 255, 255) で,
 *         補正しないのと同じになる.
 */
cv::Vec3f estimateWhite(const cv::Mat &bgr) {
  std::vector<cv::Vec3b> candidates;
  std::vector<int> maxValues;
  for (int y = 0; y < bgr.rows; ++y) {
    const auto *row = bgr.ptr<cv::Vec3b>(y);
    for (int x = 0; x < bgr.cols; ++x) {
      const cv::Vec3b &px = row[x];
      int mx = std::max({px[0], px[1], px[2]});
      int mn = std::min({px[0], px[1], px[2]});
      if (mx >= kWhiteMaxValue) continue;
      float saturation = static_cast<float>(mx - mn) / std::max(mx, 1);
      if (saturation >= kWhiteMaxSaturation) continue;
      candidates.push_back(px);
      maxValues.push_back(mx);
    }
  }
  if (candidates.empty()) return {255.0F, 255.0F, 255.0F};

  // 候補のうち明るい方から kWhiteTopFraction に入る画素だけを使う.
  std::vector<int> sorted = maxValues;
  auto nth =
      sorted.begin() + static_cast<std::ptrdiff_t>((sorted.size() - 1) *
                                                   (1.0 - kWhiteTopFraction));
  std::nth_element(sorted.begin(), nth, sorted.end());
  int threshold = *nth;

  std::array<std::vector<float>, 3> channels;
  for (size_t i = 0; i < candidates.size(); ++i) {
    if (maxValues[i] < threshold) continue;
    for (int c = 0; c < 3; ++c) channels[c].push_back(candidates[i][c]);
  }

  return {median(channels[0]), median(channels[1]), median(channels[2])};
}

/**
 * @brief 1区間の, 色を判定する画素の Lab を集める.
 * @param segmentBgr 区間の画像 (BGR, CV_8UC3). 端を削ったもの.
 * @param white スタックの白の色 (BGR). これで割って白を (1, 1, 1) にそろえる.
 * @return 白い縞を除いた画素の Lab. 除くと少なすぎる場合は全部の画素の Lab.
 */
std::vector<cv::Vec3f> collectChipPixels(const cv::Mat &segmentBgr,
                                         const cv::Vec3f &white) {
  // 照明は画素の値に掛け算で効くので, 白の値で割ると打ち消せる.
  cv::Mat corrected;
  segmentBgr.convertTo(corrected, CV_32FC3);
  cv::multiply(
      corrected,
      cv::Scalar(1.0 / std::max(white[0], 1.0F), 1.0 / std::max(white[1], 1.0F),
                 1.0 / std::max(white[2], 1.0F)),
      corrected);
  // float の BGR2Lab は 0-1 を想定しているので, 白より明るい画素は 1 にする.
  cv::min(corrected, 1.0, corrected);

  cv::Mat lab;
  cv::cvtColor(corrected, lab, cv::COLOR_BGR2Lab);

  std::vector<cv::Vec3f> all;
  std::vector<cv::Vec3f> colored;
  for (int y = 0; y < lab.rows; ++y) {
    const auto *row = lab.ptr<cv::Vec3f>(y);
    for (int x = 0; x < lab.cols; ++x) {
      const cv::Vec3f &v = row[x];
      all.push_back(v);
      bool stripe =
          v[0] > kStripeMinL && std::hypot(v[1], v[2]) < kStripeMaxChroma;
      if (!stripe) colored.push_back(v);
    }
  }

  if (static_cast<double>(colored.size()) >
      static_cast<double>(all.size()) * kMinColoredFraction) {
    return colored;
  }
  return all;
}

/**
 * @brief 各区間の, 色を判定する画素を集める.
 *
 * 白の推定も, 左右の端を削った同じ列で行う. 背景を白と取り違えないため.
 * @param roi スタック領域の画像 (BGR). countChips に渡したもの.
 * @param result roi に対する countChips の結果.
 * @return 区間ごとの画素の Lab. 上のチップから順に並ぶ.
 */
std::vector<std::vector<cv::Vec3f>> collectAllChipPixels(
    const cv::Mat &roi, const CountResult &result) {
  int left = static_cast<int>(roi.cols * kSideMarginRatio);
  int right = static_cast<int>(roi.cols * (1.0 - kSideMarginRatio));
  if (right <= left) {
    left = 0;
    right = roi.cols;
  }
  cv::Mat center = roi.colRange(left, right);
  cv::Vec3f white = estimateWhite(center);

  std::vector<std::vector<cv::Vec3f>> pixels;
  for (size_t i = 0; i + 1 < result.peaks.size(); ++i) {
    int top = result.peaks[i];
    int bottom = result.peaks[i + 1];

    int margin = static_cast<int>((bottom - top) * kSeamMarginRatio);
    if (bottom - top - 2 * margin <= 0) margin = 0;

    pixels.push_back(collectChipPixels(
        center.rowRange(top + margin, bottom - margin), white));
  }
  return pixels;
}

/**
 * @brief Lab の値に最も近い基準色のクラスを返す.
 * @param lab 補正後の Lab の値.
 * @return 最も近い基準色のクラス. L の差は kLightnessWeight 倍して測る.
 */
ChipColor nearestReference(const cv::Vec3f &lab) {
  ChipColor best = ChipColor::kUnknown;
  float bestDistance = 0.0F;
  for (const Reference &ref : kReferences) {
    float dl = (lab[0] - ref.l) * kLightnessWeight;
    float da = lab[1] - ref.a;
    float db = lab[2] - ref.b;
    float distance = dl * dl + da * da + db * db;
    if (best == ChipColor::kUnknown || distance < bestDistance) {
      best = ref.color;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * @brief 画素ごとに最も近い基準色のクラスを選び, 最も画素数の多いクラスを返す.
 * @param pixels 1区間の画素の Lab.
 * @return 最も画素数の多いクラス. 画素がなければ kUnknown.
 */
ChipColor classifyPixels(const std::vector<cv::Vec3f> &pixels) {
  std::array<int, kNumColorClasses> counts{};
  for (const cv::Vec3f &p : pixels) {
    ++counts[static_cast<int>(nearestReference(p))];
  }

  int best = -1;
  int bestCount = 0;
  for (int i = 0; i < kNumColorClasses; ++i) {
    if (counts[i] > bestCount) {
      bestCount = counts[i];
      best = i;
    }
  }

  if (best < 0) return ChipColor::kUnknown;
  return static_cast<ChipColor>(best);
}

}  // namespace

std::vector<ChipColor> classifyChipColors(const cv::Mat &roi,
                                          const CountResult &result) {
  std::vector<ChipColor> colors;
  for (const std::vector<cv::Vec3f> &pixels :
       collectAllChipPixels(roi, result)) {
    colors.push_back(classifyPixels(pixels));
  }
  return colors;
}

std::vector<cv::Vec3f> measureChipLab(const cv::Mat &roi,
                                      const CountResult &result) {
  std::vector<cv::Vec3f> labs;
  for (const std::vector<cv::Vec3f> &pixels :
       collectAllChipPixels(roi, result)) {
    std::array<std::vector<float>, 3> channels;
    for (const cv::Vec3f &p : pixels) {
      for (int c = 0; c < 3; ++c) channels[c].push_back(p[c]);
    }
    labs.emplace_back(median(channels[0]), median(channels[1]),
                      median(channels[2]));
  }
  return labs;
}

std::string chipColorName(ChipColor c) {
  switch (c) {
    case ChipColor::kRed:
      return "red";
    case ChipColor::kBlue:
      return "blue";
    case ChipColor::kYellow:
      return "yellow";
    case ChipColor::kBlack:
      return "black";
    case ChipColor::kGray:
      return "gray";
    case ChipColor::kPurple:
      return "purple";
    case ChipColor::kGreen:
      return "green";
    case ChipColor::kUnknown:
      break;
  }
  return "unknown";
}

cv::Scalar chipColorBgr(ChipColor c) {
  switch (c) {
    case ChipColor::kRed:
      return {0, 0, 220};
    case ChipColor::kBlue:
      return {220, 80, 0};
    case ChipColor::kYellow:
      return {0, 220, 240};
    case ChipColor::kBlack:
      return {0, 0, 0};
    case ChipColor::kGray:
      return {128, 128, 128};
    case ChipColor::kPurple:
      return {180, 0, 140};
    case ChipColor::kGreen:
      return {0, 180, 0};
    case ChipColor::kUnknown:
      break;
  }
  return {255, 255, 255};
}

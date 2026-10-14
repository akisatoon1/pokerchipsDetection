#include "pokerchip/color.hpp"

#include <array>
#include <opencv2/imgproc.hpp>
#include <optional>

namespace {

// ---- パラメータ ----------------------------------------------------------
// OpenCVのHSVは H: 0-179, S: 0-255, V: 0-255.

// V がこれ未満なら黒.
const int kBlackMaxV = 50;

// S がこれ未満で, V が kBlackMaxV 以上 kGrayMaxV 未満なら灰.
// V が kGrayMaxV 以上の低彩度画素は白っぽいので無視する.
const int kGrayMaxS = 50;
const int kGrayMaxV = 200;

// 有彩色の色相の範囲. [min, max) で判定する.
// 赤は色相環の両端にまたがるので2つに分ける.
// 紫のチップはマゼンタ寄りで H が 170 付近まで分布するため,
// 赤と紫の境界は 172 にしている (testimages/yoko/stack で確認).
const int kRedLowMaxH = 10;
const int kRedHighMinH = 172;
const int kYellowMinH = 20;
const int kYellowMaxH = 35;
const int kGreenMinH = 30;
const int kGreenMaxH = 90;
const int kBlueMinH = 90;
const int kBlueMaxH = 130;
const int kPurpleMinH = 130;
const int kPurpleMaxH = 172;

// 区間の上下端をこの割合だけ削る.
// 合わせ目の影(暗部)が黒としてカウントされるのを避けるため.
const double kSeamMarginRatio = 0.15;

// kUnknown を除いたクラス数. カウント用の配列の大きさに使う.
const int kNumColorClasses = static_cast<int>(ChipColor::kUnknown);

// ---- 内部処理 ------------------------------------------------------------

// 1画素を色クラスに分類する. どこにも属さない場合は nullopt.
std::optional<ChipColor> classifyPixel(const cv::Vec3b &hsv) {
  int h = hsv[0];
  int s = hsv[1];
  int v = hsv[2];

  if (v < kBlackMaxV) return ChipColor::kBlack;
  if (s < kGrayMaxS) {
    if (v < kGrayMaxV) return ChipColor::kGray;
    return std::nullopt;
  }

  if (h < kRedLowMaxH || h >= kRedHighMinH) return ChipColor::kRed;
  if (h >= kYellowMinH && h < kYellowMaxH) return ChipColor::kYellow;
  if (h >= kBlueMinH && h < kBlueMaxH) return ChipColor::kBlue;
  if (h >= kPurpleMinH && h < kPurpleMaxH) return ChipColor::kPurple;
  if (h >= kGreenMinH && h < kGreenMaxH) return ChipColor::kGreen;

  return std::nullopt;
}

// 区間内の全画素を分類し, 最も画素数の多いクラスを返す.
ChipColor classifySegment(const cv::Mat &segmentBgr) {
  cv::Mat hsv;
  cv::cvtColor(segmentBgr, hsv, cv::COLOR_BGR2HSV);

  std::array<int, kNumColorClasses> counts{};
  for (int y = 0; y < hsv.rows; ++y) {
    for (int x = 0; x < hsv.cols; ++x) {
      std::optional<ChipColor> c = classifyPixel(hsv.at<cv::Vec3b>(y, x));
      if (c.has_value()) ++counts[static_cast<int>(c.value())];
    }
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
  for (size_t i = 0; i + 1 < result.peaks.size(); ++i) {
    int top = result.peaks[i];
    int bottom = result.peaks[i + 1];

    int margin = static_cast<int>((bottom - top) * kSeamMarginRatio);
    if (bottom - top - 2 * margin <= 0) margin = 0;

    colors.push_back(
        classifySegment(roi.rowRange(top + margin, bottom - margin)));
  }

  return colors;
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

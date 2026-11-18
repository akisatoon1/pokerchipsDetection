// 見下ろし角の推定と, 合わせ目の弧を水平に戻す処理のテスト.
// 合わせ目を既知の角度の弧に描いた人工の画像を使う.

#include <gtest/gtest.h>

#include "arc_stack.hpp"
#include "pokerchip/tilt.hpp"

namespace {

//! 推定した sin の許す誤差.
const double kTiltTolerance = 0.02;

}  // namespace

TEST(EstimateTilt, MeasuresArcSag) {
  for (double s : {0.1, 0.3, 0.5}) {
    SCOPED_TRACE(s);
    std::optional<TiltEstimate> tilt =
        estimateTilt(makeArcStack(600, 900, s, 45.0));
    ASSERT_TRUE(tilt.has_value());
    EXPECT_NEAR(tilt->sin, s, kTiltTolerance);
    EXPECT_NEAR(tilt->upperSin, s, kTiltTolerance);
    EXPECT_NEAR(tilt->lowerSin, s, kTiltTolerance);
  }
}

TEST(EstimateTilt, DoesNotDependOnResolution) {
  // 広い箱は解析用に縮めるので,
  // 同じスタックを倍の解像度で写しても同じ角度になる.
  std::optional<TiltEstimate> small =
      estimateTilt(makeArcStack(600, 900, 0.3, 45.0));
  std::optional<TiltEstimate> large =
      estimateTilt(makeArcStack(1200, 1800, 0.3, 90.0));
  ASSERT_TRUE(small.has_value());
  ASSERT_TRUE(large.has_value());
  EXPECT_NEAR(large->sin, small->sin, kTiltTolerance);
}

TEST(EstimateTilt, FailsOnTooLowImage) {
  // 幅に比べて低すぎると, 弧のずれを探す範囲より帯が短くなり測れない.
  EXPECT_FALSE(estimateTilt(makeArcStack(600, 20, 0.3, 5.0)).has_value());
  EXPECT_FALSE(estimateTilt(cv::Mat()).has_value());
}

TEST(FlattenArcs, MakesSeamsHorizontal) {
  const double s = 0.4;
  cv::Mat img = makeArcStack(600, 600, s, 40.0);
  cv::Mat flat = flattenStack(img, TiltEstimate{s, s, s, 0.3, 0.8});

  // 弧を戻すと, どの列も中央の列と同じ明るさの並びになる. 補間の分だけ許す.
  // 上端の近くは画像の外を読むので除く.
  cv::Mat gray;
  cv::extractChannel(flat, gray, 0);
  cv::Mat center = gray.col(img.cols / 2);
  for (int x : {150, 250, 350, 450}) {
    SCOPED_TRACE(x);
    cv::Mat diff;
    cv::absdiff(gray.col(x).rowRange(100, 600), center.rowRange(100, 600),
                diff);
    EXPECT_LT(cv::mean(diff)[0], 5.0);
  }
}

TEST(RowTiltSins, InterpolatesBetweenBands) {
  TiltEstimate tilt{0.3, 0.2, 0.4, 0.25, 0.75};
  std::vector<double> sins = rowTiltSins(tilt, 100);
  ASSERT_EQ(sins.size(), 100U);
  EXPECT_NEAR(sins[25], 0.2, 1e-9);
  EXPECT_NEAR(sins[75], 0.4, 1e-9);
  EXPECT_NEAR(sins[50], 0.3, 1e-9);
  EXPECT_NEAR(sins[0], 0.1, 1e-9);  // 帯の外は直線を延ばす.
}

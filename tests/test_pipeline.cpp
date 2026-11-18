// pipeline の小さな関数のテスト. モデルやテスト画像は使わない.
// 角度の判定は, 合わせ目を弧に描いた人工の画像で確かめる.

#include <gtest/gtest.h>

#include "arc_stack.hpp"
#include "pokerchip/pipeline.hpp"

TEST(ToPixelRect, RoundsOutward) {
  cv::Rect r = toPixelRect(cv::Rect2f(10.2F, 20.7F, 5.5F, 3.1F), {100, 100});
  EXPECT_EQ(r, cv::Rect(10, 20, 6, 4));  // 右下は (15.7, 23.8) -> (16, 24)
}

TEST(ToPixelRect, ClampsToImage) {
  cv::Rect r = toPixelRect(cv::Rect2f(-3.5F, 90.5F, 20.0F, 20.0F), {100, 100});
  EXPECT_EQ(r, cv::Rect(0, 90, 17, 10));
}

TEST(AnalyzeRegion, EmptyRegionHasNoCount) {
  cv::Mat img(50, 50, CV_8UC3, cv::Scalar(0, 0, 0));
  StackResult s = analyzeRegion(img, cv::Rect(60, 60, 10, 10));
  EXPECT_TRUE(s.box.empty());
  EXPECT_EQ(s.status, StackStatus::kCountFailed);
  EXPECT_FALSE(s.tilt.has_value());
  EXPECT_FALSE(s.count.has_value());
  EXPECT_TRUE(s.colors.empty());
}

TEST(AnalyzeRegion, DoesNotCountWhenTiltIsTooLarge) {
  // 真上に近い角度から見たスタック. 数えずに, 角度が大きすぎると返す.
  cv::Mat img = makeArcStack(600, 500, 0.8, 50);
  StackResult s = analyzeRegion(img, cv::Rect(0, 0, img.cols, img.rows));
  ASSERT_TRUE(s.tilt.has_value());
  EXPECT_GE(s.tilt->sin, kMaxCountableTiltSin);
  EXPECT_EQ(s.status, StackStatus::kTiltTooLarge);
  EXPECT_FALSE(s.count.has_value());
  EXPECT_TRUE(s.colors.empty());
}

TEST(ToJson, Format) {
  CountResult count{};
  count.count = 2;
  count.peaks = {0, 10, 20};
  count.period = 10.0;
  TiltEstimate tilt;
  tilt.sin = 0.25;

  AnalysisResult result;
  StackResult counted;
  counted.box = cv::Rect(1, 2, 3, 4);
  counted.score = 0.5F;
  counted.status = StackStatus::kCounted;
  counted.tilt = tilt;
  counted.count = count;
  counted.colors = {ChipColor::kRed, ChipColor::kBlue};
  result.stacks.push_back(counted);
  StackResult failed;
  failed.box = cv::Rect(5, 6, 7, 8);
  result.stacks.push_back(failed);

  EXPECT_EQ(toJson(result),
            "{\"stacks\":["
            "{\"box\":[1,2,3,4],\"score\":0.5,\"status\":\"counted\","
            "\"tilt\":0.25,\"count\":2,"
            "\"peaks\":[0,10,20],\"colors\":[\"red\",\"blue\"]},"
            "{\"box\":[5,6,7,8],\"score\":1,\"status\":\"count_failed\","
            "\"tilt\":null,\"count\":null,\"peaks\":[],\"colors\":[]}"
            "]}");
}

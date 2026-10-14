// pipeline の小さな関数のテスト. モデルやテスト画像は使わない.

#include <gtest/gtest.h>

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
  EXPECT_FALSE(s.count.has_value());
  EXPECT_TRUE(s.colors.empty());
}

TEST(ToJson, Format) {
  CountResult count{2, {}, {0, 10, 20}, 10.0};
  AnalysisResult result;
  result.stacks.push_back(
      {cv::Rect(1, 2, 3, 4), 0.5F, count, {ChipColor::kRed, ChipColor::kBlue}});
  result.stacks.push_back({cv::Rect(5, 6, 7, 8), 1.0F, std::nullopt, {}});

  EXPECT_EQ(toJson(result),
            "{\"stacks\":["
            "{\"box\":[1,2,3,4],\"score\":0.5,\"count\":2,"
            "\"colors\":[\"red\",\"blue\"]},"
            "{\"box\":[5,6,7,8],\"score\":1,\"count\":null,\"colors\":[]}"
            "]}");
}

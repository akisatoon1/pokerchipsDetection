// 色判定のテスト.
// 人工の画像で照明の補正が効くことと, 正解付きの複数色スタック
// (testimages/yoko/stack/multicolor_jpg/answers.txt) での正答率を確かめる.
// 正答率のテストはモデル (models/chip_detector.onnx)
// がない環境ではスキップする.

#include <gtest/gtest.h>

#include <filesystem>
#include <fstream>
#include <iostream>
#include <map>
#include <opencv2/imgcodecs.hpp>
#include <sstream>
#include <string>
#include <vector>

#include "pokerchip/color.hpp"
#include "pokerchip/pipeline.hpp"

namespace {

const std::string kSourceDir = POKERCHIP_SOURCE_DIR;
const std::string kModelPath = kSourceDir + "/models/chip_detector.onnx";
const std::string kImageDir =
    kSourceDir + "/testimages/yoko/stack/multicolor_jpg";

// 基準色は同じ画像から作っているので, 正答率は初見の画像での性能より高く出る.
// 判定の処理を変えたときに大きく崩れていないかを見るための下限.
const double kMinAccuracy = 0.95;

const int kChipHeight = 40;
const int kWidth = 100;

// 赤, 灰, 黒のチップを縦に積んだ人工の画像. どのチップにも白い縦縞を入れる.
cv::Mat makeStack() {
  const cv::Vec3b bodies[] = {{40, 40, 170}, {128, 128, 128}, {30, 30, 30}};
  cv::Mat img(kChipHeight * 3, kWidth, CV_8UC3);
  for (int y = 0; y < img.rows; ++y) {
    for (int x = 0; x < img.cols; ++x) {
      bool stripe = x % 20 < 4;
      img.at<cv::Vec3b>(y, x) =
          stripe ? cv::Vec3b(235, 235, 235) : bodies[y / kChipHeight];
    }
  }
  return img;
}

CountResult stackCount() {
  return {3,
          {},
          {0, kChipHeight, 2 * kChipHeight, 3 * kChipHeight},
          static_cast<double>(kChipHeight)};
}

// 照明の色と明るさを変えた画像. チャンネルごとに倍率を掛ける.
cv::Mat applyLight(const cv::Mat &img, const cv::Scalar &gain) {
  cv::Mat out;
  cv::multiply(img, gain, out);
  return out;
}

// ファイル名 -> スタックごとの色の名前の並び.
std::map<std::string, std::vector<std::vector<std::string>>> loadAnswers() {
  std::map<std::string, std::vector<std::vector<std::string>>> answers;
  std::ifstream in(kImageDir + "/answers.txt");
  std::string line;
  while (std::getline(in, line)) {
    if (line.empty() || line[0] == '#') continue;
    std::istringstream is(line);
    std::string name;
    int count = 0;
    is >> name >> count;
    std::vector<std::string> colors;
    std::string c;
    while (is >> c) colors.push_back(c);
    answers[name].push_back(colors);
  }
  return answers;
}

}  // namespace

TEST(ClassifyChipColors, ClassifiesSyntheticStack) {
  std::vector<ChipColor> colors = classifyChipColors(makeStack(), stackCount());
  EXPECT_EQ(colors, (std::vector<ChipColor>{ChipColor::kRed, ChipColor::kGray,
                                            ChipColor::kBlack}));
}

TEST(ClassifyChipColors, RobustToLightColorAndBrightness) {
  cv::Mat img = makeStack();
  std::vector<cv::Vec3f> base = measureChipLab(img, stackCount());

  // 青みがかった照明, 暖色の照明, 暗い照明. 白い縞が 255 に張り付かない範囲.
  const cv::Scalar lights[] = {
      {1.0, 0.9, 0.75}, {0.7, 0.9, 1.05}, {0.5, 0.5, 0.5}};
  for (const cv::Scalar &light : lights) {
    SCOPED_TRACE(light);
    cv::Mat lit = applyLight(img, light);
    EXPECT_EQ(classifyChipColors(lit, stackCount()),
              classifyChipColors(img, stackCount()));

    // 白で割ると照明が打ち消され, 代表色はほとんど変わらない.
    // 8bit に丸めた誤差の分だけずれるので少し許す.
    std::vector<cv::Vec3f> labs = measureChipLab(lit, stackCount());
    ASSERT_EQ(labs.size(), base.size());
    for (size_t i = 0; i < labs.size(); ++i) {
      for (int c = 0; c < 3; ++c) EXPECT_NEAR(labs[i][c], base[i][c], 2.0);
    }
  }
}

TEST(ClassifyChipColors, MatchesAnswersOfMulticolorStacks) {
  if (!std::filesystem::exists(kModelPath)) {
    GTEST_SKIP() << "model not found: " << kModelPath;
  }

  auto answers = loadAnswers();
  ASSERT_FALSE(answers.empty()) << "answers not found in " << kImageDir;

  YoloDetector detector(kModelPath);
  int total = 0;
  int correct = 0;
  std::ostringstream errors;
  for (const auto &[name, stacks] : answers) {
    cv::Mat img = cv::imread(kImageDir + "/" + name);
    ASSERT_FALSE(img.empty()) << name;
    AnalysisResult result = analyzeImage(detector, img);

    // 検出できなかったスタックや枚数が違うスタックのチップも, 数には入れる.
    for (size_t s = 0; s < stacks.size(); ++s) {
      const std::vector<std::string> &expected = stacks[s];
      total += static_cast<int>(expected.size());
      if (s >= result.stacks.size()) {
        errors << "  " << name << " [stack " << s << "]: not detected\n";
        continue;
      }
      const std::vector<ChipColor> &actual = result.stacks[s].colors;
      for (size_t i = 0; i < expected.size(); ++i) {
        std::string got = i < actual.size() ? chipColorName(actual[i]) : "-";
        if (got == expected[i]) {
          ++correct;
        } else {
          errors << "  " << name << " [stack " << s << "] chip " << i << ": "
                 << expected[i] << " -> " << got << "\n";
        }
      }
    }
  }

  double accuracy = static_cast<double>(correct) / total;
  std::cout << "color accuracy: " << correct << "/" << total << "\n"
            << errors.str();
  EXPECT_GE(accuracy, kMinAccuracy) << errors.str();
}

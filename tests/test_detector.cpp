// C++ (OpenCV DNN) 版の検出器が ultralytics と同じ矩形を返すかを確かめる.
// 基準は pyscript/make_yolo_reference.py で作った
// tests/data/yolo_reference.txt. モデル (models/chip_detector.onnx)
// がない環境ではスキップする.

#include <gtest/gtest.h>

#include <filesystem>
#include <fstream>
#include <map>
#include <opencv2/imgcodecs.hpp>
#include <sstream>
#include <string>
#include <vector>

#include "pokerchip/detector.hpp"

namespace {

const std::string kSourceDir = POKERCHIP_SOURCE_DIR;
const std::string kModelPath = kSourceDir + "/models/chip_detector.onnx";
const std::string kReferencePath =
    kSourceDir + "/tests/data/yolo_reference.txt";

// ultralytics (best.pt) と ONNX では前処理の余白の付け方が少し違うため,
// 完全一致ではなく IoU で比べる.
const double kMinIoU = 0.95;
const float kMaxScoreDiff = 0.05F;

struct RefBox {
  cv::Rect2f box;
  float score;
};

// 画像パス -> 基準の検出結果.
std::map<std::string, std::vector<RefBox>> loadReference() {
  std::map<std::string, std::vector<RefBox>> ref;
  std::ifstream in(kReferencePath);
  std::string line;
  while (std::getline(in, line)) {
    std::istringstream is(line);
    std::string path;
    is >> path;
    if (path.empty()) continue;
    std::vector<RefBox> &boxes = ref[path];
    float x1, y1, x2, y2, score;
    if (is >> x1 >> y1 >> x2 >> y2 >> score) {
      boxes.push_back({cv::Rect2f(x1, y1, x2 - x1, y2 - y1), score});
    }
  }
  return ref;
}

double iou(const cv::Rect2f &a, const cv::Rect2f &b) {
  double inter = (a & b).area();
  double uni = a.area() + b.area() - inter;
  return uni > 0 ? inter / uni : 0.0;
}

}  // namespace

TEST(YoloDetector, MatchesUltralytics) {
  if (!std::filesystem::exists(kModelPath)) {
    GTEST_SKIP() << "model not found: " << kModelPath;
  }

  auto ref = loadReference();
  ASSERT_FALSE(ref.empty()) << "reference not found: " << kReferencePath;

  YoloDetector detector(kModelPath);
  for (const auto &[path, expected] : ref) {
    SCOPED_TRACE(path);
    cv::Mat img = cv::imread(kSourceDir + "/" + path);
    ASSERT_FALSE(img.empty());

    std::vector<Detection> dets = detector.detect(img);
    ASSERT_EQ(dets.size(), expected.size());

    // どちらもスコアの高い順に並んでいる.
    for (size_t i = 0; i < dets.size(); ++i) {
      EXPECT_GE(iou(dets[i].box, expected[i].box), kMinIoU)
          << "C++: " << dets[i].box << " ref: " << expected[i].box;
      EXPECT_NEAR(dets[i].score, expected[i].score, kMaxScoreDiff);
    }
  }
}

TEST(YoloDetector, LoadsFromMemory) {
  if (!std::filesystem::exists(kModelPath)) {
    GTEST_SKIP() << "model not found: " << kModelPath;
  }

  // Android の assets と同じく, バイト列から読み込めることを確かめる.
  std::ifstream in(kModelPath, std::ios::binary);
  std::vector<uchar> data((std::istreambuf_iterator<char>(in)),
                          std::istreambuf_iterator<char>());

  YoloDetector fromFile(kModelPath);
  YoloDetector fromMemory(data);

  cv::Mat img = cv::imread(kSourceDir +
                           "/testimages/yoko/stack/singlecolor/IMG_5587.jpg");
  ASSERT_FALSE(img.empty());

  std::vector<Detection> a = fromFile.detect(img);
  std::vector<Detection> b = fromMemory.detect(img);
  ASSERT_EQ(a.size(), b.size());
  for (size_t i = 0; i < a.size(); ++i) {
    EXPECT_EQ(a[i].box, b[i].box);
    EXPECT_EQ(a[i].score, b[i].score);
  }
}

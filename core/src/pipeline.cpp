#include "pokerchip/pipeline.hpp"

#include <algorithm>
#include <cmath>
#include <sstream>

cv::Rect toPixelRect(const cv::Rect2f &box, const cv::Size &imageSize) {
  int left = static_cast<int>(std::floor(box.x));
  int top = static_cast<int>(std::floor(box.y));
  int right = static_cast<int>(std::ceil(box.x + box.width));
  int bottom = static_cast<int>(std::ceil(box.y + box.height));

  cv::Rect rect(left, top, right - left, bottom - top);
  return rect & cv::Rect(0, 0, imageSize.width, imageSize.height);
}

StackResult analyzeRegion(const cv::Mat &bgr, const cv::Rect &region,
                          float score) {
  StackResult stack;
  stack.box = region & cv::Rect(0, 0, bgr.cols, bgr.rows);
  stack.score = score;
  if (stack.box.empty()) return stack;

  cv::Mat roi = bgr(stack.box);
  stack.count = countChips(roi);
  if (stack.count.has_value()) {
    stack.colors = classifyChipColors(roi, stack.count.value());
  }
  return stack;
}

AnalysisResult analyzeImage(YoloDetector &detector, const cv::Mat &bgr) {
  std::vector<Detection> dets = detector.detect(bgr);

  // 結果の順番を画像上の位置で決めておく. 表示や比較がしやすいため.
  std::sort(
      dets.begin(), dets.end(),
      [](const Detection &a, const Detection &b) { return a.box.x < b.box.x; });

  AnalysisResult result;
  for (const Detection &d : dets) {
    cv::Rect region = toPixelRect(d.box, bgr.size());
    result.stacks.push_back(analyzeRegion(bgr, region, d.score));
  }
  return result;
}

std::string toJson(const AnalysisResult &result) {
  // 依存を増やさないよう手で組み立てる. 文字列は色名 (ASCII) のみ.
  std::ostringstream os;
  os << "{\"stacks\":[";
  for (size_t i = 0; i < result.stacks.size(); ++i) {
    const StackResult &s = result.stacks[i];
    if (i > 0) os << ",";
    os << "{\"box\":[" << s.box.x << "," << s.box.y << "," << s.box.width << ","
       << s.box.height << "],\"score\":" << s.score << ",\"count\":";
    if (s.count.has_value()) {
      os << s.count->count;
    } else {
      os << "null";
    }
    os << ",\"peaks\":[";
    if (s.count.has_value()) {
      const std::vector<int> &peaks = s.count->peaks;
      for (size_t j = 0; j < peaks.size(); ++j) {
        if (j > 0) os << ",";
        os << peaks[j];
      }
    }
    os << "],\"colors\":[";
    for (size_t j = 0; j < s.colors.size(); ++j) {
      if (j > 0) os << ",";
      os << "\"" << chipColorName(s.colors[j]) << "\"";
    }
    os << "]}";
  }
  os << "]}";
  return os.str();
}

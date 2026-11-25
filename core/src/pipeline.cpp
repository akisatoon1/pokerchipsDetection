#include "pokerchip/pipeline.hpp"

#include <algorithm>
#include <cmath>
#include <sstream>

namespace {

/**
 * @brief 手前のスタックとみなす, 箱の幅の下限.
 * 画像の中でいちばん広い箱の幅に対する比.
 *
 * チップの直径は決まっているので, 箱の幅は距離に反比例する.
 * いちばん広い箱を手前のスタックとし,
 * それより十分に狭い箱は奥に写ったスタックとして数えない (issue #3).
 * 幅の比は, 横に並べた手前のスタック同士では 0.87 以上, 奥のスタックでは 0.68
 * 以下だった. 手前のスタックを落とさない側に寄せて 0.75 にした. 根拠は
 * docs/logic/adr.md の ADR-2.
 */
const float kNearStackMinWidthRatio = 0.75F;

/**
 * @brief 奥に写ったスタックの検出を除く.
 *
 * 画像の端で切れたスタックは箱が狭くなるので, 手前にあっても除かれることがある.
 * @param detections 検出したスタック.
 * @return 幅がいちばん広い箱の kNearStackMinWidthRatio 倍以上の検出.
 * 元の並びを保つ.
 */
std::vector<Detection> removeFarStacks(
    const std::vector<Detection> &detections) {
  float maxWidth = 0.0F;
  for (const Detection &d : detections) {
    maxWidth = std::max(maxWidth, d.box.width);
  }

  std::vector<Detection> nearStacks;
  for (const Detection &d : detections) {
    if (d.box.width >= maxWidth * kNearStackMinWidthRatio) {
      nearStacks.push_back(d);
    }
  }
  return nearStacks;
}

}  // namespace

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
  std::vector<Detection> dets = removeFarStacks(detector.detect(bgr));

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

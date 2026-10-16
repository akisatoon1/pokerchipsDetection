#include "pokerchip/detector.hpp"

#include <algorithm>
#include <cmath>
#include <opencv2/imgproc.hpp>
#include <stdexcept>

namespace {

//! ultralytics の letterbox と同じ余白の色.
const cv::Scalar kPadColor(114, 114, 114);

//! end2end 形式の出力 [1, N, 6] の最後の次元の大きさ.
const int kEnd2EndFields = 6;

/**
 * @brief 元画像をアスペクト比を保ったまま正方形に収め, 余白を埋めた画像.
 *
 * 推論結果を元画像の座標に戻すため, 縮小率と余白の量も持つ.
 */
struct Letterbox {
  //! 余白を埋めた正方形の画像 (BGR).
  cv::Mat image;

  //! 元画像に掛けた縮小率.
  double scale;

  //! 左の余白 (px).
  int padLeft;

  //! 上の余白 (px).
  int padTop;
};

/**
 * @brief 画像をアスペクト比を保ったまま正方形に収め, 余白を埋める.
 *
 * ultralytics の LetterBox(auto=False, center=True) と同じ計算をする.
 * 前処理が違うと検出結果がずれるため, 丸め方まで合わせている.
 * @param bgr 元画像 (BGR).
 * @param size 正方形の一辺 (px).
 * @return 余白を埋めた画像と, 座標を戻すための縮小率と余白の量.
 */
Letterbox letterbox(const cv::Mat &bgr, int size) {
  double scale = std::min(static_cast<double>(size) / bgr.rows,
                          static_cast<double>(size) / bgr.cols);
  int newW = static_cast<int>(std::round(bgr.cols * scale));
  int newH = static_cast<int>(std::round(bgr.rows * scale));

  double dw = (size - newW) / 2.0;
  double dh = (size - newH) / 2.0;
  int top = static_cast<int>(std::round(dh - 0.1));
  int bottom = static_cast<int>(std::round(dh + 0.1));
  int left = static_cast<int>(std::round(dw - 0.1));
  int right = static_cast<int>(std::round(dw + 0.1));

  cv::Mat resized;
  if (newW != bgr.cols || newH != bgr.rows) {
    cv::resize(bgr, resized, cv::Size(newW, newH), 0, 0, cv::INTER_LINEAR);
  } else {
    resized = bgr;
  }

  Letterbox lb;
  cv::copyMakeBorder(resized, lb.image, top, bottom, left, right,
                     cv::BORDER_CONSTANT, kPadColor);
  lb.scale = scale;
  lb.padLeft = left;
  lb.padTop = top;
  return lb;
}

/**
 * @brief letterbox 後の座標を元画像の座標に戻し, 画像の範囲に収める.
 * @param box letterbox 後の画像の座標系の矩形.
 * @param lb 推論に使った letterbox.
 * @param imageSize 元画像の大きさ.
 * @return 元画像の座標系の矩形.
 */
cv::Rect2f toOriginal(const cv::Rect2d &box, const Letterbox &lb,
                      const cv::Size &imageSize) {
  auto mapX = [&](double x) {
    double v = (x - lb.padLeft) / lb.scale;
    return static_cast<float>(
        std::clamp(v, 0.0, static_cast<double>(imageSize.width)));
  };
  auto mapY = [&](double y) {
    double v = (y - lb.padTop) / lb.scale;
    return static_cast<float>(
        std::clamp(v, 0.0, static_cast<double>(imageSize.height)));
  };

  float left = mapX(box.x);
  float top = mapY(box.y);
  return {left, top, mapX(box.x + box.width) - left,
          mapY(box.y + box.height) - top};
}

/**
 * @brief NMS 前の検出候補. 座標は letterbox 後の画像の座標系.
 *
 * 3つの配列は同じ長さで, 同じ添字が同じ候補を表す.
 */
struct Candidates {
  //! 候補の矩形.
  std::vector<cv::Rect2d> boxes;

  //! 候補のスコア.
  std::vector<float> scores;

  //! 候補のクラス番号.
  std::vector<int> classIds;
};

/**
 * @brief end2end 形式の出力から検出候補を取り出す.
 *
 * end2end 形式 [1, N, 6]. 各行は (x1, y1, x2, y2, score, class).
 * @param out ネットワークの出力.
 * @param scoreThreshold これ未満のスコアの候補は捨てる.
 * @return 検出候補.
 */
Candidates parseEnd2End(const cv::Mat &out, float scoreThreshold) {
  int n = out.size[1];
  const auto *data = out.ptr<float>();

  Candidates c;
  for (int i = 0; i < n; ++i) {
    const float *r = data + static_cast<ptrdiff_t>(i) * kEnd2EndFields;
    if (r[4] < scoreThreshold) continue;
    c.boxes.emplace_back(r[0], r[1], r[2] - r[0], r[3] - r[1]);
    c.scores.push_back(r[4]);
    c.classIds.push_back(static_cast<int>(r[5]));
  }
  return c;
}

/**
 * @brief NMS 前の生出力から検出候補を取り出す.
 *
 * NMS 前の生出力 [1, 4+nc, A]. 各列が1つのアンカーで,
 * 先頭4行が (cx, cy, w, h), 残りがクラスごとのスコア.
 * 各アンカーは最もスコアの高いクラスの候補とする.
 * @param out ネットワークの出力.
 * @param scoreThreshold これ未満のスコアの候補は捨てる.
 * @return 検出候補.
 */
Candidates parseRaw(const cv::Mat &out, float scoreThreshold) {
  int channels = out.size[1];
  int anchors = out.size[2];
  int numClasses = channels - 4;
  const auto *data = out.ptr<float>();
  auto at = [&](int row, int col) {
    return data[static_cast<ptrdiff_t>(row) * anchors + col];
  };

  Candidates c;
  for (int a = 0; a < anchors; ++a) {
    int bestClass = 0;
    float bestScore = at(4, a);
    for (int k = 1; k < numClasses; ++k) {
      if (at(4 + k, a) > bestScore) {
        bestScore = at(4 + k, a);
        bestClass = k;
      }
    }
    if (bestScore < scoreThreshold) continue;

    float cx = at(0, a);
    float cy = at(1, a);
    float w = at(2, a);
    float h = at(3, a);
    c.boxes.emplace_back(cx - w / 2, cy - h / 2, w, h);
    c.scores.push_back(bestScore);
    c.classIds.push_back(bestClass);
  }
  return c;
}

}  // namespace

YoloDetector::YoloDetector(const std::string &modelPath,
                           const DetectorConfig &config)
    : net_(cv::dnn::readNetFromONNX(modelPath)), config_(config) {
  setupNet();
}

YoloDetector::YoloDetector(const std::vector<uchar> &modelData,
                           const DetectorConfig &config)
    : net_(cv::dnn::readNetFromONNX(modelData)), config_(config) {
  setupNet();
}

/**
 * @brief 読み込んだネットワークを確かめ, 推論の計算経路を設定する.
 * @throws std::runtime_error モデルが空の場合.
 */
void YoloDetector::setupNet() {
  if (net_.empty()) throw std::runtime_error("Failed to load ONNX model.");

  // 環境によって計算経路が変わらないよう, OpenCV の CPU 実装に固定する.
  net_.setPreferableBackend(cv::dnn::DNN_BACKEND_OPENCV);
  net_.setPreferableTarget(cv::dnn::DNN_TARGET_CPU);
}

std::vector<Detection> YoloDetector::detect(const cv::Mat &bgr) {
  if (bgr.empty() || bgr.type() != CV_8UC3) {
    throw std::invalid_argument("detect: expected a non-empty CV_8UC3 image.");
  }

  Letterbox lb = letterbox(bgr, config_.inputSize);

  // BGR -> RGB, 0-255 -> 0-1, HWC -> NCHW.
  cv::Mat blob = cv::dnn::blobFromImage(lb.image, 1.0 / 255.0, cv::Size(),
                                        cv::Scalar(), true, false, CV_32F);
  net_.setInput(blob);
  cv::Mat out = net_.forward();

  if (out.dims != 3 || out.size[0] != 1) {
    throw std::runtime_error("detect: unexpected output shape.");
  }

  // 出力の形で形式を判別する. 理由は docs/architecture.md を参照.
  Candidates c = out.size[2] == kEnd2EndFields
                     ? parseEnd2End(out, config_.scoreThreshold)
                     : parseRaw(out, config_.scoreThreshold);

  // クラスごとに NMS をかける (ultralytics の agnostic=False と同じ).
  // end2end 形式は本来 NMS 不要だが, 同じスタックを重複して出すことがあったため
  // (testimages/yoko/stack/singlecolor/IMG_5591.jpg), こちらにもかける.
  std::vector<int> keep;
  cv::dnn::NMSBoxesBatched(c.boxes, c.scores, c.classIds,
                           config_.scoreThreshold, config_.nmsThreshold, keep);

  std::vector<Detection> dets;
  for (int i : keep) {
    dets.push_back(
        {toOriginal(c.boxes[i], lb, bgr.size()), c.scores[i], c.classIds[i]});
  }

  std::sort(
      dets.begin(), dets.end(),
      [](const Detection &a, const Detection &b) { return a.score > b.score; });
  return dets;
}

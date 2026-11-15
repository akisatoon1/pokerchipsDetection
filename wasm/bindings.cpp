// JavaScript (web/src/client/detector.ts) から core を呼ぶための WASM の殻.
// ロジックはここに書かない. 型の変換と失敗の受け渡しだけを行う (android の
// jni_bridge.cpp と同じ役目).
//
// 失敗は例外のまま JS に渡さず, { ok: false, error } の形で返す.
// WASM の例外は JS からはメッセージを読めない物になり,
// 呼ぶ側が理由を出せないため.

#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <cstddef>
#include <exception>
#include <memory>
#include <opencv2/imgproc.hpp>
#include <string>
#include <vector>

#include "pokerchip/detector.hpp"
#include "pokerchip/pipeline.hpp"

namespace {

//! RGBA の 1 画素のバイト数.
const int kRgbaChannels = 4;

/**
 * @brief 成功を表す JS のオブジェクトを作る.
 * @param key 値を入れる項目の名前.
 * @param value 値.
 * @return { ok: true, <key>: value }.
 */
emscripten::val success(const char *key, const emscripten::val &value) {
  emscripten::val result = emscripten::val::object();
  result.set("ok", true);
  result.set(key, value);
  return result;
}

/**
 * @brief 失敗を表す JS のオブジェクトを作る.
 * @param message 失敗の理由.
 * @return { ok: false, error: message }.
 */
emscripten::val failure(const std::string &message) {
  emscripten::val result = emscripten::val::object();
  result.set("ok", false);
  result.set("error", message);
  return result;
}

/**
 * @brief スタックの検出器を持ち, 画像を解析する.
 *
 * JS からは createDetector で作り, 使い終わったら delete() で解放する.
 * cv::dnn::Net はスレッドセーフでないが, WASM は 1
 * スレッドで動かすので直列化は要らない.
 */
class Detector {
 public:
  /**
   * @brief 検出器を受け取る.
   * @param detector 読み込み済みの検出器.
   */
  explicit Detector(std::unique_ptr<YoloDetector> detector)
      : detector_(std::move(detector)) {}

  /**
   * @brief RGBA の画像を解析する.
   *
   * ブラウザの ImageData の形 (1 行に隙間のない RGBA) をそのまま受け取る.
   * @param pixels RGBA の画素 (Uint8Array または Uint8ClampedArray).
   * @param width 画像の幅 (px).
   * @param height 画像の高さ (px).
   * @return { ok: true, json } (json は core の toJson の形).
   *         失敗したら { ok: false, error }.
   */
  emscripten::val analyze(const emscripten::val &pixels, int width,
                          int height) {
    try {
      if (width <= 0 || height <= 0) return failure("Image is empty.");
      std::vector<uchar> rgba =
          emscripten::convertJSArrayToNumberVector<uchar>(pixels);
      const std::size_t expected = static_cast<std::size_t>(width) *
                                   static_cast<std::size_t>(height) *
                                   kRgbaChannels;
      if (rgba.size() != expected) {
        return failure("Pixel data does not match the image size.");
      }

      cv::Mat rgbaMat(height, width, CV_8UC4, rgba.data());
      cv::Mat bgr;
      cv::cvtColor(rgbaMat, bgr, cv::COLOR_RGBA2BGR);
      AnalysisResult result = analyzeImage(*detector_, bgr);
      return success("json", emscripten::val(toJson(result)));
    } catch (const std::exception &e) {
      return failure(e.what());
    }
  }

 private:
  //! スタックの検出器.
  std::unique_ptr<YoloDetector> detector_;
};

/**
 * @brief ONNX モデルのバイト列から検出器を作る.
 * @param model ONNX ファイルの中身 (Uint8Array).
 * @return { ok: true, detector }. 読めなければ { ok: false, error }.
 */
emscripten::val createDetector(const emscripten::val &model) {
  try {
    std::vector<uchar> data =
        emscripten::convertJSArrayToNumberVector<uchar>(model);
    auto detector = std::make_unique<YoloDetector>(data);
    // 持ち主は JS に移る. JS の delete() で解放される.
    auto *handle = new Detector(std::move(detector));  // NOLINT
    return success("detector",
                   emscripten::val(handle, emscripten::allow_raw_pointers()));
  } catch (const std::exception &e) {
    return failure(e.what());
  }
}

}  // namespace

EMSCRIPTEN_BINDINGS(pokerchip) {
  emscripten::class_<Detector>("Detector")
      .function("analyze", &Detector::analyze);
  emscripten::function("createDetector", &createDetector);
}

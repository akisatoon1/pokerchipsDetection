// Kotlin (PokerChipNative.kt) から core を呼ぶための JNI の殻.
// ロジックはここに書かない. 型の変換と例外の受け渡しだけを行う.

#include <android/bitmap.h>
#include <jni.h>

#include <exception>
#include <memory>
#include <opencv2/imgproc.hpp>
#include <string>
#include <vector>

#include "pokerchip/detector.hpp"
#include "pokerchip/pipeline.hpp"

namespace {

void throwJava(JNIEnv *env, const char *message) {
  jclass cls = env->FindClass("java/lang/RuntimeException");
  if (cls != nullptr) env->ThrowNew(cls, message);
}

YoloDetector *fromHandle(jlong handle) {
  return reinterpret_cast<YoloDetector *>(handle);  // NOLINT
}

// ARGB_8888 の Bitmap を BGR の cv::Mat にコピーする.
// 戻り値が空なら Java の例外を投げ済み.
cv::Mat bitmapToBgr(JNIEnv *env, jobject bitmap) {
  AndroidBitmapInfo info;
  if (AndroidBitmap_getInfo(env, bitmap, &info) !=
          ANDROID_BITMAP_RESULT_SUCCESS ||
      info.format != ANDROID_BITMAP_FORMAT_RGBA_8888) {
    throwJava(env, "Bitmap must be ARGB_8888.");
    return {};
  }

  void *pixels = nullptr;
  if (AndroidBitmap_lockPixels(env, bitmap, &pixels) !=
      ANDROID_BITMAP_RESULT_SUCCESS) {
    throwJava(env, "Failed to lock bitmap pixels.");
    return {};
  }

  cv::Mat rgba(static_cast<int>(info.height), static_cast<int>(info.width),
               CV_8UC4, pixels, info.stride);
  cv::Mat bgr;
  try {
    cv::cvtColor(rgba, bgr, cv::COLOR_RGBA2BGR);
  } catch (...) {
    AndroidBitmap_unlockPixels(env, bitmap);
    throw;
  }
  AndroidBitmap_unlockPixels(env, bitmap);
  return bgr;
}

}  // namespace

extern "C" {

// ONNX モデルのバイト列から検出器を作り, ハンドルを返す.
JNIEXPORT jlong JNICALL Java_com_pokerchip_app_PokerChipNative_nativeCreate(
    JNIEnv *env, jobject /*thiz*/, jbyteArray model) {
  try {
    jsize len = env->GetArrayLength(model);
    std::vector<uchar> data(static_cast<size_t>(len));
    env->GetByteArrayRegion(model, 0, len,
                            reinterpret_cast<jbyte *>(data.data()));  // NOLINT
    auto detector = std::make_unique<YoloDetector>(data);
    return reinterpret_cast<jlong>(detector.release());  // NOLINT
  } catch (const std::exception &e) {
    throwJava(env, e.what());
    return 0;
  }
}

// 画像を解析し, 結果を JSON 文字列で返す (形式は core の toJson).
JNIEXPORT jstring JNICALL Java_com_pokerchip_app_PokerChipNative_nativeAnalyze(
    JNIEnv *env, jobject /*thiz*/, jlong handle, jobject bitmap) {
  try {
    cv::Mat bgr = bitmapToBgr(env, bitmap);
    if (bgr.empty()) return nullptr;

    AnalysisResult result = analyzeImage(*fromHandle(handle), bgr);
    return env->NewStringUTF(toJson(result).c_str());
  } catch (const std::exception &e) {
    throwJava(env, e.what());
    return nullptr;
  }
}

JNIEXPORT void JNICALL Java_com_pokerchip_app_PokerChipNative_nativeRelease(
    JNIEnv * /*env*/, jobject /*thiz*/, jlong handle) {
  delete fromHandle(handle);
}

}  // extern "C"

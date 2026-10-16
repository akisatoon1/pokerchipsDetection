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

/**
 * @brief Java 側に RuntimeException を投げる.
 *
 * 例外は native から戻った時点で Java 側に伝わる.
 * @param env JNI の環境.
 * @param message 例外のメッセージ.
 */
void throwJava(JNIEnv *env, const char *message) {
  jclass cls = env->FindClass("java/lang/RuntimeException");
  if (cls != nullptr) env->ThrowNew(cls, message);
}

/**
 * @brief Kotlin 側が持つハンドルを検出器のポインタに戻す.
 * @param handle nativeCreate が返したハンドル.
 * @return 検出器のポインタ.
 */
YoloDetector *fromHandle(jlong handle) {
  return reinterpret_cast<YoloDetector *>(handle);  // NOLINT
}

/**
 * @brief ARGB_8888 の Bitmap を BGR の cv::Mat にコピーする.
 * @param env JNI の環境.
 * @param bitmap ARGB_8888 の Bitmap.
 * @return BGR の画像. 空なら Java の例外を投げ済み.
 * @throws cv::Exception 色の変換に失敗した場合.
 */
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

/**
 * @brief ONNX モデルのバイト列から検出器を作り, ハンドルを返す.
 *
 * 失敗した場合は Java の RuntimeException を投げる.
 * @param env JNI の環境.
 * @param model ONNX ファイルの中身.
 * @return 検出器のハンドル. nativeRelease で解放する. 失敗時は 0.
 */
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

/**
 * @brief 画像を解析し, 結果を JSON 文字列で返す (形式は core の toJson).
 *
 * 失敗した場合は Java の RuntimeException を投げる.
 * @param env JNI の環境.
 * @param handle nativeCreate が返したハンドル.
 * @param bitmap 解析する画像 (ARGB_8888).
 * @return 解析結果の JSON. 失敗時は null.
 */
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

/**
 * @brief nativeCreate で作った検出器を解放する.
 * @param handle nativeCreate が返したハンドル.
 */
JNIEXPORT void JNICALL Java_com_pokerchip_app_PokerChipNative_nativeRelease(
    JNIEnv * /*env*/, jobject /*thiz*/, jlong handle) {
  delete fromHandle(handle);
}

}  // extern "C"

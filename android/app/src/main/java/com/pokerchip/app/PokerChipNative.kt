package com.pokerchip.app

import android.graphics.Bitmap

/**
 * C++ の core (リポジトリ直下の core/) を呼ぶ JNI のラッパー.
 * 中身は src/main/cpp/jni_bridge.cpp.
 *
 * 内部の cv::dnn::Net はスレッドセーフでないので, [analyze] を複数スレッドから
 * 同時に呼ばないこと.
 */
class PokerChipNative(model: ByteArray) : AutoCloseable {
    private var handle: Long = nativeCreate(model)

    /** ARGB_8888 の画像を解析し, 結果を返す. */
    fun analyze(bitmap: Bitmap): AnalysisResult {
        check(handle != 0L) { "already closed" }
        require(bitmap.config == Bitmap.Config.ARGB_8888) { "bitmap must be ARGB_8888" }
        return AnalysisResult.fromJson(nativeAnalyze(handle, bitmap))
    }

    override fun close() {
        if (handle != 0L) {
            nativeRelease(handle)
            handle = 0L
        }
    }

    private external fun nativeCreate(model: ByteArray): Long
    private external fun nativeAnalyze(handle: Long, bitmap: Bitmap): String
    private external fun nativeRelease(handle: Long)

    companion object {
        init {
            System.loadLibrary("pokerchip_jni")
        }
    }
}

package com.pokerchip.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.ColorSpace
import android.graphics.ImageDecoder
import android.net.Uri

/**
 * Uri から画像を読み込み, EXIF の向きを反映した ARGB_8888 の Bitmap にする.
 *
 * Linux 側の cv::imread も EXIF の向きを反映するので, それと揃えるため.
 * ImageDecoder は向きを自動で反映するので, 回転は自分でしなくてよい.
 */
object ImageLoader {
    fun load(context: Context, uri: Uri): Bitmap {
        val source = ImageDecoder.createSource(context.contentResolver, uri)
        val bitmap = ImageDecoder.decodeBitmap(source) { decoder, _, _ ->
            // JNI で画素を直接読むので, GPU 上に置かれる HARDWARE の Bitmap は使えない.
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            decoder.setTargetColorSpace(ColorSpace.get(ColorSpace.Named.SRGB))
        }
        // HDR や 10bit の画像は ARGB_8888 以外で出てくるので, native が読める形に揃える.
        if (bitmap.config == Bitmap.Config.ARGB_8888) return bitmap
        val converted = bitmap.copy(Bitmap.Config.ARGB_8888, false)
            ?: error("画像を ARGB_8888 に変換できませんでした: $uri")
        bitmap.recycle()
        return converted
    }
}

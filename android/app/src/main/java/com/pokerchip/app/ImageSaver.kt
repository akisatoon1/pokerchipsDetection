package com.pokerchip.app

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import android.webkit.MimeTypeMap

/**
 * 解析した画像を, デバッグ用に共有の Pictures/PokerChip/ へ保存する.
 *
 * Linux の CLI で同じ結果を再現できるように, Bitmap を圧縮し直さず元のファイルをそのままコピーする.
 * 自分のアプリが MediaStore に作るファイルなので, 権限は要らない.
 */
object ImageSaver {
    private const val DIR = "PokerChip"

    /** source を Pictures/PokerChip/ にコピーし, 保存したファイル名を返す. */
    fun save(context: Context, source: Uri): String {
        val resolver = context.contentResolver
        val mimeType = resolver.getType(source) ?: "image/jpeg"
        val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType) ?: "jpg"
        val name = "pokerchip_${System.currentTimeMillis()}.$ext"
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, name)
            put(MediaStore.Images.Media.MIME_TYPE, mimeType)
            put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/$DIR")
            // 書き終わるまで他のアプリから見えないようにする.
            put(MediaStore.Images.Media.IS_PENDING, 1)
        }
        val collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        val target = resolver.insert(collection, values) ?: error("保存先を作れませんでした")
        try {
            resolver.openInputStream(source).use { input ->
                resolver.openOutputStream(target).use { output ->
                    checkNotNull(input) { "画像を開けませんでした: $source" }
                    checkNotNull(output) { "保存先を開けませんでした: $target" }
                    input.copyTo(output)
                }
            }
        } catch (e: Exception) {
            // 書きかけのファイルを残さない.
            resolver.delete(target, null, null)
            throw e
        }
        values.clear()
        values.put(MediaStore.Images.Media.IS_PENDING, 0)
        resolver.update(target, values, null, null)
        return "${Environment.DIRECTORY_PICTURES}/$DIR/$name"
    }
}

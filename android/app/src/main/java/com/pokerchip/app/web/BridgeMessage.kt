package com.pokerchip.app.web

import org.json.JSONException
import org.json.JSONObject

/**
 * Web からアプリへのメッセージ.
 *
 * Web が頼めるのは, ここにある種類だけにする (docs/web/app.md). トークンは受け取らない.
 */
sealed interface BridgeMessage {
    /** 文字をクリップボードにコピーする. WebView ではブラウザのコピーの機能が確実には動かないため. */
    data class CopyText(val text: String) : BridgeMessage
}

/** コピーする文字の長さの上限. 参加の URL には十分で, 大きすぎる文字を受けないため. */
const val MAX_COPY_TEXT_LENGTH = 2048

/**
 * Web から届いた JSON の文字を読む.
 *
 * 形は `{"type": "copyText", "text": "..."}`. 知らない種類や形の違うものは, 何もしないために null を返す.
 * @param raw 届いた文字.
 * @return 読めたメッセージ. 壊れた JSON, 知らない種類, 値が足りない・長すぎるときは null.
 */
fun parseBridgeMessage(raw: String): BridgeMessage? {
    val json = try {
        JSONObject(raw)
    } catch (_: JSONException) {
        return null
    }
    return when (json.optString("type")) {
        "copyText" -> parseCopyText(json)
        else -> null
    }
}

private fun parseCopyText(json: JSONObject): BridgeMessage? {
    // optString は数などを文字に変えてしまうので, 文字であることを先に確かめる.
    val text = json.opt("text") as? String ?: return null
    if (text.isEmpty() || text.length > MAX_COPY_TEXT_LENGTH) return null
    return BridgeMessage.CopyText(text)
}

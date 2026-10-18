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

    /** 検出画面を開き, チップから求めた持ち点を返す. 自分の持ち点の欄の「チップから入力」から届く. */
    data object StartChipInput : BridgeMessage
}

/** コピーする文字の長さの上限. 参加の URL には十分で, 大きすぎる文字を受けないため. */
const val MAX_COPY_TEXT_LENGTH = 2048

/**
 * Web から届いた JSON の文字を読む.
 *
 * 形は `{"type": "copyText", "text": "..."}` と `{"type": "startChipInput"}`.
 * 知らない種類や形の違うものは, 何もしないために null を返す.
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
        "startChipInput" -> BridgeMessage.StartChipInput
        else -> null
    }
}

private fun parseCopyText(json: JSONObject): BridgeMessage? {
    // optString は数などを文字に変えてしまうので, 文字であることを先に確かめる.
    val text = json.opt("text") as? String ?: return null
    if (text.isEmpty() || text.length > MAX_COPY_TEXT_LENGTH) return null
    return BridgeMessage.CopyText(text)
}

/**
 * チップから求めた持ち点を Web に返すメッセージを作る.
 *
 * 形は `{"type": "chipPoints", "points": 1200}`. Web (web/src/client/app-bridge.ts) が読み, 入力欄に入れる.
 * @param points 持ち点.
 * @return Web に送る JSON の文字.
 */
fun chipPointsMessage(points: Int): String =
    JSONObject().put("type", "chipPoints").put("points", points).toString()

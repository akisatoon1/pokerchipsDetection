package com.pokerchip.app.web

import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/**
 * Web とアプリの連絡口 (bridge). Web のページに [BRIDGE_NAME] という名前の物を入れ, メッセージを受ける.
 *
 * 受けるのは接続先のオリジンのページの, いちばん外の枠からのメッセージだけにする.
 * `addJavascriptInterface` と違い, 他のサイトのページからは呼べない (docs/web/app.md).
 * @param baseUrl 接続先.
 * @param onMessage 読めたメッセージと, Web に返事を送る口を受ける. UI のスレッドで呼ばれる.
 */
class WebBridge(
    private val baseUrl: String,
    private val onMessage: (BridgeMessage, JavaScriptReplyProxy) -> Unit,
) {
    /**
     * WebView に bridge を入れる. ページを読み込む前に呼ぶ.
     *
     * 古い WebView で使えないときは何もしない. そのとき Web はブラウザと同じように動く.
     * @param webView 入れる先.
     * @throws IllegalArgumentException 接続先の URL が読めないとき (ビルドの設定の誤り).
     */
    fun install(webView: WebView) {
        val origin = requireNotNull(originOf(baseUrl)) { "接続先の URL が読めません: $baseUrl" }
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return
        WebViewCompat.addWebMessageListener(webView, BRIDGE_NAME, setOf(origin)) { _, message, _, isMainFrame, replyProxy ->
            // ページの中に埋め込まれた枠からは受けない.
            if (!isMainFrame) return@addWebMessageListener
            val parsed = message.data?.let(::parseBridgeMessage) ?: return@addWebMessageListener
            onMessage(parsed, replyProxy)
        }
    }

    companion object {
        /** Web から見える名前. web/src/client/app-bridge.ts と同じにする. */
        const val BRIDGE_NAME = "pokerchipApp"

        /**
         * Web に返事を送る.
         *
         * 返す口は [install] で入れた bridge からしか届かないので機能はあるはずだが, 送る前にも確かめる.
         * @param reply メッセージと一緒に届いた, 返事を送る口.
         * @param message 送る JSON の文字.
         */
        fun sendReply(reply: JavaScriptReplyProxy, message: String) {
            if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) reply.postMessage(message)
        }
    }
}

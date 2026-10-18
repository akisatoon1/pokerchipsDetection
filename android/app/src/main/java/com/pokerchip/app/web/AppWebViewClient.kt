package com.pokerchip.app.web

import android.graphics.Bitmap
import android.net.Uri
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * マッチの画面の WebView で, どの URL を開くかを決め, 読み込みの様子を知らせる.
 *
 * @param baseUrl 接続先. これと同じオリジンのページだけを WebView で開く.
 * @param onOpenExternally 他のサイトの URL を外のブラウザで開く.
 * @param onLoadStarted ページの読み込みを始めたとき.
 * @param onLoadFinished ページの読み込みが終わったとき (失敗しても呼ばれる).
 * @param onMainFrameError ページそのものを読めなかったとき (つながらないなど).
 * @param onHistoryChanged 開いているページが変わったとき. 今の URL と, 戻れるかを渡す.
 * @param onRendererGone WebView の描画のプロセスが落ちたとき. その WebView はもう使えないので, 作り直す.
 */
class AppWebViewClient(
    private val baseUrl: String,
    private val onOpenExternally: (Uri) -> Unit,
    private val onLoadStarted: () -> Unit,
    private val onLoadFinished: () -> Unit,
    private val onMainFrameError: () -> Unit,
    private val onHistoryChanged: (url: String, canGoBack: Boolean) -> Unit,
    private val onRendererGone: () -> Unit,
) : WebViewClient() {
    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        // true を返すと WebView では開かない. bridge を他のサイトに使わせないため (docs/web/app.md).
        return when (decideUrlAction(request.url.toString(), baseUrl)) {
            UrlAction.OPEN_IN_APP -> false
            UrlAction.OPEN_EXTERNALLY -> {
                onOpenExternally(request.url)
                true
            }
            UrlAction.BLOCK -> true
        }
    }

    override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
        onLoadStarted()
    }

    override fun onPageFinished(view: WebView, url: String?) {
        onLoadFinished()
    }

    override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
        // 画像などの一部が読めないだけなら, ページは使えるので知らせない.
        if (request.isForMainFrame) onMainFrameError()
    }

    override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
        if (url != null) onHistoryChanged(url, view.canGoBack())
    }

    override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
        // false を返すとアプリごと終了する. 作り直せば続けられるので, true を返して知らせる.
        onRendererGone()
        return true
    }
}

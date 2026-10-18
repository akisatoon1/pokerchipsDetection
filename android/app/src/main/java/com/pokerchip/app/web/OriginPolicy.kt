package com.pokerchip.app.web

import java.net.URI
import java.net.URISyntaxException
import java.util.Locale

/** WebView で URL をどう扱うか. */
enum class UrlAction {
    /** 接続先のページ. WebView で開く. */
    OPEN_IN_APP,

    /** 他のサイト. 外のブラウザに渡す. */
    OPEN_EXTERNALLY,

    /** http と https 以外 (`javascript:`, `file:`, `intent:` など) や, 読めない URL. 開かない. */
    BLOCK,
}

/**
 * URL を WebView で開くか, 外のブラウザに渡すかを決める.
 *
 * WebView で開くのは, 接続先と同じ scheme, ホスト, ポートのページだけにする.
 * Web とアプリの連絡口 (bridge) を他のサイトのページに使わせないため (docs/web/app.md).
 * @param url 開こうとしている URL.
 * @param baseUrl 接続先 (`BuildConfig.WEB_BASE_URL`).
 * @return 扱い方. 読めない URL は [UrlAction.BLOCK].
 */
fun decideUrlAction(url: String, baseUrl: String): UrlAction {
    val target = parseOrigin(url) ?: return UrlAction.BLOCK
    val base = parseOrigin(baseUrl) ?: return UrlAction.BLOCK
    return if (target == base) UrlAction.OPEN_IN_APP else UrlAction.OPEN_EXTERNALLY
}

/**
 * URL のオリジン (`scheme://host:port`) を返す. bridge を許すページを決めるのに使う.
 *
 * ポートが既定 (http は 80, https は 443) なら省く. WebView が比べるオリジンの書き方に合わせるため.
 * @param url URL.
 * @return オリジン. http と https 以外, または読めない URL なら null.
 */
fun originOf(url: String): String? {
    val origin = parseOrigin(url) ?: return null
    val isDefaultPort = DEFAULT_PORTS[origin.scheme] == origin.port
    return if (isDefaultPort) {
        "${origin.scheme}://${origin.host}"
    } else {
        "${origin.scheme}://${origin.host}:${origin.port}"
    }
}

/** 比べるための, scheme とホストを小文字にし, ポートを既定の値で埋めたオリジン. */
private data class Origin(val scheme: String, val host: String, val port: Int)

/** 開いてよい scheme と, その既定のポート. */
private val DEFAULT_PORTS = mapOf("http" to 80, "https" to 443)

private fun parseOrigin(url: String): Origin? {
    val uri = try {
        URI(url)
    } catch (_: URISyntaxException) {
        return null
    }
    val scheme = uri.scheme?.lowercase(Locale.ROOT) ?: return null
    val defaultPort = DEFAULT_PORTS[scheme] ?: return null
    val host = uri.host?.lowercase(Locale.ROOT) ?: return null
    val port = if (uri.port == -1) defaultPort else uri.port
    return Origin(scheme, host, port)
}

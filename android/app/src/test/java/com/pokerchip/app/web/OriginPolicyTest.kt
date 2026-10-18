package com.pokerchip.app.web

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class OriginPolicyTest {
    private val base = "http://localhost:8787"

    @Test
    fun 接続先と同じオリジンのページはWebViewで開く() {
        assertEquals(UrlAction.OPEN_IN_APP, decideUrlAction("http://localhost:8787/", base))
        assertEquals(UrlAction.OPEN_IN_APP, decideUrlAction("http://localhost:8787/m/abc?x=1#y", base))
        assertEquals(UrlAction.OPEN_IN_APP, decideUrlAction("HTTP://LOCALHOST:8787/m/abc", base))
    }

    @Test
    fun 既定のポートは書いても書かなくても同じとみなす() {
        val https = "https://score.example.com"
        assertEquals(UrlAction.OPEN_IN_APP, decideUrlAction("https://score.example.com:443/m/a", https))
        assertEquals(UrlAction.OPEN_IN_APP, decideUrlAction("https://score.example.com/m/a", "$https:443"))
    }

    @Test
    fun 別のホストは外のブラウザに渡す() {
        assertEquals(UrlAction.OPEN_EXTERNALLY, decideUrlAction("https://example.com/", base))
        assertEquals(UrlAction.OPEN_EXTERNALLY, decideUrlAction("http://127.0.0.1:8787/", base))
        assertEquals(UrlAction.OPEN_EXTERNALLY, decideUrlAction("http://localhost.evil.com:8787/", base))
    }

    @Test
    fun 別のポートや別のschemeは外のブラウザに渡す() {
        assertEquals(UrlAction.OPEN_EXTERNALLY, decideUrlAction("http://localhost:8788/", base))
        assertEquals(UrlAction.OPEN_EXTERNALLY, decideUrlAction("http://localhost/", base))
        assertEquals(UrlAction.OPEN_EXTERNALLY, decideUrlAction("https://localhost:8787/", base))
    }

    @Test
    fun httpとhttps以外は開かない() {
        assertEquals(UrlAction.BLOCK, decideUrlAction("javascript:alert(1)", base))
        assertEquals(UrlAction.BLOCK, decideUrlAction("file:///sdcard/a.html", base))
        assertEquals(UrlAction.BLOCK, decideUrlAction("intent://scan/#Intent;scheme=zxing;end", base))
        assertEquals(UrlAction.BLOCK, decideUrlAction("content://com.example/a", base))
        assertEquals(UrlAction.BLOCK, decideUrlAction("about:blank", base))
    }

    @Test
    fun 読めないURLは開かない() {
        assertEquals(UrlAction.BLOCK, decideUrlAction("", base))
        assertEquals(UrlAction.BLOCK, decideUrlAction("http://local host/", base))
        assertEquals(UrlAction.BLOCK, decideUrlAction("/m/abc", base))
    }

    @Test
    fun オリジンは既定のポートを省いて返す() {
        assertEquals("http://localhost:8787", originOf("http://localhost:8787/m/abc"))
        assertEquals("https://score.example.com", originOf("https://Score.Example.com:443/"))
        assertEquals("http://example.com", originOf("http://example.com"))
        assertNull(originOf("file:///a"))
        assertNull(originOf("not a url"))
    }
}

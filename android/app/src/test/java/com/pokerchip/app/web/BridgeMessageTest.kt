package com.pokerchip.app.web

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BridgeMessageTest {
    @Test
    fun コピーのメッセージを読む() {
        assertEquals(
            BridgeMessage.CopyText("http://localhost:8787/m/abc"),
            parseBridgeMessage("""{"type":"copyText","text":"http://localhost:8787/m/abc"}"""),
        )
    }

    @Test
    fun 知らない種類は無視する() {
        assertNull(parseBridgeMessage("""{"type":"getToken"}"""))
        assertNull(parseBridgeMessage("""{"type":"","text":"a"}"""))
        assertNull(parseBridgeMessage("""{"text":"a"}"""))
    }

    @Test
    fun 壊れたJSONは無視する() {
        assertNull(parseBridgeMessage(""))
        assertNull(parseBridgeMessage("""{"type":"copyText","""))
        assertNull(parseBridgeMessage("copyText"))
        assertNull(parseBridgeMessage("""["copyText"]"""))
    }

    @Test
    fun コピーする文字がない_文字でない_空なら無視する() {
        assertNull(parseBridgeMessage("""{"type":"copyText"}"""))
        assertNull(parseBridgeMessage("""{"type":"copyText","text":123}"""))
        assertNull(parseBridgeMessage("""{"type":"copyText","text":""}"""))
    }

    @Test
    fun コピーする文字が長すぎれば無視する() {
        val longest = "a".repeat(MAX_COPY_TEXT_LENGTH)
        assertEquals(
            BridgeMessage.CopyText(longest),
            parseBridgeMessage("""{"type":"copyText","text":"$longest"}"""),
        )
        assertNull(parseBridgeMessage("""{"type":"copyText","text":"${longest}a"}"""))
    }
}

package com.pokerchip.app

import org.junit.Assert.assertEquals
import org.junit.Test

class StackStatusTest {
    @Test
    fun coreの名前から状態を探す() {
        assertEquals(StackStatus.COUNTED, StackStatus.fromCoreName("counted"))
        assertEquals(StackStatus.TILT_TOO_LARGE, StackStatus.fromCoreName("tilt_too_large"))
        assertEquals(StackStatus.COUNT_FAILED, StackStatus.fromCoreName("count_failed"))
    }

    @Test
    fun 知らない名前は数えられなかったとみなす() {
        assertEquals(StackStatus.COUNT_FAILED, StackStatus.fromCoreName("something_new"))
    }
}

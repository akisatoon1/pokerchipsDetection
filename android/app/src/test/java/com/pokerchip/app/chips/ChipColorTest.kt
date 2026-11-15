package com.pokerchip.app.chips

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ChipColorTest {
    @Test
    fun coreの色の名前から色を探す() {
        assertEquals(ChipColor.RED, ChipColor.fromCoreName("red"))
        assertEquals(ChipColor.GRAY, ChipColor.fromCoreName("gray"))
        assertNull(ChipColor.fromCoreName("unknown"))
        assertEquals(7, ChipColor.entries.size)
    }
}

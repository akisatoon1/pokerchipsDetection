package com.pokerchip.app.chips

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ChipValuesTest {
    private fun assertInvalid(text: String) {
        assertTrue("「$text」は拒否する", parseChipValue(text) is ChipValueInput.Invalid)
    }

    @Test
    fun 空欄は使わない色になる() {
        assertEquals(ChipValueInput.Valid(null), parseChipValue(""))
        assertEquals(ChipValueInput.Valid(null), parseChipValue("   "))
    }

    @Test
    fun 一と上限は受け付ける() {
        assertEquals(ChipValueInput.Valid(1), parseChipValue("1"))
        assertEquals(ChipValueInput.Valid(1_000_000_000), parseChipValue("1000000000"))
    }

    @Test
    fun 前後の空白は除いて読む() {
        assertEquals(ChipValueInput.Valid(500), parseChipValue(" 500\n"))
    }

    @Test
    fun ゼロと負の数は拒否する() {
        assertInvalid("0")
        assertInvalid("000")
        assertInvalid("-1")
    }

    @Test
    fun 小数は拒否する() {
        assertInvalid("1.5")
        assertInvalid("100.0")
    }

    @Test
    fun 上限を超える数は拒否する() {
        assertInvalid("1000000001")
        assertInvalid("99999999999999999999999")
    }

    @Test
    fun 数でない文字は拒否する() {
        assertInvalid("abc")
        assertInvalid("1e3")
        assertInvalid("+5")
        assertInvalid("1 000")
        assertInvalid("１００")
    }
}

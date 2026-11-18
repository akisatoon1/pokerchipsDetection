package com.pokerchip.app

import org.junit.Assert.assertEquals
import org.junit.Test

class SeamArcTest {
    @Test
    fun 中央では上がらず端で半幅かけるsinだけ上がる() {
        assertEquals(0f, seamArcRise(0f, 100f, 0.5), 1e-4f)
        assertEquals(50f, seamArcRise(100f, 100f, 0.5), 1e-4f)
        assertEquals(50f, seamArcRise(-100f, 100f, 0.5), 1e-4f)
        // u = 0.6 なら 1 - √(1 - 0.36) = 0.2.
        assertEquals(10f, seamArcRise(60f, 100f, 0.5), 1e-4f)
    }

    @Test
    fun 半幅より外は端と同じ() {
        assertEquals(seamArcRise(100f, 100f, 0.3), seamArcRise(150f, 100f, 0.3), 1e-4f)
        assertEquals(0f, seamArcRise(10f, 0f, 0.3), 1e-4f)
    }

    @Test
    fun sinを度にする() {
        assertEquals(30.0, tiltDegrees(0.5), 1e-9)
        assertEquals(0.0, tiltDegrees(-0.1), 1e-9)
    }
}

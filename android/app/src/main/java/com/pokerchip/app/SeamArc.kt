package com.pokerchip.app

import kotlin.math.asin
import kotlin.math.sqrt

/**
 * 合わせ目の弧が, 横の中央よりどれだけ上に写るか.
 *
 * 斜め上から見ると, チップの合わせ目は中央が低い弧 (楕円の手前の半分) に写る.
 * core の flattenArcs と同じ形 (半幅 × sin × (1 - √(1 - u²))) で, 確認画像に弧を描くのに使う.
 * @param offsetFromCenter 横の中央からの距離 (左右どちらでもよい).
 * @param halfWidth スタックの半幅. offsetFromCenter と同じ単位.
 * @param tiltSin sin(見下ろす角度).
 * @return 上がる量. halfWidth と同じ単位. 中央で 0. 半幅より外は端と同じ値.
 */
fun seamArcRise(offsetFromCenter: Float, halfWidth: Float, tiltSin: Double): Float {
    if (halfWidth <= 0f) return 0f
    val u = (offsetFromCenter / halfWidth).coerceIn(-1f, 1f)
    return (halfWidth * tiltSin * (1.0 - sqrt(1.0 - u * u))).toFloat()
}

/**
 * sin(見下ろす角度) を度にする. 表示用.
 *
 * @param tiltSin sin(見下ろす角度). 0〜1 の外は端に寄せる.
 * @return 角度 (度). 0 が真横.
 */
fun tiltDegrees(tiltSin: Double): Double = Math.toDegrees(asin(tiltSin.coerceIn(0.0, 1.0)))

package com.pokerchip.app.chips

/**
 * 持ち点の上限. web/src/rules/limits.ts の MAX_POINTS と同じ値.
 *
 * 言語が違って共有できないので, ここにも置く. 最後はサーバーが確かめる.
 */
const val MAX_POINTS = 1_000_000_000

/**
 * core が判定するチップの色. 並びは設定画面に出す順.
 *
 * 色を足すのは core の基準色を作り直すときなので, アプリの中では足せないようにする (docs/web/app.md).
 * @property coreName core の chipColorName が返す名前.
 * @property label 画面に出す名前.
 * @property swatchArgb 見本の色 (ARGB). core の chipColorBgr と同じ値.
 */
enum class ChipColor(val coreName: String, val label: String, val swatchArgb: Long) {
    RED("red", "赤", 0xFFDC0000),
    BLUE("blue", "青", 0xFF0050DC),
    YELLOW("yellow", "黄", 0xFFF0DC00),
    BLACK("black", "黒", 0xFF000000),

    /** 実物のチップでは白に見える. 設定画面では見本と並べて, どのチップのことか分かるようにする. */
    GRAY("gray", "灰 (白)", 0xFF808080),
    PURPLE("purple", "紫", 0xFF8C00B4),
    GREEN("green", "緑", 0xFF00B400),
    ;

    companion object {
        /**
         * core の色の名前から探す.
         *
         * @param name core の chipColorName が返す名前.
         * @return 色. `unknown` など, ここにない名前なら null.
         */
        fun fromCoreName(name: String): ChipColor? = entries.firstOrNull { it.coreName == name }
    }
}

/**
 * 色ごとの点数. 端末に 1 つ持ち, どのマッチでも同じものを使う (docs/web/app.md).
 *
 * @property points 色ごとの点数 (1 以上 [MAX_POINTS] 以下). 入っていない色は「このチップセットでは使わない色」.
 */
data class ChipValues(val points: Map<ChipColor, Int>) {
    /** どの色の点数も決めていないか. 決めていなければ, チップから入力する前に設定画面を出す. */
    val isEmpty: Boolean get() = points.isEmpty()
}

/** 設定画面で 1 つの色の欄に入れた文字を読んだ結果. */
sealed interface ChipValueInput {
    /** 受け付けられる. [points] が null なら空欄で, 使わない色. */
    data class Valid(val points: Int?) : ChipValueInput

    /** 受け付けられない. [reason] はその欄に出す短い説明. */
    data class Invalid(val reason: String) : ChipValueInput
}

/**
 * 設定画面で 1 つの色の欄に入れた文字を読む.
 *
 * 前後の空白は除く. 空欄は使わない色とし, それ以外は 1 以上 [MAX_POINTS] 以下の整数だけを受け付ける.
 * チップの点数は整数なので, 小数は受け付けない (docs/web/scoring.md).
 * @param text 欄に入れた文字.
 * @return 読んだ点数. 受け付けられないときは [ChipValueInput.Invalid] と理由.
 */
fun parseChipValue(text: String): ChipValueInput {
    val trimmed = text.trim()
    if (trimmed.isEmpty()) return ChipValueInput.Valid(null)
    // 符号, 小数点, 全角の数字などを先に弾く. toLong は "+1" なども受け付けてしまうため.
    if (!trimmed.all { it in '0'..'9' }) return ChipValueInput.Invalid(NOT_POSITIVE_INTEGER)
    val value = trimmed.toLongOrNull() ?: return ChipValueInput.Invalid(TOO_LARGE)
    return when {
        value < 1 -> ChipValueInput.Invalid(NOT_POSITIVE_INTEGER)
        value > MAX_POINTS -> ChipValueInput.Invalid(TOO_LARGE)
        else -> ChipValueInput.Valid(value.toInt())
    }
}

private const val NOT_POSITIVE_INTEGER = "1 以上の整数を入れてください"
private const val TOO_LARGE = "1,000,000,000 以下にしてください"

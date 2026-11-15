package com.pokerchip.app.chips

/**
 * core が判定するチップの色. 確認画像の色の見本に使う.
 *
 * 色を足すのは core の基準色を作り直すときなので, ここも core と一緒に直す.
 * @property coreName core の chipColorName が返す名前.
 * @property swatchArgb 見本の色 (ARGB). core の chipColorBgr と同じ値.
 */
enum class ChipColor(val coreName: String, val swatchArgb: Long) {
    RED("red", 0xFFDC0000),
    BLUE("blue", 0xFF0050DC),
    YELLOW("yellow", 0xFFF0DC00),
    BLACK("black", 0xFF000000),
    GRAY("gray", 0xFF808080),
    PURPLE("purple", 0xFF8C00B4),
    GREEN("green", 0xFF00B400),
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

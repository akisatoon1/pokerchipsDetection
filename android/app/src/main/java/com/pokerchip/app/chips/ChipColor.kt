package com.pokerchip.app.chips

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

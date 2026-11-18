package com.pokerchip.app

import org.json.JSONObject

/**
 * スタックを数えられたか (core の StackStatus).
 *
 * @property coreName core の stackStatusName が返す名前.
 */
enum class StackStatus(val coreName: String) {
    /** 枚数と色を求めた. */
    COUNTED("counted"),

    /** 見下ろす角度が大きすぎて, 数えなかった. 横から撮り直すよう知らせる. */
    TILT_TOO_LARGE("tilt_too_large"),

    /** 角度か枚数を求められなかった. */
    COUNT_FAILED("count_failed"),
    ;

    companion object {
        /**
         * core の名前から探す.
         *
         * @param name core の stackStatusName が返す名前.
         * @return 状態. 知らない名前なら, 数えられなかったとみなして COUNT_FAILED.
         */
        fun fromCoreName(name: String): StackStatus =
            entries.firstOrNull { it.coreName == name } ?: COUNT_FAILED
    }
}

/** 1つのスタックの解析結果. 座標は元画像のピクセル. */
data class StackResult(
    val x: Int,
    val y: Int,
    val width: Int,
    val height: Int,
    val score: Float,
    /** 数えられたか. */
    val status: StackStatus,
    /** sin(見下ろす角度). 0 が真横. 推定に失敗したら null. */
    val tiltSin: Double?,
    /** 数えなかったら null. */
    val count: Int?,
    /**
     * チップの合わせ目の y. 元画像でなく ROI の上端からのピクセル. 数えなかったら空.
     * 合わせ目は弧に写るので, この y は ROI の横の中央での位置 (左右の端ほど上に写る).
     */
    val peaks: List<Int>,
    /** 上のチップから順の色名 (core の chipColorName). */
    val colors: List<String>,
)

/** core の toJson の出力に対応する. */
data class AnalysisResult(val stacks: List<StackResult>) {
    companion object {
        fun fromJson(json: String): AnalysisResult {
            val stacks = JSONObject(json).getJSONArray("stacks")
            return AnalysisResult(
                (0 until stacks.length()).map { i ->
                    val s = stacks.getJSONObject(i)
                    val box = s.getJSONArray("box")
                    val peaks = s.getJSONArray("peaks")
                    val colors = s.getJSONArray("colors")
                    StackResult(
                        x = box.getInt(0),
                        y = box.getInt(1),
                        width = box.getInt(2),
                        height = box.getInt(3),
                        score = s.getDouble("score").toFloat(),
                        status = StackStatus.fromCoreName(s.getString("status")),
                        tiltSin = if (s.isNull("tilt")) null else s.getDouble("tilt"),
                        count = if (s.isNull("count")) null else s.getInt("count"),
                        peaks = (0 until peaks.length()).map { peaks.getInt(it) },
                        colors = (0 until colors.length()).map { colors.getString(it) },
                    )
                },
            )
        }
    }
}

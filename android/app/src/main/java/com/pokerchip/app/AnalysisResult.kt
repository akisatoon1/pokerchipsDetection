package com.pokerchip.app

import org.json.JSONObject

/** 1つのスタックの解析結果. 座標は元画像のピクセル. */
data class StackResult(
    val x: Int,
    val y: Int,
    val width: Int,
    val height: Int,
    val score: Float,
    /** カウントに失敗したら null. */
    val count: Int?,
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
                    val colors = s.getJSONArray("colors")
                    StackResult(
                        x = box.getInt(0),
                        y = box.getInt(1),
                        width = box.getInt(2),
                        height = box.getInt(3),
                        score = s.getDouble("score").toFloat(),
                        count = if (s.isNull("count")) null else s.getInt("count"),
                        colors = (0 until colors.length()).map { colors.getString(it) },
                    )
                },
            )
        }
    }
}

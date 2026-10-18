package com.pokerchip.app.chips

import com.pokerchip.app.AnalysisResult

/**
 * 1 つの色の内訳.
 *
 * @property color 色.
 * @property count 枚数 (すべてのスタックの合計).
 * @property pointsEach チップ 1 枚の点数.
 * @property subtotal 枚数 × 点数.
 */
data class ColorSubtotal(val color: ChipColor, val count: Int, val pointsEach: Int, val subtotal: Long)

/**
 * 持ち点を求められない理由. スタックは左から, チップは上から, 1 から数える (画面にそのまま出すため).
 */
sealed interface ChipPointsProblem {
    /** スタックが 1 つも見つからない. */
    data object NoStack : ChipPointsProblem

    /** 枚数を数えられなかったスタックがある. */
    data class CountFailed(val stackNumber: Int) : ChipPointsProblem

    /** 色を判定できなかった (`unknown`) チップがある. */
    data class UnknownColor(val stackNumber: Int, val chipNumber: Int) : ChipPointsProblem

    /** 点数を決めていない色のチップがある. 色の判定の誤りか, 設定の漏れのどちらか. */
    data class UnsetColor(val stackNumber: Int, val chipNumber: Int, val color: ChipColor) : ChipPointsProblem

    /** 合計が持ち点の上限 ([MAX_POINTS]) を超える. */
    data class TooLarge(val total: Long) : ChipPointsProblem
}

/** チップから持ち点を求めた結果. */
sealed interface ChipPointsResult {
    /** 求められた. [subtotals] は色の一覧の順で, 1 枚以上ある色だけ. */
    data class Success(val total: Int, val subtotals: List<ColorSubtotal>) : ChipPointsResult

    /** 求められない. 理由をすべて返す. */
    data class Failure(val problems: List<ChipPointsProblem>) : ChipPointsResult
}

/**
 * 解析の結果と色ごとの点数から, 持ち点を求める. スタックが複数あれば合計する.
 *
 * 1 つでも数えられないチップがあれば止める. 黙って 0 点にすると, 間違いに気づけないため (docs/web/app.md).
 * @param result 解析の結果.
 * @param values 色ごとの点数.
 * @return 持ち点と色ごとの内訳. 求められなければ, すべての理由.
 */
fun computeChipPoints(result: AnalysisResult, values: ChipValues): ChipPointsResult {
    if (result.stacks.isEmpty()) return ChipPointsResult.Failure(listOf(ChipPointsProblem.NoStack))
    val problems = mutableListOf<ChipPointsProblem>()
    val counts = mutableMapOf<ChipColor, Int>()
    for ((stackIndex, stack) in result.stacks.withIndex()) {
        val stackNumber = stackIndex + 1
        if (stack.count == null) {
            problems += ChipPointsProblem.CountFailed(stackNumber)
            continue
        }
        for ((chipIndex, name) in stack.colors.withIndex()) {
            val chipNumber = chipIndex + 1
            val color = ChipColor.fromCoreName(name)
            when {
                color == null -> problems += ChipPointsProblem.UnknownColor(stackNumber, chipNumber)
                color !in values.points -> problems += ChipPointsProblem.UnsetColor(stackNumber, chipNumber, color)
                else -> counts[color] = (counts[color] ?: 0) + 1
            }
        }
    }
    val subtotals = ChipColor.entries.mapNotNull { color ->
        val count = counts[color] ?: return@mapNotNull null
        val pointsEach = values.points[color] ?: return@mapNotNull null
        ColorSubtotal(color, count, pointsEach, count.toLong() * pointsEach)
    }
    // 1 枚の点数も上限までなので, 和は Long で求めてから上限と比べる.
    val total = subtotals.sumOf { it.subtotal }
    if (total > MAX_POINTS) problems += ChipPointsProblem.TooLarge(total)
    if (problems.isNotEmpty()) return ChipPointsResult.Failure(problems)
    return ChipPointsResult.Success(total.toInt(), subtotals)
}

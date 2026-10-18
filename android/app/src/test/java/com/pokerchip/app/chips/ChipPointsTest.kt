package com.pokerchip.app.chips

import com.pokerchip.app.AnalysisResult
import com.pokerchip.app.StackResult
import org.junit.Assert.assertEquals
import org.junit.Test

class ChipPointsTest {
    private val values = ChipValues(mapOf(ChipColor.RED to 100, ChipColor.BLUE to 500, ChipColor.GRAY to 10))

    private fun stack(vararg colors: String, count: Int? = colors.size) = StackResult(
        x = 0,
        y = 0,
        width = 10,
        height = 10,
        score = 0.9f,
        count = count,
        peaks = emptyList(),
        colors = colors.toList(),
    )

    private fun result(vararg stacks: StackResult) = AnalysisResult(stacks.toList())

    @Test
    fun 一つのスタックの持ち点は枚数かける点数の和になる() {
        val computed = computeChipPoints(result(stack("red", "blue", "red")), values)
        assertEquals(700, (computed as? ChipPointsResult.Success)?.total)
    }

    @Test
    fun スタックが複数あれば合計する() {
        val computed = computeChipPoints(result(stack("red", "red"), stack("blue"), stack("gray")), values)
        assertEquals(710, (computed as? ChipPointsResult.Success)?.total)
    }

    @Test
    fun 内訳は色の一覧の順に枚数と小計を返す() {
        val computed = computeChipPoints(result(stack("gray", "blue"), stack("red", "red", "gray")), values)
        assertEquals(
            listOf(
                ColorSubtotal(ChipColor.RED, 2, 100, 200),
                ColorSubtotal(ChipColor.BLUE, 1, 500, 500),
                ColorSubtotal(ChipColor.GRAY, 2, 10, 20),
            ),
            (computed as? ChipPointsResult.Success)?.subtotals,
        )
    }

    @Test
    fun スタックが一つも見つからなければ止める() {
        assertEquals(
            ChipPointsResult.Failure(listOf(ChipPointsProblem.NoStack)),
            computeChipPoints(result(), values),
        )
    }

    @Test
    fun 枚数を数えられなかったスタックがあれば止める() {
        assertEquals(
            ChipPointsResult.Failure(listOf(ChipPointsProblem.CountFailed(2))),
            computeChipPoints(result(stack("red"), stack(count = null)), values),
        )
    }

    @Test
    fun 色がunknownのチップがあれば止める() {
        assertEquals(
            ChipPointsResult.Failure(listOf(ChipPointsProblem.UnknownColor(1, 2))),
            computeChipPoints(result(stack("red", "unknown", "blue")), values),
        )
    }

    @Test
    fun 点数を決めていない色のチップがあれば止める() {
        assertEquals(
            ChipPointsResult.Failure(listOf(ChipPointsProblem.UnsetColor(2, 1, ChipColor.GREEN))),
            computeChipPoints(result(stack("red"), stack("green")), values),
        )
    }

    @Test
    fun 合計が上限を超えたら止める() {
        val big = ChipValues(mapOf(ChipColor.RED to MAX_POINTS))
        assertEquals(
            ChipPointsResult.Success(MAX_POINTS, listOf(ColorSubtotal(ChipColor.RED, 1, MAX_POINTS, 1_000_000_000))),
            computeChipPoints(result(stack("red")), big),
        )
        assertEquals(
            ChipPointsResult.Failure(listOf(ChipPointsProblem.TooLarge(2_000_000_000))),
            computeChipPoints(result(stack("red", "red")), big),
        )
    }

    @Test
    fun 止める理由が複数あればすべて返す() {
        val computed = computeChipPoints(
            result(stack("red", "unknown"), stack(count = null), stack("purple", "unknown")),
            values,
        )
        assertEquals(
            ChipPointsResult.Failure(
                listOf(
                    ChipPointsProblem.UnknownColor(1, 2),
                    ChipPointsProblem.CountFailed(2),
                    ChipPointsProblem.UnsetColor(3, 1, ChipColor.PURPLE),
                    ChipPointsProblem.UnknownColor(3, 2),
                ),
            ),
            computed,
        )
    }
}

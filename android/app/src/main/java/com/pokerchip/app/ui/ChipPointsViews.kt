package com.pokerchip.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.pokerchip.app.chips.ChipPointsProblem
import com.pokerchip.app.chips.ChipPointsResult
import com.pokerchip.app.chips.ColorSubtotal
import com.pokerchip.app.chips.MAX_POINTS
import java.text.NumberFormat
import java.util.Locale

/**
 * チップから求めた持ち点を出す. 求められれば色ごとの内訳と合計, 求められなければ理由.
 *
 * @param result 持ち点を求めた結果.
 */
@Composable
fun ChipPointsSummary(result: ChipPointsResult) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        when (result) {
            is ChipPointsResult.Success -> {
                for (subtotal in result.subtotals) SubtotalRow(subtotal)
                Row(modifier = Modifier.fillMaxWidth()) {
                    Text("合計", style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
                    Text(formatNumber(result.total.toLong()), style = MaterialTheme.typography.titleLarge)
                }
            }
            is ChipPointsResult.Failure -> {
                Text(
                    "持ち点を求められません",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.error,
                )
                for (problem in result.problems) {
                    Text("・${describe(problem)}", color = MaterialTheme.colorScheme.error)
                }
                Text("撮り直すか, 手で入力してください.")
            }
        }
    }
}

@Composable
private fun SubtotalRow(subtotal: ColorSubtotal) {
    Row(modifier = Modifier.fillMaxWidth()) {
        Text(
            "${subtotal.color.label}  × ${subtotal.count}  × ${formatNumber(subtotal.pointsEach.toLong())}",
            modifier = Modifier.weight(1f),
        )
        Text("= ${formatNumber(subtotal.subtotal)}", textAlign = TextAlign.End)
    }
}

/** 求められない理由を, どのスタックの何枚目かが分かる文にする. 番号は確認画像の「スタック #n」と同じ. */
private fun describe(problem: ChipPointsProblem): String = when (problem) {
    ChipPointsProblem.NoStack -> "チップの山が見つかりませんでした."
    is ChipPointsProblem.CountFailed -> "スタック #${problem.stackNumber} の枚数を数えられませんでした."
    is ChipPointsProblem.UnknownColor ->
        "スタック #${problem.stackNumber} の上から ${problem.chipNumber} 枚目の色が分かりません."
    is ChipPointsProblem.UnsetColor ->
        "スタック #${problem.stackNumber} の上から ${problem.chipNumber} 枚目は「${problem.color.label}」ですが, " +
            "この色の点数を決めていません."
    is ChipPointsProblem.TooLarge ->
        "合計 ${formatNumber(problem.total)} が, 持ち点の上限 ${formatNumber(MAX_POINTS.toLong())} を超えています."
}

private fun formatNumber(value: Long): String = NumberFormat.getIntegerInstance(Locale.JAPAN).format(value)

package com.pokerchip.app.ui

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pokerchip.app.AnalysisResult

/** 画像に検出したスタックの枠と枚数を重ねて表示する. */
@Composable
fun ResultImage(bitmap: Bitmap, result: AnalysisResult?) {
    val textMeasurer = rememberTextMeasurer()
    Image(
        bitmap = bitmap.asImageBitmap(),
        contentDescription = null,
        contentScale = ContentScale.Fit,
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(bitmap.width.toFloat() / bitmap.height)
            .drawWithContent {
                drawContent()
                if (result == null) return@drawWithContent

                // 結果の座標は元画像のピクセルなので, 表示の大きさに合わせる.
                val scale = size.width / bitmap.width
                result.stacks.forEachIndexed { i, s ->
                    val topLeft = Offset(s.x * scale, s.y * scale)
                    drawRect(
                        color = Color(0xFFFFA000),
                        topLeft = topLeft,
                        size = Size(s.width * scale, s.height * scale),
                        style = Stroke(width = 3.dp.toPx()),
                    )
                    drawText(
                        textMeasurer = textMeasurer,
                        text = "#${i + 1}: ${s.count ?: "?"}枚",
                        topLeft = Offset(topLeft.x, (topLeft.y - 22.dp.toPx()).coerceAtLeast(0f)),
                        style = TextStyle(
                            color = Color.White,
                            background = Color(0xCC000000),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                        ),
                    )
                }
            },
    )
}

/** スタックごとの枚数と色の内訳. */
@Composable
fun ResultSummary(result: AnalysisResult) {
    if (result.stacks.isEmpty()) {
        Text("チップの山が見つかりませんでした.")
        return
    }

    val total = result.stacks.sumOf { it.count ?: 0 }
    Text("合計: ${total}枚", style = MaterialTheme.typography.titleLarge)

    result.stacks.forEachIndexed { i, s ->
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                "スタック #${i + 1}: ${s.count?.let { "${it}枚" } ?: "数えられませんでした"}",
                style = MaterialTheme.typography.titleMedium,
            )
            if (s.colors.isNotEmpty()) {
                val breakdown = s.colors.groupingBy { it }.eachCount()
                    .entries.sortedByDescending { it.value }
                    .joinToString(", ") { "${it.key} ×${it.value}" }
                Text("色: $breakdown")
                Text(
                    "上から: ${s.colors.joinToString(", ")}",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

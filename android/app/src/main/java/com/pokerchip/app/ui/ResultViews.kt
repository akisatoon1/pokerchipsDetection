package com.pokerchip.app.ui

import android.graphics.Bitmap
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.min
import androidx.compose.ui.unit.sp
import com.pokerchip.app.AnalysisResult
import com.pokerchip.app.StackResult
import com.pokerchip.app.StackStatus
import com.pokerchip.app.chips.ChipColor
import com.pokerchip.app.seamArcRise
import com.pokerchip.app.tiltDegrees
import kotlin.math.roundToInt

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
                        color = SEAM_COLOR,
                        topLeft = topLeft,
                        size = Size(s.width * scale, s.height * scale),
                        style = Stroke(width = 3.dp.toPx()),
                    )
                    drawText(
                        textMeasurer = textMeasurer,
                        text = "#${i + 1}: ${shortCountLabel(s)}",
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

/** 合計枚数と, スタックごとの確認画像. */
@Composable
fun ResultSummary(bitmap: Bitmap, result: AnalysisResult) {
    if (result.stacks.isEmpty()) {
        Text("チップの山が見つかりませんでした.")
        return
    }

    val total = result.stacks.sumOf { it.count ?: 0 }
    Text("合計: ${total}枚", style = MaterialTheme.typography.titleLarge)
    if (result.stacks.any { it.status == StackStatus.TILT_TOO_LARGE }) {
        // 角度が大きい写真は誤った枚数になりやすいので, core は数えない (docs/architecture.md の 12).
        Text(
            "見下ろす角度が大きすぎるスタックは数えていません. もっと横から撮ってください.",
            color = MaterialTheme.colorScheme.error,
        )
    }

    result.stacks.forEachIndexed { i, s -> StackCheckView(bitmap, s, i) }
}

/**
 * スタック1つの枚数と色を, ユーザが画像と見比べて確かめるための表示.
 *
 * ROI を少し広げて切り出し, 合わせ目に横線を引き, 右にチップごとの色を並べる
 * (CLI のデバッグ画像から輝度プロファイルを除いたもの).
 */
@Composable
private fun StackCheckView(bitmap: Bitmap, stack: StackResult, index: Int) {
    val image = remember(bitmap) { bitmap.asImageBitmap() }
    val textMeasurer = rememberTextMeasurer()

    // 表示する範囲 (元画像のピクセル). ROI がずれていても気づけるよう, ROI より広く取る.
    val marginX = (stack.width * DISPLAY_MARGIN).roundToInt()
    val marginY = (stack.height * DISPLAY_MARGIN).roundToInt()
    val viewLeft = (stack.x - marginX).coerceAtLeast(0)
    val viewTop = (stack.y - marginY).coerceAtLeast(0)
    val viewWidth = (stack.x + stack.width + marginX).coerceAtMost(bitmap.width) - viewLeft
    val viewHeight = (stack.y + stack.height + marginY).coerceAtMost(bitmap.height) - viewTop

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("スタック #${index + 1}: ${countLabel(stack)}", style = MaterialTheme.typography.titleMedium)
        stack.tiltSin?.let { Text("見下ろす角度: 約${tiltDegrees(it).roundToInt()}°") }
        if (stack.colors.isNotEmpty()) {
            val breakdown = stack.colors.groupingBy { it }.eachCount()
                .entries.sortedByDescending { it.value }
                .joinToString(", ") { "${it.key} ×${it.value}" }
            Text("色: $breakdown")
        }
        if (viewWidth <= 0 || viewHeight <= 0) return@Column

        BoxWithConstraints(Modifier.fillMaxWidth()) {
            // 縦長のスタックで画面を占めすぎないよう, 高さに上限を設けて横幅を縮める.
            val aspect = viewHeight.toFloat() / viewWidth
            val imageHeight = min((maxWidth - LABEL_WIDTH) * aspect, MAX_VIEW_HEIGHT)
            Canvas(Modifier.fillMaxWidth().height(imageHeight)) {
                val scale = size.height / viewHeight
                val imageWidth = viewWidth * scale
                drawImage(
                    image = image,
                    srcOffset = IntOffset(viewLeft, viewTop),
                    srcSize = IntSize(viewWidth, viewHeight),
                    dstSize = IntSize(imageWidth.roundToInt(), size.height.roundToInt()),
                )

                // ROI の枠. 広げた部分との境を破線で示す.
                val roiLeft = (stack.x - viewLeft) * scale
                val roiTop = (stack.y - viewTop) * scale
                val roiWidth = stack.width * scale
                drawRect(
                    color = SEAM_COLOR,
                    topLeft = Offset(roiLeft, roiTop),
                    size = Size(roiWidth, stack.height * scale),
                    style = Stroke(
                        width = 1.dp.toPx(),
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(6.dp.toPx(), 4.dp.toPx())),
                    ),
                )

                // 合わせ目の線. 画像には ROI の横幅だけ引き, 右のラベル列にも同じ高さで引く.
                val labelLeft = imageWidth
                val labelWidth = LABEL_WIDTH.toPx()
                drawRect(
                    color = LABEL_BACKGROUND,
                    topLeft = Offset(labelLeft, 0f),
                    size = Size(labelWidth, size.height),
                )
                // 画像の上の線は, 合わせ目の写り方に合わせて弧にする. peaks は横の中央での位置.
                val seamYs = stack.peaks.map { roiTop + it * scale }
                val stroke = 1.5.dp.toPx()
                for (y in seamYs) {
                    drawPath(
                        seamArcPath(roiLeft, roiWidth, y, stack.tiltSin ?: 0.0),
                        SEAM_COLOR,
                        style = Stroke(width = stroke),
                    )
                    drawLine(SEAM_COLOR, Offset(labelLeft, y), Offset(labelLeft + labelWidth, y), stroke)
                }

                // 各チップの区間の中央に, 色見本と色名を描く.
                // チップが多いと区間が狭くなるので, 文字と見本の大きさを区間の高さに合わせる.
                for ((i, name) in stack.colors.withIndex()) {
                    if (i + 1 >= seamYs.size) break
                    val band = seamYs[i + 1] - seamYs[i]
                    val centerY = (seamYs[i] + seamYs[i + 1]) / 2
                    val swatch = minOf(12.dp.toPx(), band * 0.8f)
                    val swatchTopLeft = Offset(labelLeft + 6.dp.toPx(), centerY - swatch / 2)
                    drawRect(chipColor(name), swatchTopLeft, Size(swatch, swatch))
                    // 黒のチップの見本が背景に埋もれないよう枠を付ける.
                    drawRect(Color.LightGray, swatchTopLeft, Size(swatch, swatch), style = Stroke(1f))

                    val text = textMeasurer.measure(
                        name,
                        TextStyle(
                            color = LABEL_TEXT,
                            fontSize = minOf(band * 0.7f, 14.sp.toPx()).toSp(),
                        ),
                    )
                    drawText(
                        text,
                        topLeft = Offset(
                            swatchTopLeft.x + swatch + 6.dp.toPx(),
                            centerY - text.size.height / 2f,
                        ),
                    )
                }
            }
        }
    }
}

/** 全体画像の枠に添える, 短い枚数の表示. */
private fun shortCountLabel(stack: StackResult): String = when (stack.status) {
    StackStatus.COUNTED -> "${stack.count ?: "?"}枚"
    StackStatus.TILT_TOO_LARGE -> "角度が大きい"
    StackStatus.COUNT_FAILED -> "?"
}

/** 確認画像の見出しの, 枚数か数えなかった理由. */
private fun countLabel(stack: StackResult): String = when (stack.status) {
    StackStatus.COUNTED -> stack.count?.let { "${it}枚" } ?: "数えられませんでした"
    StackStatus.TILT_TOO_LARGE -> "見下ろす角度が大きすぎて数えられません"
    StackStatus.COUNT_FAILED -> "数えられませんでした"
}

/**
 * 合わせ目の弧を, 折れ線で近似した Path にする.
 *
 * @param left スタックの左端 (表示の座標).
 * @param width スタックの幅 (表示の座標).
 * @param centerY 横の中央での合わせ目の y (表示の座標).
 * @param tiltSin sin(見下ろす角度).
 */
private fun seamArcPath(left: Float, width: Float, centerY: Float, tiltSin: Double): Path {
    val half = width / 2f
    val path = Path()
    for (i in 0..ARC_SEGMENTS) {
        val x = left + width * i / ARC_SEGMENTS
        val y = centerY - seamArcRise(x - (left + half), half, tiltSin)
        if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
    }
    return path
}

/** 合わせ目の弧を近似する折れ線の区間の数. 確認画像の大きさで滑らかに見える数. */
private const val ARC_SEGMENTS = 32

/** 確認画像で ROI の外に広げる量. ROI の幅・高さに対する割合. */
private const val DISPLAY_MARGIN = 0.2f

/** 確認画像の右に並べる色のラベル列の幅. */
private val LABEL_WIDTH = 110.dp

/** 確認画像の高さの上限. */
private val MAX_VIEW_HEIGHT = 560.dp

/** 合わせ目の線と ROI の枠の色. 全体画像の枠, CLI のデバッグ画像の線と同じ. */
private val SEAM_COLOR = Color(0xFFFFA000)

private val LABEL_BACKGROUND = Color(0xFF1E1E1E)
private val LABEL_TEXT = Color(0xFFE6E6E6)

/** 色名 (core の chipColorName) の見本の色. 知らない色 (unknown) は白. */
private fun chipColor(name: String): Color =
    ChipColor.fromCoreName(name)?.let { Color(it.swatchArgb) } ?: Color.White

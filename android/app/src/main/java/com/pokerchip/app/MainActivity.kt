package com.pokerchip.app

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import java.io.File

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                MainScreen()
            }
        }
    }
}

@Composable
fun MainScreen(vm: MainViewModel = viewModel()) {
    val context = LocalContext.current
    val state = vm.state

    // カメラアプリに渡した保存先. 撮影から戻ったときに使う.
    var pendingCapture by rememberSaveable { mutableStateOf<Uri?>(null) }
    val takePicture = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val uri = pendingCapture
        if (ok && uri != null) vm.analyze(uri)
    }
    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) vm.analyze(uri)
    }

    Scaffold { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    enabled = !state.isAnalyzing,
                    onClick = {
                        val uri = createCaptureUri(context)
                        pendingCapture = uri
                        takePicture.launch(uri)
                    },
                ) { Text("撮影") }
                Button(
                    enabled = !state.isAnalyzing,
                    onClick = {
                        pickImage.launch(
                            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                        )
                    },
                ) { Text("ギャラリー") }
            }

            if (state.isAnalyzing) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    CircularProgressIndicator()
                    Text("解析中...")
                }
            }

            state.error?.let {
                Text("エラー: $it", color = MaterialTheme.colorScheme.error)
            }

            state.bitmap?.let { ResultImage(it, state.result) }
            state.result?.let { ResultSummary(it) }
        }
    }
}

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

/** カメラアプリに渡す保存先を cache/captures/ に作る (res/xml/file_paths.xml). */
private fun createCaptureUri(context: Context): Uri {
    val dir = File(context.cacheDir, "captures").apply { mkdirs() }
    val file = File(dir, "capture_${System.currentTimeMillis()}.jpg")
    return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
}

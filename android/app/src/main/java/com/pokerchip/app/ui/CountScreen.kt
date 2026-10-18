package com.pokerchip.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.pokerchip.app.MainViewModel
import com.pokerchip.app.chips.computeChipPoints

/**
 * マッチに入らずにチップを数えるだけの画面. 撮影・ギャラリーのボタンと, 解析の結果を並べる.
 *
 * 検出の結果を実機で確かめるために残している (docs/web/app.md). 色と点数の対応を決めてあれば, 持ち点も出す.
 * @param onBack 戻るとき.
 * @param vm 画像の読み込みと解析.
 */
@Composable
fun CountScreen(onBack: () -> Unit, vm: MainViewModel = viewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    // 設定画面で対応を変えてから開いたときに, 新しい対応で持ち点を出すため.
    LaunchedEffect(Unit) { vm.reloadChipValues() }
    BackHandler(onBack = onBack)

    // edge-to-edge なので, Scaffold の padding でシステムバーとの重なりを避ける.
    Scaffold(topBar = { AppTopBar(title = "数えるだけ", onBack = onBack) }) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            ImagePickButtons(isEnabled = !state.isAnalyzing, onPicked = vm::analyze)

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

            val result = state.result
            if (result != null && !state.chipValues.isEmpty) {
                val points = remember(result, state.chipValues) { computeChipPoints(result, state.chipValues) }
                ChipPointsSummary(points)
            }

            state.bitmap?.let { bitmap ->
                ResultImage(bitmap, result)
                result?.let { ResultSummary(bitmap, it) }
            }

            // 解析が終われば (失敗しても) 元の画像を保存できる.
            if (state.source != null && !state.isAnalyzing) {
                OutlinedButton(onClick = vm::saveSource) { Text("この画像を保存") }
            }
            state.saveMessage?.let { Text(it) }
        }
    }
}

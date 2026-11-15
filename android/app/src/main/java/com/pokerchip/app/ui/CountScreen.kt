package com.pokerchip.app.ui

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
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.pokerchip.app.MainViewModel

/**
 * チップを数える画面. 撮影・ギャラリーのボタンと, 解析の結果を並べる.
 *
 * アプリの唯一の画面. core のチップの検出を実機で確かめるために使う (docs/architecture.md).
 * @param vm 画像の読み込みと解析.
 */
@Composable
fun CountScreen(vm: MainViewModel = viewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()

    // edge-to-edge なので, Scaffold の padding でシステムバーとの重なりを避ける.
    Scaffold(topBar = { AppTopBar(title = "チップを数える") }) { padding ->
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

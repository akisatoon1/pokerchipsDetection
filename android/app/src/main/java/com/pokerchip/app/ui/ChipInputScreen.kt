package com.pokerchip.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.pokerchip.app.MainViewModel
import com.pokerchip.app.chips.ChipPointsResult
import com.pokerchip.app.chips.computeChipPoints

/** 検出画面の ViewModel の名前. 数えるだけの画面とは別の画像と結果を持つため. */
private const val CHIP_INPUT_VIEW_MODEL_KEY = "chip-input"

/**
 * チップから持ち点を求め, Web の入力欄に入れる検出画面.
 *
 * 色と点数の対応がまだなければ, 先に設定画面を出す. 入れるのは人が「この点数を入れる」を押したときだけで,
 * 送信は Web で人が行う. 検出は間違うことがあるので, 必ず人の目を通すため (docs/web/app.md).
 * @param onInsert 求めた持ち点を Web の入力欄に入れるとき.
 * @param onCancel 何も入れずに戻るとき.
 * @param vm 画像の読み込みと解析.
 */
@Composable
fun ChipInputScreen(
    onInsert: (Int) -> Unit,
    onCancel: () -> Unit,
    vm: MainViewModel = viewModel(key = CHIP_INPUT_VIEW_MODEL_KEY),
) {
    val state by vm.state.collectAsStateWithLifecycle()
    var isEditingValues by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        vm.reset()
        if (vm.state.value.chipValues.isEmpty) isEditingValues = true
    }

    if (isEditingValues) {
        ChipValuesScreen(
            onBack = {
                isEditingValues = false
                // 対応を決めないままでは持ち点を求められないので, マッチの画面に戻る.
                if (state.chipValues.isEmpty) onCancel()
            },
            onSaved = {
                isEditingValues = false
                vm.reloadChipValues()
            },
        )
        return
    }
    BackHandler(onBack = onCancel)

    val result = state.result
    val points = remember(result, state.chipValues) { result?.let { computeChipPoints(it, state.chipValues) } }

    Scaffold(
        topBar = {
            AppTopBar(title = "チップから入力", onBack = onCancel) {
                TextButton(onClick = { isEditingValues = true }) { Text("色と点数") }
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("チップの山を撮影するか, ギャラリーから選んでください.")
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
                Text("エラー: $it 手で入力してください.", color = MaterialTheme.colorScheme.error)
            }

            if (points != null) {
                ChipPointsSummary(points)
                // 求められないときは押せない. 間違った点数を入れないため.
                Button(
                    enabled = points is ChipPointsResult.Success,
                    onClick = { if (points is ChipPointsResult.Success) onInsert(points.total) },
                ) { Text("この点数を入れる") }
            }

            state.bitmap?.let { bitmap ->
                ResultImage(bitmap, result)
                result?.let { ResultSummary(bitmap, it) }
            }
        }
    }
}

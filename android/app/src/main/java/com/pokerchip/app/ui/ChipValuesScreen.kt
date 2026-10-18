package com.pokerchip.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.pokerchip.app.ChipValuesViewModel
import com.pokerchip.app.chips.ChipColor

/**
 * 色と点数の設定画面. 7 色の見本と, チップ 1 枚の点数の欄を並べる.
 *
 * 保存しないで戻ったときは, 入力を捨てる.
 * @param onBack 保存しないで戻るとき.
 * @param onSaved 保存できたとき.
 * @param vm 欄の状態と保存.
 */
@Composable
fun ChipValuesScreen(onBack: () -> Unit, onSaved: () -> Unit, vm: ChipValuesViewModel = viewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { vm.reload() }
    BackHandler(onBack = onBack)

    Scaffold(topBar = { AppTopBar(title = "色と点数の設定", onBack = onBack) }) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("チップ 1 枚の点数を入れてください. このチップセットで使わない色は空欄にします.")
            for (color in ChipColor.entries) {
                ChipValueRow(
                    color = color,
                    text = state.texts[color].orEmpty(),
                    error = state.errors[color],
                    onChange = { vm.edit(color, it) },
                )
            }
            Button(onClick = { if (vm.save()) onSaved() }) { Text("保存") }
            Text(
                "この設定はこの端末にだけ保存され, どのマッチでも使います.",
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun ChipValueRow(color: ChipColor, text: String, error: String?, onChange: (String) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(
            modifier = Modifier
                .size(28.dp)
                .background(Color(color.swatchArgb))
                // 黒のチップの見本が背景に埋もれないよう枠を付ける.
                .border(1.dp, Color.LightGray),
        )
        Text(color.label, modifier = Modifier.width(72.dp))
        OutlinedTextField(
            value = text,
            onValueChange = onChange,
            singleLine = true,
            isError = error != null,
            supportingText = error?.let { { Text(it) } },
            placeholder = { Text("使わない") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.weight(1f),
        )
    }
}

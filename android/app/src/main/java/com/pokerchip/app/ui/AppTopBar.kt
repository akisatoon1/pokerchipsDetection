package com.pokerchip.app.ui

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * 画面の上のバー. 左に戻るボタン, 真ん中に題, 右に操作を並べる.
 *
 * アイコンの部品 (material-icons) を足さずに済むよう, ボタンは文字で出す.
 * @param title 題.
 * @param onBack 戻るボタンを押したとき. null なら戻るボタンを出さない.
 * @param isBackEnabled 戻るボタンを押せるか.
 * @param actions 右に並べる操作.
 */
@Composable
fun AppTopBar(
    title: String,
    onBack: (() -> Unit)?,
    isBackEnabled: Boolean = true,
    actions: @Composable RowScope.() -> Unit = {},
) {
    Surface(color = MaterialTheme.colorScheme.surfaceContainer) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                // edge-to-edge なので, ステータスバーと重ならないようにする.
                .statusBarsPadding()
                .heightIn(min = 56.dp)
                .padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (onBack != null) {
                TextButton(onClick = onBack, enabled = isBackEnabled) { Text("← 戻る") }
            }
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 8.dp),
            )
            actions()
        }
    }
}

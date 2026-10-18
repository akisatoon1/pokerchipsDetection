package com.pokerchip.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.webkit.JavaScriptReplyProxy
import com.pokerchip.app.ui.ChipInputScreen
import com.pokerchip.app.ui.ChipValuesScreen
import com.pokerchip.app.ui.CountScreen
import com.pokerchip.app.ui.PokerChipTheme
import com.pokerchip.app.ui.WebScreen
import com.pokerchip.app.web.WebBridge
import com.pokerchip.app.web.chipPointsMessage

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            PokerChipTheme {
                PokerChipApp()
            }
        }
    }
}

/** マッチの画面 (WebView) の上に重ねて出す画面. */
private enum class Overlay {
    NONE,
    COUNT,
    CHIP_VALUES,
    CHIP_INPUT,
}

/** アプリ全体. マッチの画面を常に置き, ほかの画面はその上に重ねる. */
@Composable
private fun PokerChipApp() {
    var overlay by rememberSaveable { mutableStateOf(Overlay.NONE) }
    // 検出画面で求めた持ち点を Web に返す口. 「チップから入力」が押されたときに受け取る.
    var chipInputReply by remember { mutableStateOf<JavaScriptReplyProxy?>(null) }
    Box(modifier = Modifier.fillMaxSize()) {
        // WebView は閉じずに残す. ほかの画面から戻ったときに, 開いていたページと入力中の欄を保つため.
        WebScreen(
            baseUrl = BuildConfig.WEB_BASE_URL,
            isActive = overlay == Overlay.NONE,
            onOpenCount = { overlay = Overlay.COUNT },
            onOpenChipValues = { overlay = Overlay.CHIP_VALUES },
            onStartChipInput = { reply ->
                chipInputReply = reply
                overlay = Overlay.CHIP_INPUT
            },
        )
        when (overlay) {
            Overlay.NONE -> Unit
            Overlay.COUNT -> CountScreen(onBack = { overlay = Overlay.NONE })
            Overlay.CHIP_VALUES -> ChipValuesScreen(
                onBack = { overlay = Overlay.NONE },
                onSaved = { overlay = Overlay.NONE },
            )
            Overlay.CHIP_INPUT -> {
                val reply = chipInputReply
                if (reply == null) {
                    // アプリが裏で終了されて返す口を失ったときは, 入れられないのでマッチの画面に戻る.
                    LaunchedEffect(Unit) { overlay = Overlay.NONE }
                } else {
                    ChipInputScreen(
                        onInsert = { points ->
                            WebBridge.sendReply(reply, chipPointsMessage(points))
                            overlay = Overlay.NONE
                        },
                        onCancel = { overlay = Overlay.NONE },
                    )
                }
            }
        }
    }
}

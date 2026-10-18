package com.pokerchip.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.pokerchip.app.ui.CountScreen
import com.pokerchip.app.ui.PokerChipTheme
import com.pokerchip.app.ui.WebScreen

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
}

/** アプリ全体. マッチの画面を常に置き, ほかの画面はその上に重ねる. */
@Composable
private fun PokerChipApp() {
    var overlay by rememberSaveable { mutableStateOf(Overlay.NONE) }
    Box(modifier = Modifier.fillMaxSize()) {
        // WebView は閉じずに残す. ほかの画面から戻ったときに, 開いていたページと入力中の欄を保つため.
        WebScreen(
            baseUrl = BuildConfig.WEB_BASE_URL,
            isActive = overlay == Overlay.NONE,
            onOpenCount = { overlay = Overlay.COUNT },
        )
        when (overlay) {
            Overlay.NONE -> Unit
            Overlay.COUNT -> CountScreen(onBack = { overlay = Overlay.NONE })
        }
    }
}

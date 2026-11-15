package com.pokerchip.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.pokerchip.app.ui.CountScreen
import com.pokerchip.app.ui.PokerChipTheme

/**
 * アプリの入口. チップを数える画面だけを出す.
 *
 * アプリは core のチップの検出を実機で確かめるためのもの. みんなで使う点数計算は Web にある (docs/architecture.md).
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            PokerChipTheme {
                CountScreen()
            }
        }
    }
}

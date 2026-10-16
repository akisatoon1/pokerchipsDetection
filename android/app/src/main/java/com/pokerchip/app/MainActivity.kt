package com.pokerchip.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.pokerchip.app.ui.MainScreen
import com.pokerchip.app.ui.PokerChipTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            PokerChipTheme {
                MainScreen()
            }
        }
    }
}

package com.pokerchip.app

import android.app.Application
import android.graphics.Bitmap
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

data class UiState(
    val bitmap: Bitmap? = null,
    val result: AnalysisResult? = null,
    val isAnalyzing: Boolean = false,
    val error: String? = null,
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    var state by mutableStateOf(UiState())
        private set

    // native 側は同時に1スレッドからしか使えないので, Mutex で直列化する.
    private val nativeLock = Mutex()
    private var native: PokerChipNative? = null

    /** 画像を読み込んで解析する. */
    fun analyze(uri: Uri) {
        state = UiState(isAnalyzing = true)
        viewModelScope.launch {
            state = try {
                val bitmap = withContext(Dispatchers.IO) {
                    ImageLoader.load(getApplication(), uri)
                }
                state = state.copy(bitmap = bitmap)
                val result = withContext(Dispatchers.Default) {
                    nativeLock.withLock { getNative().analyze(bitmap) }
                }
                state.copy(result = result, isAnalyzing = false)
            } catch (e: Exception) {
                state.copy(isAnalyzing = false, error = e.message ?: e.toString())
            }
        }
    }

    // モデルの読み込みは重いので, 初めて解析するときに1回だけ行う.
    private fun getNative(): PokerChipNative {
        native?.let { return it }
        val model = getApplication<Application>().assets.open(MODEL_ASSET).use { it.readBytes() }
        return PokerChipNative(model).also { native = it }
    }

    override fun onCleared() {
        val n = native ?: return
        native = null
        // 解析中なら終わるのを待ってから解放する.
        CoroutineScope(Dispatchers.Default).launch { nativeLock.withLock { n.close() } }
    }

    companion object {
        /** scripts/export_model.sh が assets に置くファイル名. */
        const val MODEL_ASSET = "chip_detector.onnx"
    }
}

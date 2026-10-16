package com.pokerchip.app

import android.app.Application
import android.graphics.Bitmap
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/** 画面に出すもの. */
data class UiState(
    val bitmap: Bitmap? = null,
    val result: AnalysisResult? = null,
    val isAnalyzing: Boolean = false,
    val error: String? = null,
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    // native 側は同時に1スレッドからしか使えないので, Mutex で直列化する.
    private val nativeLock = Mutex()
    private var native: PokerChipNative? = null

    /** 画像を読み込んで解析する. */
    fun analyze(uri: Uri) {
        _state.value = UiState(isAnalyzing = true)
        viewModelScope.launch {
            try {
                val bitmap = withContext(Dispatchers.IO) {
                    ImageLoader.load(getApplication(), uri)
                }
                // 解析は時間がかかるので, 先に画像だけ出しておく.
                _state.update { it.copy(bitmap = bitmap) }
                val result = withContext(Dispatchers.Default) {
                    nativeLock.withLock { getNative().analyze(bitmap) }
                }
                _state.update { it.copy(result = result, isAnalyzing = false) }
            } catch (e: Exception) {
                _state.update { it.copy(isAnalyzing = false, error = e.message ?: e.toString()) }
            }
        }
    }

    // モデルの読み込みは重いので, 初めて解析するときに1回だけ行う. nativeLock の中で呼ぶこと.
    private fun getNative(): PokerChipNative {
        native?.let { return it }
        val model = getApplication<Application>().assets.open(MODEL_ASSET).use { it.readBytes() }
        return PokerChipNative(model).also { native = it }
    }

    override fun onCleared() {
        // viewModelScope はもう止まっているので, 別のスコープで解析が終わるのを待ってから解放する.
        CoroutineScope(Dispatchers.Default).launch {
            nativeLock.withLock {
                native?.close()
                native = null
            }
        }
    }

    companion object {
        /** scripts/export_model.sh が assets に置くファイル名. */
        const val MODEL_ASSET = "chip_detector.onnx"
    }
}

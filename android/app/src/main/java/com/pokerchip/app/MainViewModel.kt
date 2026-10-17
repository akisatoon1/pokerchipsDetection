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
    /** 解析した画像の元のファイル. デバッグ用に保存するときに使う. */
    val source: Uri? = null,
    val bitmap: Bitmap? = null,
    val result: AnalysisResult? = null,
    val isAnalyzing: Boolean = false,
    val error: String? = null,
    /** 画像を保存した結果 (保存先か失敗の理由). */
    val saveMessage: String? = null,
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state.asStateFlow()

    // native 側は同時に1スレッドからしか使えないので, Mutex で直列化する.
    private val nativeLock = Mutex()
    private var native: PokerChipNative? = null

    /** 画像を読み込んで解析する. */
    fun analyze(uri: Uri) {
        _state.value = UiState(source = uri, isAnalyzing = true)
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

    /** 解析した元の画像を Pictures/PokerChip/ に保存する. 検出がうまくいかなかった画像のデバッグ用. */
    fun saveSource() {
        val uri = _state.value.source ?: return
        viewModelScope.launch {
            val message = try {
                val path = withContext(Dispatchers.IO) { ImageSaver.save(getApplication(), uri) }
                "保存しました: $path"
            } catch (e: Exception) {
                "保存できませんでした: ${e.message ?: e}"
            }
            // 保存中に別の画像を解析し始めていたら, その画面には出さない.
            _state.update { if (it.source == uri) it.copy(saveMessage = message) else it }
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

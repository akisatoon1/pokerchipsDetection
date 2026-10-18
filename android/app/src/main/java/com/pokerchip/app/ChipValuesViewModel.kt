package com.pokerchip.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import com.pokerchip.app.chips.ChipColor
import com.pokerchip.app.chips.ChipValueInput
import com.pokerchip.app.chips.ChipValues
import com.pokerchip.app.chips.ChipValuesStore
import com.pokerchip.app.chips.parseChipValue
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/** 設定画面に出すもの. */
data class ChipValuesUiState(
    /** 色ごとの欄の文字. */
    val texts: Map<ChipColor, String>,
    /** 受け付けられない欄の説明. */
    val errors: Map<ChipColor, String> = emptyMap(),
)

/** 色と点数の設定画面の状態. 欄の文字を持ち, 保存のときに読む. */
class ChipValuesViewModel(application: Application) : AndroidViewModel(application) {
    private val store = ChipValuesStore(application)
    private val _state = MutableStateFlow(ChipValuesUiState(textsOf(store.load())))
    val state: StateFlow<ChipValuesUiState> = _state.asStateFlow()

    /** 保存した点数で欄を埋め直す. 画面を開くたびに呼び, 保存しなかった入力を捨てる. */
    fun reload() {
        _state.value = ChipValuesUiState(textsOf(store.load()))
    }

    /** 1 つの色の欄を書き換える. その欄のエラーは, 直しているので消す. */
    fun edit(color: ChipColor, text: String) {
        _state.update { it.copy(texts = it.texts + (color to text), errors = it.errors - color) }
    }

    /**
     * 欄を読んで保存する.
     *
     * @return 保存できたら true. 受け付けられない欄があれば, その欄にエラーを出して何も保存せず false.
     */
    fun save(): Boolean {
        val texts = _state.value.texts
        val points = mutableMapOf<ChipColor, Int>()
        val errors = mutableMapOf<ChipColor, String>()
        for (color in ChipColor.entries) {
            when (val input = parseChipValue(texts[color].orEmpty())) {
                is ChipValueInput.Valid -> input.points?.let { points[color] = it }
                is ChipValueInput.Invalid -> errors[color] = input.reason
            }
        }
        if (errors.isNotEmpty()) {
            _state.update { it.copy(errors = errors) }
            return false
        }
        store.save(ChipValues(points))
        return true
    }

    private fun textsOf(values: ChipValues): Map<ChipColor, String> =
        ChipColor.entries.associateWith { values.points[it]?.toString().orEmpty() }
}

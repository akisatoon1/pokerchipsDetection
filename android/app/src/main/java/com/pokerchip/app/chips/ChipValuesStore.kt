package com.pokerchip.app.chips

import android.content.Context
import androidx.core.content.edit

/**
 * 色ごとの点数を端末に保存する.
 *
 * バックエンドには換算を置かないと決めているので, 端末にだけ持つ (docs/web/app.md).
 * @param context SharedPreferences を開くのに使う.
 */
class ChipValuesStore(context: Context) {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    /**
     * 保存した点数を読む.
     *
     * @return 色ごとの点数. 何も保存していなければ空. 範囲外の値は決めていないものとして扱う.
     */
    fun load(): ChipValues {
        val points = ChipColor.entries.mapNotNull { color ->
            val value = preferences.getInt(color.coreName, 0)
            if (value in 1..MAX_POINTS) color to value else null
        }
        return ChipValues(points.toMap())
    }

    /**
     * 点数を保存する. 前に保存したものは消し, 渡したものだけにする.
     *
     * @param values 色ごとの点数. 入っていない色は使わない色として保存する.
     */
    fun save(values: ChipValues) {
        preferences.edit {
            clear()
            for ((color, points) in values.points) putInt(color.coreName, points)
        }
    }

    private companion object {
        const val PREFERENCES_NAME = "chip_values"
    }
}

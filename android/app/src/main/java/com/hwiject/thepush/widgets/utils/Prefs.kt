package com.hwiject.thepush.widgets.utils

import android.content.Context
import android.content.SharedPreferences

object Prefs {
  private const val NAME = "thepush_widget_prefs"

  private fun sp(ctx: Context): SharedPreferences =
    ctx.getSharedPreferences(NAME, Context.MODE_PRIVATE)

  fun putString(ctx: Context, key: String, value: String?) {
    // commit()로 동기 저장 → 위젯 갱신 직후에도 즉시 읽힘
    sp(ctx).edit().putString(key, value).commit()
  }

  fun getString(ctx: Context, key: String, def: String?): String? =
    sp(ctx).getString(key, def)

  fun putInt(ctx: Context, key: String, value: Int) {
    sp(ctx).edit().putInt(key, value).commit()
  }

  fun getInt(ctx: Context, key: String, def: Int): Int =
    sp(ctx).getInt(key, def)
}

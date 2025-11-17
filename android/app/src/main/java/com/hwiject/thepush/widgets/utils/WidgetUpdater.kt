package com.hwiject.thepush.widgets.utils

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent

object WidgetUpdater {
  fun <T> forceUpdate(ctx: Context, provider: Class<T>) {
    val mgr = AppWidgetManager.getInstance(ctx)
    val ids = mgr.getAppWidgetIds(ComponentName(ctx, provider))
    if (ids != null && ids.isNotEmpty()) {
      val intent = Intent(ctx, provider).apply {
        action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
      }
      ctx.sendBroadcast(intent)
    }
  }
}

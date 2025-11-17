package com.hwiject.thepush.widgets.bridge

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import com.hwiject.thepush.widgets.single.Single1x1Provider
import com.hwiject.thepush.widgets.utils.Prefs

class WidgetBridgeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "WidgetBridge"

  @ReactMethod
  fun setPref(key: String, value: String?) {
    // 동기 저장(commit)로 즉시 반영
    Prefs.putString(reactContext, key, value)
  }

  @ReactMethod
  fun updateAllWidgets() {
    val ctx: Context = reactContext
    val mgr = AppWidgetManager.getInstance(ctx)

    // 1x1 위젯만 갱신
    val idsSingle = mgr.getAppWidgetIds(ComponentName(ctx, Single1x1Provider::class.java))
    if (idsSingle != null && idsSingle.isNotEmpty()) {
      val intent = Intent(ctx, Single1x1Provider::class.java).apply {
        action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, idsSingle)
      }
      ctx.sendBroadcast(intent)
    }
  }
}

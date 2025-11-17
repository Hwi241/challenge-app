package com.hwiject.thepush.widgets.single

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import com.hwiject.thepush.R
import com.hwiject.thepush.widgets.single.ui.ChoiceActivity
import com.hwiject.thepush.widgets.utils.Prefs
import java.io.File
import org.json.JSONArray

class Single1x1Provider : AppWidgetProvider() {

  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) {
      updateOne(context, appWidgetManager, id)
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    val action = intent.action
    if (action == ACTION_REFRESH || action == AppWidgetManager.ACTION_APPWIDGET_UPDATE) {
      val mgr = AppWidgetManager.getInstance(context)
      val idsExtra = intent.getIntArrayExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS)
      val ids = if (idsExtra != null && idsExtra.isNotEmpty()) idsExtra
      else mgr.getAppWidgetIds(ComponentName(context, Single1x1Provider::class.java))
      for (id in ids) updateOne(context, mgr, id)
    }
  }

  private fun updateOne(context: Context, mgr: AppWidgetManager, appWidgetId: Int) {
    val views = RemoteViews(context.packageName, R.layout.widget_single_1x1_root)
    val selectedId = Prefs.getString(context, keyForWidgetChallenge(appWidgetId), null)

    if (selectedId == null || selectedId.isBlank()) {
      views.setTextViewText(R.id.txtTitle, "도전 선택")
      views.setViewVisibility(R.id.imgDonut, View.GONE)
      setClickOpenConfig(context, views, appWidgetId)
      mgr.updateAppWidget(appWidgetId, views)
      return
    }

    val title = resolveTitle(context, selectedId)
    if (title != null && title.isNotBlank()) views.setTextViewText(R.id.txtTitle, title)
    else views.setTextViewText(R.id.txtTitle, "도전")

    val bmpPath = resolveSnapshotPath(context, selectedId)
    if (bmpPath != null && bmpPath.isNotBlank()) {
      val bm = BitmapFactory.decodeFile(bmpPath)
      if (bm != null) {
        views.setImageViewBitmap(R.id.imgDonut, bm)
        views.setViewVisibility(R.id.imgDonut, View.VISIBLE)
      } else {
        views.setViewVisibility(R.id.imgDonut, View.GONE)
      }
    } else {
      views.setViewVisibility(R.id.imgDonut, View.GONE)
    }

    setClickOpenChoice(context, views, selectedId)
    mgr.updateAppWidget(appWidgetId, views)
  }

  private fun resolveTitle(context: Context, challengeId: String): String? {
    val cached = Prefs.getString(context, "CH_SUMMARY_${challengeId}_TITLE", null)
    if (cached != null && cached.isNotBlank()) return cached

    var txt: String? = null
    val f = File(context.filesDir, "widget_challenges.json")
    if (f.exists()) {
      try { txt = f.readText() } catch (_: Throwable) {}
    }
    if (txt == null || txt.isBlank()) txt = Prefs.getString(context, "WIDGET_CHALLENGES_JSON", null)
    if (txt == null || txt.isBlank()) return null

    try {
      val arr = JSONArray(txt)
      val len = arr.length()
      var i = 0
      while (i < len) {
        val o = arr.getJSONObject(i)
        val id = o.optString("id").trim()
        if (id == challengeId) {
          val t = o.optString("title")
          if (t != null && t.isNotBlank()) return t else return null
        }
        i++
      }
    } catch (_: Throwable) {}
    return null
  }

  private fun resolveSnapshotPath(context: Context, challengeId: String): String? {
    val raw = Prefs.getString(context, "SNAPSHOT_1x1_${challengeId}", null)
    val fromPrefs = normalizePath(raw)
    if (fromPrefs != null && fromPrefs.isNotBlank()) {
      val pf = File(fromPrefs)
      if (pf.exists()) return pf.absolutePath
    }
    val f2 = File(context.filesDir, "donut_1x1_${challengeId}.png")
    return if (f2.exists()) f2.absolutePath else null
  }

  private fun normalizePath(s: String?): String? {
    if (s == null || s.isBlank()) return null
    return if (s.startsWith("file://")) Uri.parse(s).path else s
  }

  private fun setClickOpenConfig(context: Context, views: RemoteViews, appWidgetId: Int) {
    val intent = Intent(context, com.hwiject.thepush.widgets.single.ui.ConfigActivity::class.java)
    intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val pi = PendingIntent.getActivity(context, appWidgetId, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    views.setOnClickPendingIntent(R.id.root, pi)
  }

  private fun setClickOpenChoice(context: Context, views: RemoteViews, challengeId: String) {
    val intent = Intent(context, ChoiceActivity::class.java)
    intent.putExtra("challengeId", challengeId)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val pi = PendingIntent.getActivity(context, challengeId.hashCode(), intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    views.setOnClickPendingIntent(R.id.root, pi)
  }

  private fun keyForWidgetChallenge(appWidgetId: Int): String {
    return "SINGLE_1x1_${appWidgetId}_CH_ID"
  }

  companion object {
    const val ACTION_REFRESH = "com.hwiject.thepush.widgets.single.ACTION_REFRESH"
  }
}

package com.hwiject.thepush.widgets.single

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.widget.RemoteViews
import com.hwiject.thepush.R
import com.hwiject.thepush.widgets.single.ui.ChoiceActivity
import com.hwiject.thepush.widgets.utils.Prefs
import org.json.JSONArray
import java.io.File
import java.util.ArrayDeque

class Single4x5Provider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) update(context, manager, id)
  }

  private fun update(context: Context, manager: AppWidgetManager, appWidgetId: Int) {
    val rv = RemoteViews(context.packageName, R.layout.widget_single_4x5_root)
    val selId = Prefs.getString(context, "SINGLE_SELECTED_ID_$appWidgetId", null)

    val title = Prefs.getString(context, "CH_SUMMARY_${selId}_TITLE", null)
      ?: resolveTitle(context, selId) ?: selId ?: ""
    rv.setTextViewText(R.id.title, title)

    val bmp = resolveBitmap(context, "full_4x5_${selId}.png")
    if (bmp != null) rv.setImageViewBitmap(R.id.image, bmp)
    else rv.setImageViewResource(R.id.image, R.drawable.widget_placeholder)

    val intent = Intent(context, ChoiceActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra("challengeId", selId)
    }
    val pi = PendingIntent.getActivity(
      context, appWidgetId, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    rv.setOnClickPendingIntent(R.id.container, pi)
    manager.updateAppWidget(appWidgetId, rv)
  }

  private fun resolveTitle(context: Context, id: String?): String? {
    if (id.isNullOrBlank()) return null
    val f = findFileRecursively(context.filesDir, "widget_challenges.json") ?: return null
    return runCatching {
      val arr = JSONArray(f.readText())
      (0 until arr.length())
        .asSequence()
        .map { arr.getJSONObject(it) }
        .firstOrNull { it.optString("id") == id }
        ?.optString("title")
    }.getOrNull()
  }

  private fun resolveBitmap(context: Context, name: String) =
    findFileRecursively(context.filesDir, name)?.let { BitmapFactory.decodeFile(it.absolutePath) }

  private fun findFileRecursively(root: File, targetName: String): File? {
    val q: ArrayDeque<File> = ArrayDeque()
    q.add(root)
    while (q.isNotEmpty()) {
      val cur = q.removeFirst()
      if (cur.isFile && cur.name == targetName) return cur
      if (cur.isDirectory) cur.listFiles()?.forEach { q.addLast(it) }
    }
    return null
  }
}

package com.hwiject.thepush.widgets.list

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.hwiject.thepush.R
import com.hwiject.thepush.widgets.utils.Prefs
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.ArrayDeque

class ListRemoteViewsService : RemoteViewsService() {
  override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = Factory(applicationContext, intent)

  class Factory(private val context: Context, private val intent: Intent) : RemoteViewsFactory {
    private var items: MutableList<JSONObject> = mutableListOf()
    private var maxItems: Int = 3
    private var appWidgetId: Int = 0

    override fun onCreate() {
      appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, 0)
    }

    override fun onDataSetChanged() {
      maxItems = Prefs.getString(context, "LIST_WIDGET_MAX_ITEMS_$appWidgetId", "3")!!.toInt()

      var json: String? = Prefs.getString(context, "WIDGET_CHALLENGES_JSON", null)
      if (json.isNullOrEmpty()) {
        val f = findFileRecursively(context.filesDir, "widget_challenges.json")
        if (f != null && f.exists()) json = runCatching { f.readText() }.getOrNull()
      }

      val arr = runCatching { JSONArray(json ?: "[]") }.getOrNull() ?: JSONArray()
      items.clear()
      val count = arr.length().coerceAtMost(maxItems)
      for (i in 0 until count) items.add(arr.getJSONObject(i))
    }

    override fun onDestroy() { items.clear() }
    override fun getCount(): Int = items.size

    override fun getViewAt(position: Int): RemoteViews {
      val obj = items[position]
      val title = obj.optString("title", obj.optString("id", ""))
      val pct = obj.optInt("progressPct", 0)
      val id = obj.optString("id", "")

      val rv = RemoteViews(context.packageName, R.layout.item_widget_challenge)
      rv.setTextViewText(R.id.title, title)
      rv.setTextViewText(R.id.percentText, "${pct}%")
      rv.setProgressBar(R.id.progressBar, 100, pct, false)

      // 제목 → 대시보드
      val dashboard = Intent(Intent.ACTION_VIEW).apply {
        data = android.net.Uri.parse("thepush://dashboard?challengeId=$id")
      }
      rv.setOnClickFillInIntent(R.id.title, dashboard)

      // 버튼 → 업로드(인증하기)
      val upload = Intent(Intent.ACTION_VIEW).apply {
        data = android.net.Uri.parse("thepush://upload?challengeId=$id")
      }
      rv.setOnClickFillInIntent(R.id.button, upload)

      return rv
    }

    override fun getLoadingView(): RemoteViews? = null
    override fun getViewTypeCount(): Int = 1
    override fun getItemId(position: Int): Long = position.toLong()
    override fun hasStableIds(): Boolean = true

    private fun findFileRecursively(root: File, targetName: String): File? {
      val q: ArrayDeque<File> = ArrayDeque()
      q.add(root)
      while (q.isNotEmpty()) {
        val cur = q.removeFirst()
        if (cur.isFile && cur.name == targetName) return cur
        if (cur.isDirectory) cur.listFiles()?.forEach { child -> q.addLast(child) }
      }
      return null
    }
  }
}

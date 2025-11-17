package com.hwiject.thepush.widgets.single.ui

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.graphics.BitmapFactory
import android.os.Bundle
import android.widget.*
import android.widget.Toast
import android.view.View
import android.app.PendingIntent
import android.content.Context
import com.hwiject.thepush.R
import com.hwiject.thepush.widgets.utils.Prefs
import com.hwiject.thepush.widgets.utils.WidgetUpdater
import com.hwiject.thepush.widgets.single.Single1x1Provider
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import android.widget.RemoteViews
import android.net.Uri

class ConfigActivity : Activity() {

  private var appWidgetId: Int = AppWidgetManager.INVALID_APPWIDGET_ID
  private lateinit var listView: ListView
  private lateinit var confirm: Button
  private var adapter: BaseAdapter? = null
  private val items: MutableList<Choice> = mutableListOf()
  private var selectedIndex: Int = -1

  data class Choice(val id: String, val title: String, val progressPct: Int)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_config)

    // 시스템이 RESULT_OK 아니면 위젯 배치를 취소하도록 기본값
    setResult(RESULT_CANCELED)

    appWidgetId = intent?.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
      ?: AppWidgetManager.INVALID_APPWIDGET_ID
    if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return }

    listView = findViewById(R.id.list)
    confirm = findViewById(R.id.confirm)

    listView.choiceMode = ListView.CHOICE_MODE_SINGLE

    adapter = object : BaseAdapter() {
      override fun getCount() = items.size
      override fun getItem(position: Int): Any = items[position]
      override fun getItemId(position: Int) = position.toLong()
      override fun getView(position: Int, convertView: android.view.View?, parent: android.view.ViewGroup?): android.view.View {
        val v = convertView ?: layoutInflater.inflate(android.R.layout.simple_list_item_single_choice, parent, false)
        val tv = v.findViewById<TextView>(android.R.id.text1)
        val c = items[position]
        tv.text = "${c.title}  (${c.progressPct}%)"
        return v
      }
    }
    listView.adapter = adapter
    listView.setOnItemClickListener { _, _, pos, _ -> selectedIndex = pos }

    reloadChoices()

    confirm.setOnClickListener {
      if (selectedIndex < 0 || selectedIndex >= items.size) {
        Toast.makeText(this, "도전을 선택해 주세요.", Toast.LENGTH_SHORT).show()
        return@setOnClickListener
      }
      val chosen = items[selectedIndex]

      // 1) 위젯ID → 도전ID 저장(동기 commit)
      Prefs.putString(this, keyForWidgetChallenge(appWidgetId), chosen.id)
      Prefs.putString(this, "CH_SUMMARY_${chosen.id}_TITLE", chosen.title)

      // 2) 선택 즉시 RemoteViews 적용(“선택 후 생성” 보장)
      applyImmediateRemoteViews(this, appWidgetId, chosen.id, chosen.title)

      // 3) RESULT_OK 반환 → 시스템이 이 시점에 위젯을 배치
      val result = Intent().apply { putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId) }
      setResult(RESULT_OK, result)

      // 4) 동일 타입 전체 갱신(안전망)
      WidgetUpdater.forceUpdate(this, Single1x1Provider::class.java)

      finish()
    }
  }

  override fun onResume() {
    super.onResume()
    reloadChoices()
  }

  private fun keyForWidgetChallenge(appWidgetId: Int): String = "SINGLE_1x1_${appWidgetId}_CH_ID"

  private fun reloadChoices() {
    items.clear()
    items.addAll(loadChoices())
    adapter?.notifyDataSetChanged()

    val savedId = Prefs.getString(this, keyForWidgetChallenge(appWidgetId), null)
    if (!savedId.isNullOrBlank()) {
      val idx = items.indexOfFirst { it.id == savedId }
      if (idx >= 0) {
        selectedIndex = idx
        listView.setItemChecked(idx, true)
      }
    }
  }

  private fun loadChoices(): List<Choice> {
    val file = File(filesDir, "widget_challenges.json")
    var jsonText: String? = if (file.exists()) runCatching { file.readText() }.getOrNull() else null
    if (jsonText.isNullOrBlank()) jsonText = Prefs.getString(this, "WIDGET_CHALLENGES_JSON", null)
    if (jsonText.isNullOrBlank()) return emptyList()

    return runCatching {
      val arr = JSONArray(jsonText)
      val out = mutableListOf<Choice>()
      for (i in 0 until arr.length()) {
        val o: JSONObject = arr.getJSONObject(i)
        val id = o.optString("id").trim()
        if (id.isEmpty()) continue
        val title = (o.optString("title") ?: id).ifBlank { id }
        val pct = o.optInt("progressPct", 0).coerceIn(0, 100)
        out.add(Choice(id, title, pct))
      }
      out
    }.getOrNull() ?: emptyList()
  }

  private fun applyImmediateRemoteViews(ctx: Context, appWidgetId: Int, challengeId: String, title: String) {
    val views = RemoteViews(ctx.packageName, R.layout.widget_single_1x1_root)
    views.setTextViewText(R.id.txtTitle, title)

    val bmpPath = resolveSnapshotPath(ctx, challengeId)
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

    // 클릭 시 ChoiceActivity
    val intent = Intent(ctx, com.hwiject.thepush.widgets.single.ui.ChoiceActivity::class.java)
    intent.putExtra("challengeId", challengeId)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val pi = PendingIntent.getActivity(
      ctx, challengeId.hashCode(), intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    views.setOnClickPendingIntent(R.id.root, pi)

    AppWidgetManager.getInstance(ctx).updateAppWidget(appWidgetId, views)
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
}

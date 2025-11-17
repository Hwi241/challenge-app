package com.hwiject.thepush.widgets.list

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.hwiject.thepush.R

class ListWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (appWidgetId in appWidgetIds) updateAppWidget(context, appWidgetManager, appWidgetId)
  }

  private fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
    val rv = RemoteViews(context.packageName, R.layout.widget_list_root)

    val svcIntent = Intent(context, ListRemoteViewsService::class.java).apply {
      putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
    }
    rv.setRemoteAdapter(R.id.listView, svcIntent)

    // ACTION_VIEW 템플릿로 → fill-in 인텐트가 딥링크를 제대로 연다
    val template = Intent(Intent.ACTION_VIEW)
    val pi = PendingIntent.getActivity(
      context, 0, template,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    rv.setPendingIntentTemplate(R.id.listView, pi)

    appWidgetManager.updateAppWidget(appWidgetId, rv)
    appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.listView)
  }
}

// android/app/src/main/java/com/hwiject/thepush/widgets/progress/ProgressWidgetConfigActivity.kt
package com.hwiject.thepush.widgets.progress

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.ListView
import android.widget.TextView
import android.widget.Toast
import com.hwiject.thepush.R

class ProgressWidgetConfigActivity : Activity() {

    companion object {
        // 위젯에서 100%일 때 버튼이 눌리면 사용할 커스텀 액션
        const val ACTION_SHOW_REWARD_GUIDE =
            "com.hwiject.thepush.widgets.progress.ACTION_SHOW_REWARD_GUIDE"
    }

    private var appWidgetId: Int = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // ✅ 위젯에서 '도전 완료' 버튼을 눌렀을 때: 안내 모달만 띄우고 종료
        if (intent?.action == ACTION_SHOW_REWARD_GUIDE) {
            android.app.AlertDialog.Builder(this)
                .setTitle("도전 완료 🎉")
                .setMessage("어플에서 보상받기를 눌러주세요!")
                .setPositiveButton("확인") { dialog, _ ->
                    dialog.dismiss()
                    finish()
                }
                .setOnCancelListener {
                    finish()
                }
                .show()
            return
        }

        // 기본값: 취소 (기존 설정 화면 동작)
        setResult(RESULT_CANCELED)

        setContentView(R.layout.activity_progress_widget_config)


        // 위젯 ID 가져오기
        appWidgetId =
            intent?.extras?.getInt(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID
            ) ?: AppWidgetManager.INVALID_APPWIDGET_ID

        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        val listView: ListView = findViewById(R.id.listChallenges)
        val textEmpty: TextView = findViewById(R.id.textEmpty)

        val challenges = ProgressWidgetProvider.loadChallenges(this)

        if (challenges.isEmpty()) {
                textEmpty.visibility = View.VISIBLE
                textEmpty.text = "도전 목록을 불러올 수 없습니다.
앱을 먼저 실행한 뒤 위젯을 추가해 주세요."
            } else {
                textEmpty.visibility = View.GONE
            }

        val titles = challenges.map { ch ->
            val title =
                if (ch.title.isNotBlank()) ch.title else "(제목 없음)"
            "$title  (${ch.percent}%)"
        }

        val adapter = ArrayAdapter(
            this,
            android.R.layout.simple_list_item_1,
            titles
        )
        listView.adapter = adapter

        listView.onItemClickListener =
            AdapterView.OnItemClickListener { _, _, position, _ ->
                val selected = challenges[position]

                // 선택한 도전 ID를 위젯에 연결
                ProgressWidgetProvider.saveWidgetChallengeId(
                    this,
                    appWidgetId,
                    selected.id
                )

                // 즉시 위젯 업데이트
                val appWidgetManager = AppWidgetManager.getInstance(this)
                ProgressWidgetProvider.updateAppWidget(
                    this,
                    appWidgetManager,
                    appWidgetId
                )

                // 결과 OK 반환
                val resultValue = Intent().apply {
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                }
                setResult(RESULT_OK, resultValue)
                finish()
            }
    }
}

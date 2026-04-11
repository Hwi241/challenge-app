package com.hwiject.thepush.widgets.progress

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import android.widget.RemoteViews
import com.hwiject.thepush.R
import org.json.JSONArray
import java.io.File

data class WidgetChallenge(
    val id: String,
    val title: String,
    val percent: Int,
    val startDate: String?,
    val endDate: String?,
    val goalScore: Int,
    val targetScore: Int,
    val rewardTitle: String?,
    val reward: String?
)

class ProgressWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val TAG = "ProgressWidget"
        private const val PREFS_NAME = "progress_widget_prefs"
        private const val KEY_PREFIX = "widget_"

        /**
         * widget_challenges.json 을 읽어서 도전 리스트를 반환
         */
        fun loadChallenges(context: Context): List<WidgetChallenge> {
            return try {
                val file = File(context.filesDir, "widget_challenges.json")
                if (!file.exists()) {
                    Log.d(TAG, "widget_challenges.json not found")
                    emptyList()
                } else {
                    val text = file.readText(Charsets.UTF_8)
                    val arr = JSONArray(text)
                    val out = mutableListOf<WidgetChallenge>()

                    for (i in 0 until arr.length()) {
                        val obj = arr.optJSONObject(i) ?: continue
                        val idRaw = obj.optString("id", "").trim()
                        if (idRaw.isEmpty()) continue

                        val title = obj.optString("title", "(제목 없음)")
                        val percent = obj.optInt("percent", 0).coerceIn(0, 100)

                        val startDate =
                            if (obj.has("startDate")) obj.optString("startDate", null) else null
                        val endDate =
                            if (obj.has("endDate")) obj.optString("endDate", null) else null

                        // goalScore / targetScore 중 있는 값 우선
                        val goalScore = when {
                            obj.has("goalScore") -> obj.optInt("goalScore", 0)
                            obj.has("targetScore") -> obj.optInt("targetScore", 0)
                            else -> 0
                        }
                        val targetScore = when {
                            obj.has("targetScore") -> obj.optInt("targetScore", goalScore)
                            else -> goalScore
                        }

                        val rewardTitle =
                            if (obj.has("rewardTitle")) obj.optString("rewardTitle", null) else null
                        val reward =
                            if (obj.has("reward")) obj.optString("reward", null) else null

                        out.add(
                            WidgetChallenge(
                                id = idRaw,
                                title = title,
                                percent = percent,
                                startDate = startDate,
                                endDate = endDate,
                                goalScore = goalScore,
                                targetScore = targetScore,
                                rewardTitle = rewardTitle,
                                reward = reward
                            )
                        )
                    }
                    out
                }
            } catch (e: Exception) {
                Log.w(TAG, "loadChallenges failed", e)
                emptyList()
            }
        }

        fun saveWidgetChallengeId(
            context: Context,
            appWidgetId: Int,
            challengeId: String
        ) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(KEY_PREFIX + appWidgetId, challengeId)
                .apply()
        }

        fun deleteWidgetId(context: Context, appWidgetId: Int) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .remove(KEY_PREFIX + appWidgetId)
                .apply()
        }

        fun updateAppWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_progress_4x1)

            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val savedId = prefs.getString(KEY_PREFIX + appWidgetId, null)

            val challenges = loadChallenges(context)
            val challenge = challenges.firstOrNull { it.id == savedId }

            val titleText: String
            val percent: Int
            val target: WidgetChallenge?

            if (challenge != null) {
                titleText = if (challenge.title.isNotBlank()) {
                    challenge.title
                } else {
                    "(제목 없음)"
                }
                percent = challenge.percent.coerceIn(0, 100)
                target = challenge
            } else {
                titleText = "도전 선택 필요"
                percent = 0
                target = null
            }

            // 텍스트 / 진행률 세팅
views.setTextViewText(R.id.tvTitle, titleText)
views.setTextViewText(R.id.tvPercent, "$percent%")
views.setProgressBar(R.id.progressBar, 100, percent, false)

// 100% 이상이면 도전 완료 상태로 표시
val isCompleted = (percent >= 100)
views.setTextViewText(
    R.id.btnAction,
    if (isCompleted) "도전 완료" else "인증하기"
)

val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE


            if (target != null) {
                val targetId = target.id
                val titleParam = target.title ?: ""
                val startDateParam = target.startDate ?: ""
                val endDateParam = target.endDate ?: ""
                val rewardTitleParam = target.rewardTitle ?: ""
                val rewardParam = target.reward ?: ""
                val goalParam = target.goalScore
                val targetScoreParam = target.targetScore

                // 1) 전체 위젯 클릭 → 인증목록 화면 (EntryListScreen)
                val listUriString = buildString {
                    append("thepush://dashboard/")
                    append(Uri.encode(targetId))
                    append("?title=")
                    append(Uri.encode(titleParam))
                    append("&startDate=")
                    append(Uri.encode(startDateParam))
                    append("&endDate=")
                    append(Uri.encode(endDateParam))
                    append("&targetScore=")
                    append(targetScoreParam.toString())
                    append("&goalScore=")
                    append(goalParam.toString())
                    append("&rewardTitle=")
                    append(Uri.encode(rewardTitleParam))
                    append("&reward=")
                    append(Uri.encode(rewardParam))
                }
                val listUri = Uri.parse(listUriString)
                val listIntent = Intent(Intent.ACTION_VIEW, listUri).apply {
                    `package` = context.packageName
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                val listPending = PendingIntent.getActivity(
                    context,
                    appWidgetId, // 위젯별 requestCode
                    listIntent,
                    flags
                )
                views.setOnClickPendingIntent(R.id.rootWidget, listPending)

                // 2) 버튼 클릭 동작
                if (isCompleted) {
                    // ✅ 도전 완료: 안내 모달 띄우기
                    val rewardIntent = Intent(
                        context,
                        ProgressWidgetConfigActivity::class.java
                    ).apply {
                        action = ProgressWidgetConfigActivity.ACTION_SHOW_REWARD_GUIDE
                        addFlags(
                            Intent.FLAG_ACTIVITY_NEW_TASK or
                                    Intent.FLAG_ACTIVITY_CLEAR_TOP
                        )
                    }
                    val rewardPending = PendingIntent.getActivity(
                        context,
                        appWidgetId + 200000, // 다른 requestCode
                        rewardIntent,
                        flags
                    )
                    views.setOnClickPendingIntent(R.id.btnAction, rewardPending)
                } else {
                    // ⬇️ 진행 중: 기존처럼 "인증하기" 화면으로 이동
                    val uploadUriString = buildString {
                        append("thepush://upload/")
                        append(Uri.encode(targetId))
                        append("?title=")
                        append(Uri.encode(titleParam))
                        append("&startDate=")
                        append(Uri.encode(startDateParam))
                        append("&endDate=")
                        append(Uri.encode(endDateParam))
                        append("&targetScore=")
                        append(targetScoreParam.toString())
                        append("&goalScore=")
                        append(goalParam.toString())
                        append("&rewardTitle=")
                        append(Uri.encode(rewardTitleParam))
                        append("&reward=")
                        append(Uri.encode(rewardParam))
                    }
                    val uploadUri = Uri.parse(uploadUriString)
                    val uploadIntent = Intent(Intent.ACTION_VIEW, uploadUri).apply {
                        `package` = context.packageName
                        addFlags(
                            Intent.FLAG_ACTIVITY_NEW_TASK or
                                    Intent.FLAG_ACTIVITY_CLEAR_TOP
                        )
                    }
                    val uploadPending = PendingIntent.getActivity(
                        context,
                        appWidgetId + 100000, // 기존과 동일
                        uploadIntent,
                        flags
                    )
                    views.setOnClickPendingIntent(R.id.btnAction, uploadPending)
                }

            } else {
                // 도전 ID 가 없으면: 클릭 시 그냥 앱만 열기
                val launchIntent =
                    context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    }

                launchIntent?.let { base ->
                    val pending = PendingIntent.getActivity(
                        context,
                        appWidgetId,
                        base,
                        flags
                    )
                    views.setOnClickPendingIntent(R.id.rootWidget, pending)
                    views.setOnClickPendingIntent(R.id.btnAction, pending)
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        /**
         * JS 에서 "refreshWidgets" 딥링크를 열었을 때
         * 모든 ProgressWidget 을 즉시 다시 그리기 위한 헬퍼
         */
        @JvmStatic
        fun refreshAllWidgets(context: Context) {
            try {
                val appWidgetManager = AppWidgetManager.getInstance(context)
                val component = ComponentName(context, ProgressWidgetProvider::class.java)
                val ids = appWidgetManager.getAppWidgetIds(component)
                for (id in ids) {
                    updateAppWidget(context, appWidgetManager, id)
                }
                Log.d(TAG, "refreshAllWidgets: ${ids.size} widgets updated")
            } catch (e: Exception) {
                Log.w(TAG, "refreshAllWidgets failed", e)
            }
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            deleteWidgetId(context, appWidgetId)
        }
    }
}

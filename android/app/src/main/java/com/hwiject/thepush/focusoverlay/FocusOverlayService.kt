package com.hwiject.thepush.focusoverlay

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import com.hwiject.thepush.MainActivity
import com.hwiject.thepush.R
import kotlin.math.max

class FocusOverlayService : Service() {
  private lateinit var windowManager: WindowManager
  private var overlayView: View? = null
  private var titleView: TextView? = null
  private var timeView: TextView? = null
  private var toggleView: TextView? = null
  private val handler = Handler(Looper.getMainLooper())

  private var sessionId = ""
  private var targetTitle = ""
  private var status = "running"
  private var mode = "stopwatch"
  private var targetSeconds = 0L
  private var startedAt = 0L
  private var pausedAt = 0L
  private var accumulatedPausedMs = 0L

  private val ticker = object : Runnable {
    override fun run() {
      updateDisplayedTime()
      handler.postDelayed(this, 1000L)
    }
  }

  override fun onCreate() {
    super.onCreate()
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action != ACTION_SHOW_OR_UPDATE) return START_NOT_STICKY
    readSession(intent)
    startForeground(NOTIFICATION_ID, buildNotification())
    if (!Settings.canDrawOverlays(this)) {
      stopSelf()
      return START_NOT_STICKY
    }
    ensureOverlayView()
    updateOverlay()
    handler.removeCallbacks(ticker)
    handler.post(ticker)
    return START_NOT_STICKY
  }

  private fun readSession(intent: Intent) {
    sessionId = intent.getStringExtra(EXTRA_SESSION_ID).orEmpty()
    targetTitle = intent.getStringExtra(EXTRA_TARGET_TITLE).orEmpty()
    status = intent.getStringExtra(EXTRA_STATUS) ?: "running"
    mode = intent.getStringExtra(EXTRA_MODE) ?: "stopwatch"
    targetSeconds = intent.getLongExtra(EXTRA_TARGET_SECONDS, 0L)
    startedAt = intent.getLongExtra(EXTRA_STARTED_AT, 0L)
    pausedAt = intent.getLongExtra(EXTRA_PAUSED_AT, 0L)
    accumulatedPausedMs = intent.getLongExtra(EXTRA_ACCUMULATED_PAUSED_MS, 0L)
  }

  private fun createNotificationChannel() {
    val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(
      NotificationChannel(
        CHANNEL_ID,
        "외부 집중 타이머",
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "다른 앱 위에 집중 타이머를 표시합니다."
        setShowBadge(false)
      },
    )
  }

  private fun buildNotification() = NotificationCompat.Builder(this, CHANNEL_ID)
    .setSmallIcon(R.mipmap.ic_launcher)
    .setContentTitle(targetTitle.ifBlank { "집중 타이머" })
    .setContentText("다른 앱 위에 타이머를 표시하는 중입니다.")
    .setContentIntent(openTimerPendingIntent())
    .setOngoing(true)
    .setSilent(true)
    .setCategory(NotificationCompat.CATEGORY_SERVICE)
    .build()

  private fun openTimerIntent(): Intent = Intent(
    Intent.ACTION_VIEW,
    Uri.parse("thepush://focus-timer/${Uri.encode(sessionId)}"),
    this,
    MainActivity::class.java,
  ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)

  private fun openTimerPendingIntent(): PendingIntent = PendingIntent.getActivity(
    this,
    0,
    openTimerIntent(),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )

  private fun ensureOverlayView() {
    if (overlayView != null) return
    val density = resources.displayMetrics.density
    val container = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding((12 * density).toInt(), (8 * density).toInt(), (8 * density).toInt(), (8 * density).toInt())
      background = roundedBackground(Color.rgb(24, 24, 24), 14 * density)
      elevation = 8 * density
      setOnClickListener { startActivity(openTimerIntent()) }
    }
    titleView = textView(14f, Typeface.BOLD).apply {
      maxLines = 1
      ellipsize = android.text.TextUtils.TruncateAt.END
      layoutParams = LinearLayout.LayoutParams((112 * density).toInt(), LinearLayout.LayoutParams.WRAP_CONTENT)
    }
    timeView = textView(15f, Typeface.BOLD).apply {
      gravity = Gravity.END
      setPadding((8 * density).toInt(), 0, (8 * density).toInt(), 0)
    }
    toggleView = textView(16f, Typeface.BOLD).apply {
      gravity = Gravity.CENTER
      background = roundedBackground(Color.rgb(52, 52, 52), 10 * density)
      layoutParams = LinearLayout.LayoutParams((40 * density).toInt(), (40 * density).toInt())
      setOnClickListener {
        sendCommand(if (status == "paused") "resume" else "pause")
      }
    }
    container.addView(titleView)
    container.addView(timeView)
    container.addView(toggleView)

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.END
      x = (12 * density).toInt()
      y = (72 * density).toInt()
    }
    windowManager.addView(container, params)
    overlayView = container
  }

  private fun textView(size: Float, style: Int) = TextView(this).apply {
    setTextColor(Color.WHITE)
    textSize = size
    typeface = Typeface.create(Typeface.DEFAULT, style)
  }

  private fun roundedBackground(color: Int, radius: Float) = GradientDrawable().apply {
    shape = GradientDrawable.RECTANGLE
    setColor(color)
    cornerRadius = radius
  }

  private fun updateOverlay() {
    titleView?.text = targetTitle.ifBlank { "집중 타이머" }
    toggleView?.text = if (status == "paused") "▶" else "Ⅱ"
    updateDisplayedTime()
  }

  private fun displaySeconds(now: Long = System.currentTimeMillis()): Long {
    val end =
      if (status == "paused" && pausedAt > 0L) pausedAt
      else now

    val elapsed = max(
      0L,
      (
        end
          - startedAt
          - max(0L, accumulatedPausedMs)
      ) / 1000L,
    )

    return if (mode == "countdown") {
      targetSeconds - elapsed
    } else {
      elapsed
    }
  }

  private fun updateDisplayedTime() {
    val rawSeconds = displaySeconds()

    val overtime =
      mode == "countdown"
        && rawSeconds < 0L

    val seconds =
      if (rawSeconds < 0L) -rawSeconds
      else rawSeconds

    val hours = seconds / 3600L
    val minutes = (seconds % 3600L) / 60L
    val remaining = seconds % 60L

    val formatted = String.format(
      "%02d:%02d:%02d",
      hours,
      minutes,
      remaining,
    )

    timeView?.text =
      if (overtime) "-$formatted"
      else formatted

    timeView?.setTextColor(
      if (overtime) {
        Color.rgb(220, 38, 38)
      } else {
        Color.WHITE
      },
    )
  }

  private fun sendCommand(command: String) {
    sendBroadcast(Intent(ACTION_COMMAND).apply {
      setPackage(packageName)
      putExtra(EXTRA_COMMAND, command)
      putExtra(EXTRA_SESSION_ID, sessionId)
    })
  }

  override fun onDestroy() {
    handler.removeCallbacks(ticker)
    overlayView?.let {
      try {
        windowManager.removeView(it)
      } catch (_: Exception) {
      }
    }
    overlayView = null
    stopForeground(STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  companion object {
    const val ACTION_SHOW_OR_UPDATE = "com.hwiject.thepush.focusoverlay.SHOW_OR_UPDATE"
    const val ACTION_COMMAND = "com.hwiject.thepush.focusoverlay.COMMAND"
    const val EXTRA_COMMAND = "command"
    const val EXTRA_SESSION_ID = "sessionId"
    const val EXTRA_TARGET_TITLE = "targetTitle"
    const val EXTRA_STATUS = "status"
    const val EXTRA_MODE = "mode"
    const val EXTRA_TARGET_SECONDS = "targetSeconds"
    const val EXTRA_STARTED_AT = "startedAt"
    const val EXTRA_PAUSED_AT = "pausedAt"
    const val EXTRA_ACCUMULATED_PAUSED_MS = "accumulatedPausedMs"
    private const val CHANNEL_ID = "focus_overlay_timer"
    private const val NOTIFICATION_ID = 2501
  }
}

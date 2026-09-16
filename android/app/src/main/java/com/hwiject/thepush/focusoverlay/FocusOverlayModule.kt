package com.hwiject.thepush.focusoverlay

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class FocusOverlayModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  private var listenerCount = 0
  private var receiverRegistered = false

  private val commandReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action != FocusOverlayService.ACTION_COMMAND || listenerCount <= 0) return
      val payload = com.facebook.react.bridge.Arguments.createMap().apply {
        putString("command", intent.getStringExtra(FocusOverlayService.EXTRA_COMMAND))
        putString("sessionId", intent.getStringExtra(FocusOverlayService.EXTRA_SESSION_ID))
      }
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("FocusOverlayCommand", payload)
    }
  }

  override fun getName(): String = "FocusOverlay"

  private fun registerReceiverIfNeeded() {
    if (receiverRegistered) return
    ContextCompat.registerReceiver(
      reactContext,
      commandReceiver,
      IntentFilter(FocusOverlayService.ACTION_COMMAND),
      ContextCompat.RECEIVER_NOT_EXPORTED,
    )
    receiverRegistered = true
  }

  @ReactMethod
  fun addListener(eventName: String) {
    listenerCount += 1
    registerReceiverIfNeeded()
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    listenerCount = (listenerCount - count).coerceAtLeast(0)
  }

  @ReactMethod
  fun canDrawOverlays(promise: Promise) {
    promise.resolve(Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(reactContext))
  }

  @ReactMethod
  fun openPermissionSettings(promise: Promise) {
    try {
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${reactContext.packageName}"),
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("FOCUS_OVERLAY_PERMISSION", error)
    }
  }

  @ReactMethod
  fun showOrUpdate(session: ReadableMap, promise: Promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
      promise.reject("FOCUS_OVERLAY_PERMISSION", "Overlay permission is not granted")
      return
    }
    try {
      val intent = Intent(reactContext, FocusOverlayService::class.java).apply {
        action = FocusOverlayService.ACTION_SHOW_OR_UPDATE
        putExtra(FocusOverlayService.EXTRA_SESSION_ID, session.getString("id"))
        putExtra(FocusOverlayService.EXTRA_TARGET_TITLE, session.getString("targetTitle"))
        putExtra(FocusOverlayService.EXTRA_STATUS, session.getString("status"))
        putExtra(FocusOverlayService.EXTRA_MODE, session.getString("mode"))
        putExtra(FocusOverlayService.EXTRA_TARGET_SECONDS, session.getDouble("targetSeconds").toLong())
        putExtra(FocusOverlayService.EXTRA_STARTED_AT, session.getDouble("startedAt").toLong())
        putExtra(FocusOverlayService.EXTRA_PAUSED_AT, session.getDouble("pausedAt").toLong())
        putExtra(
          FocusOverlayService.EXTRA_ACCUMULATED_PAUSED_MS,
          session.getDouble("accumulatedPausedMs").toLong(),
        )
      }
      ContextCompat.startForegroundService(reactContext, intent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("FOCUS_OVERLAY_SHOW", error)
    }
  }

  @ReactMethod
  fun hide(promise: Promise) {
    try {
      reactContext.stopService(Intent(reactContext, FocusOverlayService::class.java))
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("FOCUS_OVERLAY_HIDE", error)
    }
  }

  override fun invalidate() {
    if (receiverRegistered) {
      reactContext.unregisterReceiver(commandReceiver)
      receiverRegistered = false
    }
    super.invalidate()
  }
}

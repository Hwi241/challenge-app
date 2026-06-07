package com.hwiject.thepush.foldable

import android.app.Activity
import android.graphics.Rect
import androidx.core.content.ContextCompat
import androidx.core.util.Consumer
import androidx.window.java.layout.WindowInfoTrackerCallbackAdapter
import androidx.window.layout.FoldingFeature
import androidx.window.layout.WindowInfoTracker
import androidx.window.layout.WindowLayoutInfo
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import java.util.concurrent.atomic.AtomicBoolean

class FoldableLayoutModule(
 private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

 override fun getName(): String = "FoldableLayout"

 @ReactMethod
 fun getFoldableLayoutState(promise: Promise) {
 val activity = getCurrentActivity()

 if (activity == null) {
 promise.resolve(buildUnavailableState("NO_CURRENT_ACTIVITY"))
 return
 }

 try {
 val tracker = WindowInfoTracker.getOrCreate(activity)
 val adapter = WindowInfoTrackerCallbackAdapter(tracker)
 val executor = ContextCompat.getMainExecutor(activity)
 val resolved = AtomicBoolean(false)

 lateinit var consumer: Consumer<WindowLayoutInfo>

 consumer = Consumer { layoutInfo ->
 if (!resolved.compareAndSet(false, true)) return@Consumer

 try {
 adapter.removeWindowLayoutInfoListener(consumer)
 } catch (_: Throwable) {
 // Listener removal failure should not break JS resolution.
 }

 promise.resolve(buildStateFromLayoutInfo(activity, layoutInfo))
 }

 adapter.addWindowLayoutInfoListener(activity, executor, consumer)
 } catch (error: Throwable) {
 promise.resolve(buildUnavailableState(error.javaClass.simpleName ?: "UNKNOWN_ERROR"))
 }
 }

 private fun buildStateFromLayoutInfo(
 activity: Activity,
 layoutInfo: WindowLayoutInfo
 ): WritableMap {
 val map = Arguments.createMap()
 val foldingFeature = layoutInfo.displayFeatures
 .filterIsInstance<FoldingFeature>()
 .firstOrNull()

 val hasFoldingFeature = foldingFeature != null
 val state = foldingFeature?.state?.toReadableString() ?: "NONE"
 val orientation = foldingFeature?.orientation?.toReadableString() ?: "NONE"
 val occlusionType = foldingFeature?.occlusionType?.toReadableString() ?: "NONE"
 val isSeparating = foldingFeature?.isSeparating ?: false

 // Final app rule:
 // - Normal phones: false
 // - Fold closed / no FoldingFeature: false
 // - Half opened: false
 // - Fold opened flat: true
 val isFoldExpanded = hasFoldingFeature && foldingFeature?.state == FoldingFeature.State.FLAT

 map.putBoolean("isAvailable", true)
 map.putBoolean("isFoldExpanded", isFoldExpanded)
 map.putBoolean("hasFoldingFeature", hasFoldingFeature)
 map.putString("state", state)
 map.putString("orientation", orientation)
 map.putString("occlusionType", occlusionType)
 map.putBoolean("isSeparating", isSeparating)
 map.putString("reason", null)

 val bounds = foldingFeature?.bounds
 map.putMap("bounds", buildBoundsMap(bounds))

 val configuration = activity.resources.configuration
 map.putInt("screenWidthDp", configuration.screenWidthDp)
 map.putInt("screenHeightDp", configuration.screenHeightDp)
 map.putInt("smallestScreenWidthDp", configuration.smallestScreenWidthDp)

 return map
 }

 private fun buildUnavailableState(reason: String): WritableMap {
 val map = Arguments.createMap()

 map.putBoolean("isAvailable", false)
 map.putBoolean("isFoldExpanded", false)
 map.putBoolean("hasFoldingFeature", false)
 map.putString("state", "UNKNOWN")
 map.putString("orientation", "UNKNOWN")
 map.putString("occlusionType", "UNKNOWN")
 map.putBoolean("isSeparating", false)
 map.putString("reason", reason)
 map.putMap("bounds", buildBoundsMap(null))
 map.putInt("screenWidthDp", 0)
 map.putInt("screenHeightDp", 0)
 map.putInt("smallestScreenWidthDp", 0)

 return map
 }

 private fun buildBoundsMap(bounds: Rect?): WritableMap {
 val map = Arguments.createMap()

 map.putInt("left", bounds?.left ?: 0)
 map.putInt("top", bounds?.top ?: 0)
 map.putInt("right", bounds?.right ?: 0)
 map.putInt("bottom", bounds?.bottom ?: 0)
 map.putInt("width", bounds?.width() ?: 0)
 map.putInt("height", bounds?.height() ?: 0)

 return map
 }

 private fun FoldingFeature.State.toReadableString(): String {
 return when (this) {
 FoldingFeature.State.FLAT -> "FLAT"
 FoldingFeature.State.HALF_OPENED -> "HALF_OPENED"
 else -> this.toString()
 }
 }

 private fun FoldingFeature.Orientation.toReadableString(): String {
 return when (this) {
 FoldingFeature.Orientation.HORIZONTAL -> "HORIZONTAL"
 FoldingFeature.Orientation.VERTICAL -> "VERTICAL"
 else -> this.toString()
 }
 }

 private fun FoldingFeature.OcclusionType.toReadableString(): String {
 return when (this) {
 FoldingFeature.OcclusionType.NONE -> "NONE"
 FoldingFeature.OcclusionType.FULL -> "FULL"
 else -> this.toString()
 }
 }
}

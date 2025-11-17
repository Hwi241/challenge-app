package com.hwiject.thepush.widgets.bridge

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class WidgetBridgePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): MutableList<NativeModule> {
    return mutableListOf(WidgetBridgeModule(reactContext))
  }
  override fun createViewManagers(reactContext: ReactApplicationContext): MutableList<ViewManager<*, *>> {
    return mutableListOf()
  }
}

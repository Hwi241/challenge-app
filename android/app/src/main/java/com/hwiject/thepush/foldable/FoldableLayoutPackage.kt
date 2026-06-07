package com.hwiject.thepush.foldable

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class FoldableLayoutPackage : ReactPackage {
 override fun createNativeModules(reactContext: ReactApplicationContext): MutableList<NativeModule> {
 return mutableListOf(FoldableLayoutModule(reactContext))
 }

 override fun createViewManagers(reactContext: ReactApplicationContext): MutableList<ViewManager<*, *>> {
 return mutableListOf()
 }
}

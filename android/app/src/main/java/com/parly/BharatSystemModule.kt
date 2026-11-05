package com.parly

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Gives the Translate tab its "translate text written anywhere" reach:
 *  - text shared to the app (Share -> BharatConnect) and text selected in
 *    another app (selection menu -> BharatConnect) arrive as intents,
 *  - the clipboard powers the "translate copied text" chip.
 *
 * Intent text that arrives before JS asks is parked in [SharedTextHolder]
 * (cold start); text that arrives while the app is running is pushed to JS as
 * the "BharatSharedText" event (see MainActivity.onNewIntent).
 */
class BharatSystemModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "BharatSystem"

  @ReactMethod
  fun getInitialSharedText(promise: Promise) {
    promise.resolve(SharedTextHolder.take())
  }

  @ReactMethod
  fun getClipboardText(promise: Promise) {
    try {
      val cm = reactContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      val text =
          if (cm.hasPrimaryClip() && (cm.primaryClip?.itemCount ?: 0) > 0) {
            cm.primaryClip?.getItemAt(0)?.coerceToText(reactContext)?.toString()
          } else {
            null
          }
      promise.resolve(text)
    } catch (e: Exception) {
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun setClipboardText(text: String, promise: Promise) {
    try {
      val cm = reactContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      cm.setPrimaryClip(ClipData.newPlainText("BharatConnect", text))
      promise.resolve(true)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  // Required by NativeEventEmitter on the JS side.
  @ReactMethod fun addListener(eventName: String) {}

  @ReactMethod fun removeListeners(count: Double) {}
}

/** Holds text delivered by an intent until JS collects it. */
object SharedTextHolder {
  @Volatile private var pending: String? = null

  /** Returns the text carried by [intent] (share / text selection), or null. */
  fun extract(intent: Intent?): String? {
    if (intent == null) return null
    return when (intent.action) {
      Intent.ACTION_SEND ->
          if (intent.type?.startsWith("text/") == true) intent.getStringExtra(Intent.EXTRA_TEXT)
          else null
      Intent.ACTION_PROCESS_TEXT -> intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
      else -> null
    }?.takeIf { it.isNotBlank() }
  }

  fun park(text: String?) {
    pending = text
  }

  fun take(): String? {
    val t = pending
    pending = null
    return t
  }
}

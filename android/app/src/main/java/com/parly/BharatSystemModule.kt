package com.parly

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Handler
import android.os.Looper
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

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

  // ── Speaking: plays the WAV the server synthesised (Gnani voices) ───────────
  // MediaPlayer is touched only on the main thread, so every entry point hops
  // there. One clip at a time: a new clip (or stopPlayback) ends the old one
  // and settles its promise, so JS never waits on audio that was cut off.

  private val mainHandler = Handler(Looper.getMainLooper())
  private var player: MediaPlayer? = null
  private var pendingPlay: Promise? = null

  @ReactMethod
  fun playWavBase64(base64: String, promise: Promise) {
    val file: File
    try {
      file = File(reactContext.cacheDir, "bharat_tts.wav")
      file.writeBytes(Base64.decode(base64, Base64.DEFAULT))
    } catch (e: Exception) {
      promise.reject("PLAY_FAILED", e.message, e)
      return
    }
    mainHandler.post {
      finishPlayback(null)
      var mp: MediaPlayer? = null
      try {
        mp = MediaPlayer()
        mp.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build())
        mp.setDataSource(file.absolutePath)
        mp.setOnPreparedListener { it.start() }
        mp.setOnCompletionListener { if (player === it) finishPlayback(null) }
        mp.setOnErrorListener { failed, _, _ ->
          if (player === failed) finishPlayback("Audio playback failed")
          true
        }
        player = mp
        pendingPlay = promise
        mp.prepareAsync()
      } catch (e: Exception) {
        // Not yet stored as the current clip (or being replaced): release it
        // here and settle exactly once.
        player = null
        pendingPlay = null
        try {
          mp?.release()
        } catch (ignored: Exception) {}
        promise.reject("PLAY_FAILED", e.message ?: "Audio playback failed", e)
      }
    }
  }

  @ReactMethod
  fun stopPlayback() {
    mainHandler.post { finishPlayback(null) }
  }

  /** Stops and releases the current clip; settles its promise (reject if [error] is set). */
  private fun finishPlayback(error: String?) {
    val mp = player
    val promise = pendingPlay
    player = null
    pendingPlay = null
    try {
      mp?.stop()
    } catch (e: Exception) {
      // never started, or already in an error state
    }
    mp?.release()
    if (promise != null) {
      if (error == null) promise.resolve(true) else promise.reject("PLAY_FAILED", error)
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

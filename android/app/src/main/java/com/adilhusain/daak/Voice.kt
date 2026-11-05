package com.adilhusain.daak

import android.content.Context
import android.os.VibrationEffect
import android.os.VibratorManager
import android.speech.tts.TextToSpeech
import java.util.Locale

/** Spoken Hindi feedback and a short buzz, so a driver never has to read the screen. */
class Voice(context: Context) {
    private var ready = false
    private val tts = TextToSpeech(context.applicationContext) { status ->
        ready = status == TextToSpeech.SUCCESS
    }.also { it.language = Locale.forLanguageTag("hi-IN") }
    private val vibrator = (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator

    fun say(text: String) {
        if (ready) tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, text.hashCode().toString())
    }

    fun buzz(good: Boolean = true) {
        val effect = if (good) VibrationEffect.createOneShot(60, VibrationEffect.DEFAULT_AMPLITUDE)
        else VibrationEffect.createWaveform(longArrayOf(0, 120, 80, 120), -1)
        vibrator.vibrate(effect)
    }

    fun close() = tts.shutdown()
}

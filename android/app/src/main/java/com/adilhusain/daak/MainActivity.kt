package com.adilhusain.daak

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import java.io.File
import kotlin.concurrent.thread

/** Where the driver is in the app. */
sealed interface Screen {
    data object SignIn : Screen
    data object Home : Screen
    data class Handoff(val parcel: Tap? = null, val receiver: Tap? = null, val sending: Boolean = false) : Screen
    data class Result(val verdict: Verdict, val offline: Boolean = false) : Screen
    /** Shop packing a parcel: tap it, the shop's agent pays for the booking, then tap again to write the link. */
    data class Pack(val parcel: Tap? = null, val booking: Booking? = null, val busy: Boolean = false, val written: Boolean = false, val error: String? = null) : Screen
}

class MainActivity : ComponentActivity() {
    private var screen by mutableStateOf<Screen>(Screen.SignIn)
    private var me by mutableStateOf<Tap?>(null)
    private var note by mutableStateOf<String?>(null)
    private var queued by mutableStateOf(0)

    private lateinit var nfc: Nfc
    private lateinit var voice: Voice
    private lateinit var outbox: Outbox
    private lateinit var where: Where
    private var photoFile: File? = null

    private val takePhoto = registerForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val s = screen
        val file = photoFile
        if (ok && file != null && s is Screen.Handoff && s.parcel != null && s.receiver != null) send(s, shrink(file))
    }

    private val askLocation = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        if (granted.values.any { it }) where.refresh()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        voice = Voice(this)
        outbox = Outbox(this)
        where = Where(this)
        askLocation.launch(arrayOf(android.Manifest.permission.ACCESS_FINE_LOCATION, android.Manifest.permission.ACCESS_COARSE_LOCATION))
        queued = outbox.size()
        nfc = Nfc(this, ::onTap)
        setContent { App() }
    }

    override fun onResume() {
        super.onResume()
        nfc.start()
        if (outbox.size() > 0) thread { val n = outbox.flush(); runOnUiThread { queued = outbox.size(); if (n > 0) note = "$n saved handoffs sent" } }
    }

    override fun onPause() {
        nfc.stop()
        super.onPause()
    }

    override fun onDestroy() {
        voice.close()
        super.onDestroy()
    }

    private fun onTap(tap: Tap) {
        note = null
        when (val s = screen) {
            Screen.SignIn -> {
                me = tap
                screen = Screen.Home
                voice.buzz(); voice.say("Namaste. Badge pehchana gaya.")
            }
            is Screen.Pack -> when {
                s.busy -> Unit
                s.parcel == null -> {
                    screen = s.copy(parcel = tap, busy = true); voice.buzz(); voice.say("Parcel mil gaya. Booking ho rahi hai.")
                    thread {
                        val r = runCatching { Api.pack(tap.uid) }
                        runOnUiThread {
                            r.onSuccess { b ->
                                nfc.pendingWrite = b.trackUrl
                                screen = s.copy(parcel = tap, booking = b, busy = false)
                                voice.buzz(); voice.say("Booking ho gayi. Parcel ko dobara lagaiye.")
                            }.onFailure { screen = s.copy(parcel = tap, busy = false, error = it.message); voice.buzz(false) }
                        }
                    }
                }
                s.booking != null && !s.written -> {
                    if (tap.uid != s.parcel.uid) { note = "That is a different tag. Tap the same parcel."; voice.buzz(false); return }
                    val ok = tap.text == s.booking.trackUrl
                    nfc.pendingWrite = null
                    screen = s.copy(written = true, error = if (ok) null else "This tag cannot be written. The parcel is booked; its link is on the dashboard.")
                    voice.buzz(ok); voice.say(if (ok) "Parcel taiyaar hai." else "Tag likha nahi gaya, par booking ho gayi.")
                }
                else -> Unit
            }
            is Screen.Handoff -> when {
                s.sending -> Unit
                s.parcel == null -> {
                    if (tap.uid == me?.uid) { note = "That is your own badge. Tap the parcel."; voice.buzz(false); return }
                    screen = s.copy(parcel = tap); where.refresh(); voice.buzz(); voice.say("Parcel mil gaya. Ab agle driver ka badge.")
                }
                s.receiver == null -> {
                    if (tap.uid == s.parcel.uid) { note = "Same parcel again. Tap the next driver's badge."; voice.buzz(false); return }
                    if (tap.uid == me?.uid) { note = "That is your own badge. Tap the next driver's badge."; voice.buzz(false); return }
                    screen = s.copy(receiver = tap); voice.buzz(); voice.say("Badge mil gaya. Ab dhakkan ki photo lijiye.")
                }
                else -> Unit
            }
            else -> Unit
        }
    }

    private fun openCamera() {
        val dir = File(cacheDir, "photos").apply { mkdirs() }
        val file = File(dir, "lid-${System.currentTimeMillis()}.jpg").also { photoFile = it }
        val uri: Uri = FileProvider.getUriForFile(this, "com.adilhusain.daak.photos", file)
        takePhoto.launch(uri)
    }

    /** Camera photos are several MB; the check needs the painted code, not the pixels. */
    private fun shrink(file: File): File {
        val bmp = BitmapFactory.decodeFile(file.path) ?: return file
        val scale = 1280f / maxOf(bmp.width, bmp.height)
        val small = if (scale < 1f) Bitmap.createScaledBitmap(bmp, (bmp.width * scale).toInt(), (bmp.height * scale).toInt(), true) else bmp
        file.outputStream().use { small.compress(Bitmap.CompressFormat.JPEG, 80, it) }
        return file
    }

    private fun send(s: Screen.Handoff, photo: File) {
        val h = Handoff(s.parcel!!.uid, me!!.uid, s.receiver!!.uid, photo, spot = where.last)
        screen = s.copy(sending = true)
        thread {
            val result = runCatching { Api.handoff(h) }
            runOnUiThread {
                result.onSuccess { v ->
                    screen = Screen.Result(v)
                    voice.buzz(v.verdict == "green")
                    voice.say(v.message.ifEmpty { if (v.verdict == "green") "Saunp diya gaya. Paisa jaari." else "Jaanch baaki. Paisa roka gaya." })
                }.onFailure {
                    outbox.add(h); queued = outbox.size()
                    screen = Screen.Result(Verdict("unchecked", "Saved offline. It sends when the signal is back, and the payment waits until it is checked.", null, null), offline = true)
                    voice.buzz(false); voice.say("Network nahi hai. Handoff save ho gaya. Paisa jaanch tak ruka hai.")
                }
            }
        }
    }

    @Composable
    private fun App() {
        Column(
            Modifier.fillMaxSize().background(Tokens.paper).safeDrawingPadding().padding(Tokens.pad),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Title("Daak")
            when (val s = screen) {
                Screen.SignIn -> {
                    Body("Tap your badge on the back of the phone.")
                    Body("Apna badge phone ke peeche lagaiye.", Tokens.muted)
                    if (!nfc.enabled) Body("NFC is off. Turn it on in Settings.", Tokens.red)
                }
                Screen.Home -> {
                    Body("Badge ${me?.uid?.takeLast(8)}", Tokens.muted, 15)
                    Action("Hand over a parcel", "Parcel saunpiye") { screen = Screen.Handoff() }
                    Action("Pack a new parcel (shop)", "Naya parcel book kijiye") { screen = Screen.Pack() }
                    if (queued > 0) Body("$queued handoff(s) waiting for signal", Tokens.amber)
                    Spacer(Modifier.height(8.dp))
                    Action("Sign out", color = Tokens.muted) { me = null; screen = Screen.SignIn }
                }
                is Screen.Handoff -> {
                    Step(1, "Tap the parcel", s.parcel?.let { "Parcel ${it.uid.takeLast(8)}" }, s.parcel == null)
                    Step(2, "Tap the next driver's badge", s.receiver?.let { "Badge ${it.uid.takeLast(8)}" }, s.parcel != null && s.receiver == null)
                    Step(3, "Photo of the lid", if (s.sending) "Checking..." else null, s.receiver != null)
                    if (s.receiver != null && !s.sending) Action("Take photo", "Photo lijiye") { openCamera() }
                    if (!s.sending) Action("Cancel", color = Tokens.muted) { screen = Screen.Home }
                }
                is Screen.Pack -> {
                    Step(1, "Tap the new parcel", s.parcel?.let { "Parcel ${it.uid.takeLast(8)}" }, s.parcel == null)
                    Step(2, "Shop's agent books and pays", when {
                        s.busy -> "Paying for the delivery..."
                        s.booking != null -> "Booked ${s.booking.code}: drivers get ₹${s.booking.shares.joinToString(" + ₹")}"
                        else -> null
                    }, s.parcel != null && s.booking == null)
                    Step(3, "Tap the parcel again to write its link", if (s.written && s.error == null) "Link written" else null, s.booking != null && !s.written)
                    s.error?.let { Body(it, Tokens.red) }
                    if (s.written || s.error != null) Action("Pack another", "Agla parcel") { nfc.pendingWrite = null; screen = Screen.Pack() }
                    if (!s.busy) Action("Home", color = Tokens.muted) { nfc.pendingWrite = null; screen = Screen.Home }
                }
                is Screen.Result -> {
                    val (color, head) = when (s.verdict.verdict) {
                        "green" -> Tokens.green to "Handed over"
                        "held" -> Tokens.red to "Payment held"
                        else -> Tokens.amber to if (s.offline) "Saved offline" else "Not checked yet"
                    }
                    Action(head, s.verdict.message, color) {}
                    s.verdict.code?.let { Body("Consignment $it" + (s.verdict.hop?.let { h -> ", hop $h" } ?: ""), Tokens.muted, 15) }
                    Action("Next parcel", "Agla parcel") { screen = Screen.Handoff() }
                    Action("Home", color = Tokens.muted) { screen = Screen.Home }
                }
            }
            note?.let { Body(it, Tokens.red) }
        }
    }
}

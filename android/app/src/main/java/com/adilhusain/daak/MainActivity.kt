package com.adilhusain.daak

import android.content.Context
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import java.io.File
import kotlin.concurrent.thread

/** Who is holding the phone, remembered until they switch badge. */
data class Person(val uid: String, val name: String, val role: String, val vehicle: String)

/** Where the person is in the app. */
sealed interface Screen {
    data object SignIn : Screen
    data class Checking(val uid: String) : Screen
    data class Unknown(val uid: String) : Screen
    data object Home : Screen
    data class Handoff(
        val parcel: Tap? = null, val info: ParcelInfo? = null, val loading: Boolean = false,
        val receiver: Tap? = null, val sending: Boolean = false, val problem: String? = null,
    ) : Screen
    data class Result(val verdict: Verdict, val offline: Boolean = false, val place: String? = null) : Screen
    data class Pack(
        val parcel: Tap? = null, val plan: RoutePlan? = null, val loading: Boolean = false, val paying: Boolean = false,
        val booking: Booking? = null, val written: Boolean = false, val problem: String? = null,
    ) : Screen
    data class Look(val parcel: Tap? = null, val info: ParcelInfo? = null, val loading: Boolean = false) : Screen
}

class MainActivity : ComponentActivity() {
    private var screen by mutableStateOf<Screen>(Screen.SignIn)
    private var me by mutableStateOf<Person?>(null)
    private var note by mutableStateOf<String?>(null)
    private var queued by mutableStateOf(0)
    private var work by mutableStateOf<Work?>(null)
    private var savingBusy by mutableStateOf(false)

    private lateinit var nfc: Nfc
    private lateinit var voice: Voice
    private lateinit var outbox: Outbox
    private lateinit var where: Where
    private var photoFile: File? = null
    private val prefs by lazy { getSharedPreferences("daak", Context.MODE_PRIVATE) }

    private val askLocation = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        if (granted.values.any { it }) where.refresh()
    }

    private val takePhoto = registerForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val s = screen
        val file = photoFile
        if (ok && file != null && s is Screen.Handoff && s.parcel != null && s.receiver != null) send(s, shrink(file))
        else if (s is Screen.Handoff) note = "फोटो नहीं ली गई। दोबारा कोशिश करें। The photo was not taken; try again."
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        voice = Voice(this)
        outbox = Outbox(this)
        where = Where(this)
        queued = outbox.size()
        nfc = Nfc(this, ::onTap)
        askLocation.launch(arrayOf(android.Manifest.permission.ACCESS_FINE_LOCATION, android.Manifest.permission.ACCESS_COARSE_LOCATION))
        restore()
        setContent { App() }
    }

    override fun onResume() {
        super.onResume()
        nfc.start()
        if (outbox.size() > 0) thread {
            val n = outbox.flush()
            runOnUiThread { queued = outbox.size(); if (n > 0) note = "$n saved handoff(s) sent now that there is signal." }
        }
    }

    override fun onPause() { nfc.stop(); super.onPause() }
    override fun onDestroy() { voice.close(); super.onDestroy() }

    // ---------- who is signed in ----------

    private fun restore() {
        val uid = prefs.getString("uid", null) ?: return
        me = Person(uid, prefs.getString("name", "") ?: "", prefs.getString("role", "driver") ?: "driver", prefs.getString("vehicle", "") ?: "")
        screen = Screen.Home
        if (me?.role == "driver") loadWork()
    }

    private fun signIn(tap: Tap) {
        screen = Screen.Checking(tap.uid)
        thread {
            val r = runCatching { Api.me(tap.uid) }
            runOnUiThread {
                r.onSuccess { m ->
                    if (!m.known) { screen = Screen.Unknown(tap.uid); voice.buzz(false); voice.say("यह बैज पंजीकृत नहीं है।"); return@onSuccess }
                    val p = Person(tap.uid, m.name.orEmpty(), m.role ?: "driver", m.vehicle.orEmpty())
                    me = p
                    prefs.edit().putString("uid", p.uid).putString("name", p.name).putString("role", p.role).putString("vehicle", p.vehicle).apply()
                    screen = Screen.Home
                    voice.buzz(); voice.say("नमस्ते ${firstName(p)}।")
                    if (p.role == "driver") loadWork()
                }.onFailure { screen = Screen.SignIn; note = "इंटरनेट नहीं मिला। No internet; tap the badge again when there is signal." }
            }
        }
    }

    private fun signOut() {
        prefs.edit().clear().apply()
        me = null; work = null; screen = Screen.SignIn
    }

    private fun firstName(p: Person?) = p?.name?.substringBefore(",")?.ifBlank { null } ?: "ji"

    // ---------- every tap goes through here ----------

    private fun onTap(tap: Tap) {
        note = null
        when (val s = screen) {
            Screen.SignIn, is Screen.Unknown -> signIn(tap)
            Screen.Home -> when (me?.role) {
                // From home, tapping a parcel starts the person's own job with it; tapping another badge switches person.
                "driver" -> if (tap.uid == me?.uid) Unit else startHandoff(tap)
                "sender" -> startPack(tap)
                else -> lookUp(tap)
            }
            is Screen.Handoff -> when {
                s.sending || s.loading -> Unit
                s.parcel == null -> startHandoff(tap)
                s.receiver == null -> takeReceiver(s, tap)
                else -> Unit
            }
            is Screen.Pack -> when {
                s.loading || s.paying -> Unit
                s.parcel == null -> startPack(tap)
                s.booking != null && !s.written -> finishPack(s, tap)
                else -> Unit
            }
            is Screen.Look -> if (!s.loading) lookUp(tap)
            else -> Unit
        }
    }

    // ---------- driver: hand over a parcel ----------

    private fun startHandoff(tap: Tap) {
        screen = Screen.Handoff(parcel = tap, loading = true)
        where.refresh()
        thread {
            val r = runCatching { Api.parcel(tap.uid) }
            runOnUiThread {
                val info = r.getOrNull()
                when {
                    info == null -> { screen = Screen.Handoff(parcel = tap, problem = "इंटरनेट नहीं है, पर हैंडऑफ़ फ़ोन में सेव हो जाएगा। No signal: the handoff will be saved on the phone."); voice.buzz() ; voice.say("पार्सल मिल गया। अब अगले ड्राइवर का बैज लगाइए।") }
                    !info.registered -> { screen = Screen.Handoff(problem = "यह पार्सल बुक नहीं है। This parcel is not booked. Ask the shop to book it first."); voice.buzz(false); voice.say("यह पार्सल बुक नहीं है।") }
                    info.delivered -> { screen = Screen.Handoff(problem = "${info.code} पहुँच चुका है। ${info.code} is already delivered."); voice.buzz(false) }
                    else -> {
                        val n = info.next!!
                        screen = Screen.Handoff(parcel = tap, info = info)
                        voice.buzz()
                        voice.say("पार्सल ${info.code}। इसे ${n.toName} को दीजिए। उनका बैज लगाइए।")
                    }
                }
            }
        }
    }

    private fun takeReceiver(s: Screen.Handoff, tap: Tap) {
        if (tap.uid == s.parcel?.uid) { note = "यह वही पार्सल है। That is the same parcel. Tap the receiver's badge."; voice.buzz(false); return }
        if (tap.uid == me?.uid) { note = "यह आपका अपना बैज है। That is your own badge. Tap the receiver's badge."; voice.buzz(false); return }
        val n = s.info?.next
        if (n != null && badgeHash(tap.uid) != n.toHash) {
            note = "यह ${n.toName} का बैज नहीं है। This is not ${n.toName}'s badge."
            voice.buzz(false); voice.say("यह ${n.toName} का बैज नहीं है।")
            return
        }
        screen = s.copy(receiver = tap)
        voice.buzz(); voice.say("ठीक है। अब ढक्कन की फोटो लीजिए।")
        openCamera() // straight to the camera: one less tap at a busy bus stand
    }

    private fun openCamera() {
        val dir = File(cacheDir, "photos").apply { mkdirs() }
        val file = File(dir, "lid-${System.currentTimeMillis()}.jpg").also { photoFile = it }
        val uri: Uri = FileProvider.getUriForFile(this, "com.adilhusain.daak.photos", file)
        takePhoto.launch(uri)
    }

    /** Camera photos are several MB; the check needs the written code, not the pixels. */
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
                    screen = Screen.Result(v, place = s.info?.next?.place)
                    voice.buzz(v.verdict == "green")
                    voice.say(when (v.verdict) {
                        "green" -> "सौंप दिया गया। भुगतान जारी।"
                        "held" -> "भुगतान रोका गया।"
                        else -> "हैंडऑफ़ सेव हो गया। जाँच बाकी है, भुगतान रुका है।"
                    })
                    if (me?.role == "driver") loadWork()
                }.onFailure {
                    outbox.add(h); queued = outbox.size()
                    screen = Screen.Result(Verdict("unchecked", "", null, null), offline = true, place = s.info?.next?.place)
                    voice.buzz(false); voice.say("नेटवर्क नहीं है। हैंडऑफ़ फ़ोन में सेव है। भुगतान जाँच तक रुका है।")
                }
            }
        }
    }

    // ---------- shop: book a new parcel ----------

    private fun startPack(tap: Tap) {
        screen = Screen.Pack(parcel = tap, loading = true)
        thread {
            val known = runCatching { Api.parcel(tap.uid) }.getOrNull()
            val plan = runCatching { Api.route() }.getOrNull()
            runOnUiThread {
                when {
                    known?.registered == true -> { screen = Screen.Pack(problem = "यह पार्सल पहले से बुक है: ${known.code}. Already booked as ${known.code}."); voice.buzz(false) }
                    plan == null -> { screen = Screen.Pack(problem = "इंटरनेट नहीं मिला। No internet; booking needs signal."); voice.buzz(false) }
                    else -> { screen = Screen.Pack(parcel = tap, plan = plan); voice.buzz(); voice.say("पार्सल मिल गया। रास्ता और किराया देखिए।") }
                }
            }
        }
    }

    private fun pay(s: Screen.Pack) {
        screen = s.copy(paying = true)
        voice.say("बुकिंग हो रही है।")
        thread {
            val r = runCatching { Api.pack(s.parcel!!.uid) }
            runOnUiThread {
                r.onSuccess { b ->
                    nfc.pendingWrite = b.trackUrl
                    screen = s.copy(paying = false, booking = b)
                    voice.buzz(); voice.say("बुकिंग हो गई। कोड ढक्कन पर लिखिए, फिर पार्सल दोबारा लगाइए।")
                }.onFailure { screen = s.copy(paying = false, problem = "बुकिंग नहीं हुई: ${it.message}. Booking failed; nothing was charged.") ; voice.buzz(false) }
            }
        }
    }

    private fun finishPack(s: Screen.Pack, tap: Tap) {
        if (tap.uid != s.parcel?.uid) { note = "यह दूसरा टैग है। That is a different tag. Tap the same parcel."; voice.buzz(false); return }
        val ok = tap.text == s.booking?.trackUrl
        nfc.pendingWrite = null
        screen = s.copy(written = true, problem = if (ok) null else "टैग पर लिंक नहीं लिखा गया, पर बुकिंग पक्की है। The tag could not take the link; the booking still stands.")
        voice.buzz(ok); voice.say("पार्सल तैयार है।")
    }

    // ---------- anyone: look a parcel up ----------

    private fun lookUp(tap: Tap) {
        screen = Screen.Look(parcel = tap, loading = true)
        thread {
            val info = runCatching { Api.parcel(tap.uid) }.getOrNull()
            runOnUiThread { screen = Screen.Look(parcel = tap, info = info); voice.buzz(info?.registered == true) }
        }
    }

    // ---------- driver's own record ----------

    private fun loadWork() {
        val uid = me?.uid ?: return
        thread { val w = runCatching { Api.work(uid) }.getOrNull(); runOnUiThread { work = w } }
    }

    private fun toggleBachat() {
        val uid = me?.uid ?: return
        val next = if ((work?.savePercent ?: 0) > 0) 0 else 5
        savingBusy = true
        thread {
            val ok = runCatching { Api.setSave(uid, next) }.isSuccess
            runOnUiThread {
                savingBusy = false
                if (ok) { work = work?.copy(savePercent = next); voice.buzz(); voice.say(if (next > 0) "बचत चालू। हर भुगतान का पाँच प्रतिशत बचेगा।" else "बचत बंद।") }
                else note = "सेव नहीं हुआ। Could not save; try again."
            }
        }
    }

    // ---------- screens ----------

    @Composable
    private fun App() {
        Column(
            Modifier.fillMaxSize().background(Tokens.paper).safeDrawingPadding().verticalScroll(rememberScrollState()).padding(Tokens.pad),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Header()
            when (val s = screen) {
                Screen.SignIn -> SignInScreen()
                is Screen.Checking -> Bi("बैज जाँच रहे हैं…", "Checking your badge…")
                is Screen.Unknown -> {
                    Verdict(Tokens.amber, "यह बैज पंजीकृत नहीं है", "This badge is not registered", "Ask the Daak office to add it, then tap it again.")
                    Body("Badge ${s.uid.takeLast(8)}", Tokens.muted, 15)
                }
                Screen.Home -> HomeScreen()
                is Screen.Handoff -> HandoffScreen(s)
                is Screen.Result -> ResultScreen(s)
                is Screen.Pack -> PackScreen(s)
                is Screen.Look -> LookScreen(s)
            }
            note?.let { Body(it, Tokens.red, 17) }
        }
    }

    @Composable
    private fun Header() {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Title("Daak")
            me?.let { Body("${it.name.ifBlank { "Badge ${it.uid.takeLast(8)}" }}${if (it.vehicle.isNotBlank()) " · ${it.vehicle}" else ""}", Tokens.muted, 15) }
        }
    }

    @Composable
    private fun SignInScreen() {
        Sheet {
            Bi("अपना बैज फ़ोन के पीछे लगाइए", "Tap your badge on the back of the phone", size = 24)
            Body("Drivers, shops and receivers each have a Daak badge. The phone remembers you until you switch.", Tokens.muted, 16)
        }
        if (!nfc.enabled) Body("NFC बंद है। Turn on NFC in Settings.", Tokens.red)
    }

    @Composable
    private fun HomeScreen() {
        val p = me ?: return
        when (p.role) {
            "driver" -> {
                WorkCard(work)
                Action("पार्सल सौंपें", "Hand over a parcel  ·  or just tap the parcel") { screen = Screen.Handoff() }
                Action(
                    if ((work?.savePercent ?: 0) > 0) "बचत चालू है (5%)" else "बचत चालू करें (5%)",
                    if (savingBusy) "Saving…" else if ((work?.savePercent ?: 0) > 0) "Bachat is on: 5% of each payout is saved" else "Save 5% of every payout in Bachat",
                    if ((work?.savePercent ?: 0) > 0) Tokens.green else Tokens.ink,
                    enabled = !savingBusy,
                ) { toggleBachat() }
            }
            "sender" -> Action("नया पार्सल बुक करें", "Book a new parcel  ·  or just tap the parcel") { screen = Screen.Pack() }
            else -> Action("पार्सल की स्थिति देखें", "Check a parcel  ·  or just tap it") { screen = Screen.Look() }
        }
        if (queued > 0) Sheet { Bi("$queued हैंडऑफ़ सिग्नल का इंतज़ार कर रहे हैं", "$queued handoff(s) waiting for signal; they send by themselves", Tokens.amber, 18) }
        Spacer(Modifier.height(8.dp))
        Secondary("बैज बदलें · Switch badge") { signOut() }
    }

    @Composable
    private fun WorkCard(w: Work?) {
        Sheet {
            Body("मेरा काम · My work", Tokens.muted, 15)
            if (w == null) { Body("Loading your record…", Tokens.muted, 16); return@Sheet }
            Body("${w.proven} deliveries proven · ${w.km} km · ${w.cleanPercent}% clean", size = 19, weight = FontWeight.SemiBold)
            Body("कमाई · Earned ₹${"%.2f".format(w.earned)}", Tokens.green, 19, FontWeight.SemiBold)
            Body("बचत · Bachat ₹${"%.2f".format(w.bachat)}", size = 17)
            if (w.advance > 0) Body("ईंधन एडवांस उपलब्ध · Fuel advance ₹${w.advance}", Tokens.green, 17, FontWeight.SemiBold)
            else Body("Fuel advance: ${w.advanceReason}", Tokens.muted, 15)
        }
    }

    @Composable
    private fun HandoffScreen(s: Screen.Handoff) {
        val n = s.info?.next
        Step(1, "पार्सल लगाइए", "Tap the parcel",
            when { s.loading -> "Reading the parcel…"; s.info?.code != null -> "${s.info.code} · ${s.info.label?.substringBefore(",")}"; s.parcel != null -> "Parcel ${s.parcel.uid.takeLast(8)}"; else -> null },
            s.parcel == null)
        Step(2, if (n != null) "${n.toName} का बैज लगाइए" else "अगले व्यक्ति का बैज लगाइए",
            if (n != null) "Tap ${n.toName}'s badge · ${n.place}" else "Tap the receiver's badge",
            s.receiver?.let { if (n != null) "${n.toName} confirmed" else "Badge ${it.uid.takeLast(8)}" }, s.parcel != null && !s.loading && s.receiver == null && s.problem == null)
        Step(3, "ढक्कन की फोटो", "Photo of the lid, with the code readable",
            if (s.sending) "Checking with the sealed AI…" else null, s.receiver != null)
        s.problem?.let { Verdict(Tokens.amber, "रुकिए", "Hold on", it) }
        if (s.receiver != null && !s.sending) Action("फोटो लीजिए", "Take the photo") { openCamera() }
        if (s.sending) Bi("जाँच हो रही है…", "Checking the photo. This takes a few seconds.", Tokens.muted, 18)
        if (!s.sending) Secondary("वापस · Back") { screen = Screen.Home }
    }

    @Composable
    private fun ResultScreen(s: Screen.Result) {
        val v = s.verdict
        when {
            s.offline -> Verdict(Tokens.amber, "फ़ोन में सेव", "Saved on the phone", "No signal. It sends by itself when the signal is back; the payment waits until it is checked.")
            v.verdict == "green" -> Verdict(Tokens.green, "सौंप दिया", "Handed over", "Checked: right parcel, right stop, still sealed.${s.place?.let { " $it." } ?: ""} Payment is on its way.")
            v.verdict == "held" -> Verdict(Tokens.red, "भुगतान रोका गया", "Payment held", v.message.substringAfter(". ").ifBlank { v.message })
            else -> Verdict(Tokens.amber, "सौंपा गया, जाँच बाकी", "Handed over, waiting for the check", "The AI check could not run just now. The handoff is recorded and the payment waits; it is checked again automatically.")
        }
        v.code?.let { Body("$it${v.hop?.let { h -> " · stop $h" } ?: ""}", Tokens.muted, 15) }
        Action("अगला पार्सल", "Next parcel") { screen = Screen.Handoff() }
        Secondary("होम · Home") { screen = Screen.Home }
    }

    @Composable
    private fun PackScreen(s: Screen.Pack) {
        val plan = s.plan
        Step(1, "नया पार्सल लगाइए", "Tap the new parcel", when { s.loading -> "Reading…"; s.parcel != null -> "Parcel ${s.parcel.uid.takeLast(8)}"; else -> null }, s.parcel == null)
        if (plan != null && s.booking == null) {
            Sheet {
                Body("रास्ता · Route", Tokens.muted, 15)
                Body("${plan.from} › ${plan.stops.joinToString(" › ") { it.first.substringBefore(",").substringBefore(" bus") }}", size = 19, weight = FontWeight.SemiBold)
                plan.stops.forEachIndexed { i, (place, km) -> Body("Stop ${i + 1}: $place · $km km", Tokens.muted, 15) }
                Body("Daak meter: ${plan.meter} × ${plan.km} km", Tokens.muted, 15)
                Body("किराया · Fee ₹${"%.0f".format(plan.fee)}", size = 26, weight = FontWeight.Bold)
            }
            if (s.paying) Bi("बुकिंग और भुगतान हो रहा है…", "Booking and paying from the shop's account. Usually 15 to 20 seconds.", Tokens.muted, 18)
            else Action("₹${"%.0f".format(plan.fee)} में बुक करें", "Book and pay ₹${"%.0f".format(plan.fee)}") { pay(s) }
        }
        s.booking?.let { b ->
            Sheet {
                Body("बुक हो गया · Booked", Tokens.green, 16, FontWeight.SemiBold)
                Body(b.code, size = 44, weight = FontWeight.Bold)
                Bi("यह कोड ढक्कन पर मोटे अक्षरों में लिखिए", "Write this code in big letters on the lid. The AI checks it at every stop.", size = 19)
                Body("Drivers get ₹${b.shares.joinToString(" + ₹") { "%.2f".format(it) }} by kilometre", Tokens.muted, 15)
            }
            Step(2, "पार्सल दोबारा लगाइए", "Tap the parcel again to attach its tracking link", if (s.written && s.problem == null) "Link attached. Ready for pickup." else null, !s.written)
        }
        s.problem?.let { Verdict(Tokens.amber, "ध्यान दें", "Please note", it) }
        if (s.written || s.problem != null) Action("अगला पार्सल", "Book another parcel") { nfc.pendingWrite = null; screen = Screen.Pack() }
        if (!s.paying) Secondary("होम · Home") { nfc.pendingWrite = null; screen = Screen.Home }
    }

    @Composable
    private fun LookScreen(s: Screen.Look) {
        val info = s.info
        when {
            s.parcel == null -> Sheet { Bi("पार्सल फ़ोन के पीछे लगाइए", "Tap a parcel to see where it is", size = 22) }
            s.loading -> Bi("पढ़ रहे हैं…", "Reading the parcel…")
            info == null -> Verdict(Tokens.amber, "इंटरनेट नहीं", "No internet", "Try again when there is signal.")
            !info.registered -> Verdict(Tokens.amber, "बुक नहीं है", "Not booked", "This parcel has no Daak booking.")
            info.delivered -> Verdict(Tokens.green, "पहुँच गया", "Delivered", "${info.code} · ${info.label}")
            else -> Verdict(Tokens.ink, "रास्ते में", "On the way", "${info.code} · next stop: ${info.next?.place}")
        }
        Secondary("होम · Home") { screen = Screen.Home }
    }
}

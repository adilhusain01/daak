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

/** The join form, kept as plain values so a half-filled form survives a recomposition. */
data class JoinForm(
    val role: String? = null, val name: String = "", val phone: String = "", val upi: String = "", val vehicle: String = "",
    val legs: Set<String> = emptySet(), val stop: String? = null,
    /** Drivers: who runs the bus, and a government ID for KYC (only its type, last 4 and a photo are sent). */
    val busOperator: String? = null, val idType: String? = null, val idLast4: String = "", val idPhoto: File? = null,
)

/** Where the person is in the app. */
sealed interface Screen {
    data object SignIn : Screen
    data class Checking(val uid: String) : Screen
    data class Join(val uid: String, val form: JoinForm = JoinForm(), val net: Network? = null, val sending: Boolean = false, val errors: List<String> = emptyList()) : Screen
    data object Home : Screen
    data class Handoff(
        val parcel: Tap? = null, val info: ParcelInfo? = null, val loading: Boolean = false,
        val other: Tap? = null, val iGive: Boolean = true, val sending: Boolean = false, val problem: String? = null,
    ) : Screen
    data class Result(val verdict: Verdict, val offline: Boolean = false, val place: String? = null) : Screen
    data class Pack(
        val parcel: Tap? = null, val receivers: List<Receiver>? = null, val receiver: Receiver? = null,
        val plan: Plan? = null, val picks: List<Int> = emptyList(), val loading: Boolean = false, val paying: Boolean = false,
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
    private var todo by mutableStateOf<List<Todo>?>(null)
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
        if (ok && file != null && s is Screen.Join) { screen = s.copy(form = s.form.copy(idPhoto = shrink(file)), errors = emptyList()); return@registerForActivityResult }
        if (ok && file != null && s is Screen.Handoff && s.parcel != null && s.other != null) send(s, shrink(file))
        else if (s is Screen.Handoff) note = "फोटो नहीं ली गई। The photo was not taken; press Take the photo."
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
        thread { runCatching { Api.registerDevice(uid, DeviceKey.publicKey()) } } // idempotent: the first phone registers, the same phone is a no-op
        goHome()
    }

    private fun goHome() {
        screen = Screen.Home
        val p = me ?: return
        if (p.role == "driver") loadWork()
        thread { val t = runCatching { Api.todo(p.uid) }.getOrNull(); runOnUiThread { todo = t } }
    }

    private fun signIn(tap: Tap) {
        screen = Screen.Checking(tap.uid)
        thread {
            val r = runCatching { Api.me(tap.uid) }
            runOnUiThread {
                r.onSuccess { m ->
                    if (!m.known) { startJoin(tap.uid); return@onSuccess }
                    remember(Person(tap.uid, m.name.orEmpty(), m.role ?: "driver", m.vehicle.orEmpty()))
                    voice.buzz(); voice.say("नमस्ते ${firstName(me)}।")
                }.onFailure { screen = Screen.SignIn; note = "इंटरनेट नहीं मिला। No internet; tap the badge again when there is signal." }
            }
        }
    }

    private fun remember(p: Person) {
        me = p
        prefs.edit().putString("uid", p.uid).putString("name", p.name).putString("role", p.role).putString("vehicle", p.vehicle).apply()
        // Register this phone's signing key for the person (first phone only; a new phone goes through the operator).
        thread { runCatching { Api.registerDevice(p.uid, DeviceKey.publicKey()) } }
        goHome()
    }

    private fun signOut() {
        prefs.edit().clear().apply()
        me = null; work = null; todo = null; screen = Screen.SignIn
    }

    private fun firstName(p: Person?) = p?.name?.substringBefore(",")?.ifBlank { null } ?: "ji"

    // ---------- joining ----------

    private fun startJoin(uid: String) {
        screen = Screen.Join(uid)
        voice.buzz(); voice.say("यह बैज नया है। Daak से जुड़िए।")
        thread { val n = runCatching { Api.network() }.getOrNull(); runOnUiThread { (screen as? Screen.Join)?.let { screen = it.copy(net = n) } } }
    }

    private fun submitJoin(s: Screen.Join) {
        val f = s.form
        screen = s.copy(sending = true, errors = emptyList())
        thread {
            val r = runCatching { Api.join(s.uid, f.role ?: "", f.name, f.phone, f.upi, f.vehicle, f.legs.toList(), f.stop, f.busOperator, f.idType, f.idLast4, f.idPhoto) }
            runOnUiThread {
                r.onSuccess { errs ->
                    if (errs == null) {
                        remember(Person(s.uid, f.name.trim(), f.role ?: "driver", f.vehicle.uppercase()))
                        voice.buzz(); voice.say("स्वागत है ${f.name.trim()}। आप Daak से जुड़ गए।")
                    } else { screen = s.copy(sending = false, errors = errs); voice.buzz(false) }
                }.onFailure { screen = s.copy(sending = false, errors = listOf("No internet; try again when there is signal.")) }
            }
        }
    }

    // ---------- every tap goes through here ----------

    private fun onTap(tap: Tap) {
        note = null
        when (val s = screen) {
            Screen.SignIn -> signIn(tap)
            is Screen.Join -> Unit
            Screen.Home -> when {
                tap.uid == me?.uid -> Unit
                me?.role == "sender" -> startPack(tap)
                else -> startHandoff(tap) // drivers and receivers: tapping a parcel starts their next handoff with it
            }
            is Screen.Handoff -> when {
                s.sending || s.loading -> Unit
                s.parcel == null -> startHandoff(tap)
                s.other == null -> takeOther(s, tap)
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

    // ---------- a handoff, from either person's phone ----------

    private fun startHandoff(tap: Tap) {
        screen = Screen.Handoff(parcel = tap, loading = true)
        where.refresh()
        thread {
            val r = runCatching { Api.parcel(tap.uid) }
            runOnUiThread {
                val info = r.getOrNull()
                val mine = me?.let { badgeHash(it.uid) }
                when {
                    info == null -> { screen = Screen.Handoff(parcel = tap, problem = "No signal: the handoff will be saved on the phone and sent later."); voice.buzz() }
                    !info.registered -> { screen = Screen.Handoff(problem = "यह पार्सल बुक नहीं है। This parcel is not booked yet. The shop books it by tapping it."); voice.buzz(false); voice.say("यह पार्सल बुक नहीं है।") }
                    info.delivered -> { screen = Screen.Handoff(problem = "${info.code} पहुँच चुका है। ${info.code} is already delivered."); voice.buzz(false) }
                    info.next!!.fromHash != mine && info.next.toHash != mine -> {
                        val n = info.next
                        screen = Screen.Handoff(problem = "${info.code}: the next handoff is ${n.fromName} to ${n.toName} at ${n.place}. It is not yours.")
                        voice.buzz(false); voice.say("यह हैंडऑफ़ आपका नहीं है।")
                    }
                    else -> {
                        val n = info.next
                        val iGive = n.fromHash == mine
                        screen = Screen.Handoff(parcel = tap, info = info, iGive = iGive)
                        voice.buzz()
                        voice.say(if (iGive) "पार्सल ${info.code}। इसे ${n.toName} को दीजिए। उनका बैज लगाइए।" else "पार्सल ${info.code}। ${n.fromName} से लीजिए। उनका बैज लगाइए।")
                    }
                }
            }
        }
    }

    private fun takeOther(s: Screen.Handoff, tap: Tap) {
        if (tap.uid == s.parcel?.uid) { note = "यह वही पार्सल है। That is the same parcel; tap the other person's badge."; voice.buzz(false); return }
        if (tap.uid == me?.uid) { note = "यह आपका अपना बैज है। That is your own badge; tap the other person's badge."; voice.buzz(false); return }
        val n = s.info?.next
        val wanted = if (s.iGive) n?.toHash else n?.fromHash
        val who = if (s.iGive) n?.toName else n?.fromName
        if (wanted != null && badgeHash(tap.uid) != wanted) {
            note = "यह $who का बैज नहीं है। This is not $who's badge."
            voice.buzz(false); voice.say("यह $who का बैज नहीं है।")
            return
        }
        screen = s.copy(other = tap)
        voice.buzz(); voice.say("ठीक है। अब ढक्कन की फोटो लीजिए।")
        openCamera()
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
        val mine = me!!.uid
        val other = s.other!!.uid
        val from = if (s.iGive) mine else other
        val to = if (s.iGive) other else mine
        val at = System.currentTimeMillis()
        // Signed on this phone: the server and anyone reading the public log can check it came from here.
        val message = "daak.handoff|${s.parcel!!.uid}|$from|$to|$at|${DeviceKey.sha256Hex(photo.readBytes())}"
        val sig = runCatching { DeviceKey.sign(message) }.getOrNull()
        val h = Handoff(s.parcel.uid, from, to, photo, at = at, spot = where.last, signer = mine, sig = sig)
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
                        else -> "हैंडऑफ़ दर्ज हो गया। जाँच बाकी है, भुगतान रुका है।"
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
            val receivers = runCatching { Api.receivers() }.getOrNull()
            runOnUiThread {
                when {
                    known?.registered == true && known.delivered -> { screen = Screen.Pack(problem = "${known.code} was already delivered. Use a new sticker for a new parcel."); voice.buzz(false) }
                    known?.registered == true -> { startHandoff(tap) } // already booked: the shop's next job is the pickup handoff
                    receivers == null -> { screen = Screen.Pack(problem = "इंटरनेट नहीं मिला। No internet; booking needs signal."); voice.buzz(false) }
                    receivers.isEmpty() -> { screen = Screen.Pack(problem = "No receivers have joined Daak yet. The receiving shop taps a new badge to join."); voice.buzz(false) }
                    else -> { screen = Screen.Pack(parcel = tap, receivers = receivers); voice.buzz(); voice.say("पार्सल किसे भेजना है, चुनिए।") }
                }
            }
        }
    }

    private fun chooseReceiver(s: Screen.Pack, r: Receiver) {
        screen = s.copy(receiver = r, loading = true, plan = null, problem = null)
        thread {
            val plan = runCatching { Api.plan(me!!.uid, r.uid) }
            runOnUiThread {
                plan.onSuccess { p ->
                    val missing = p.stretches.firstOrNull { it.drivers.isEmpty() }
                    screen = if (missing != null) s.copy(receiver = r, loading = false, problem = "No driver runs ${missing.from} › ${missing.to} yet.")
                    else s.copy(receiver = r, loading = false, plan = p, picks = p.stretches.map { 0 })
                }.onFailure { screen = s.copy(receiver = r, loading = false, problem = it.message) }
            }
        }
    }

    private fun pay(s: Screen.Pack) {
        val plan = s.plan ?: return
        screen = s.copy(paying = true)
        voice.say("बुकिंग हो रही है।")
        thread {
            val drivers = plan.stretches.mapIndexed { i, st -> st.drivers[s.picks[i]].uid }
            val r = runCatching { Api.pack(s.parcel!!.uid, me!!.uid, s.receiver!!.uid, drivers) }
            runOnUiThread {
                r.onSuccess { b ->
                    nfc.pendingWrite = b.trackUrl
                    screen = s.copy(paying = false, booking = b)
                    voice.buzz(); voice.say("बुकिंग हो गई। कोड ढक्कन पर लिखिए, फिर पार्सल दोबारा लगाइए।")
                }.onFailure { screen = s.copy(paying = false, problem = "बुकिंग नहीं हुई: ${it.message}. Nothing was charged.") ; voice.buzz(false) }
            }
        }
    }

    private fun finishPack(s: Screen.Pack, tap: Tap) {
        if (tap.uid != s.parcel?.uid) { note = "यह दूसरा टैग है। That is a different tag; tap the same parcel."; voice.buzz(false); return }
        val ok = tap.text == s.booking?.trackUrl
        nfc.pendingWrite = null
        screen = s.copy(written = true, problem = if (ok) null else "The tag could not take the link; the booking still stands and the code on the lid is enough.")
        voice.buzz(ok); voice.say("पार्सल तैयार है। ड्राइवर को सौंपते समय पार्सल और उनका बैज लगाइए।")
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
                is Screen.Join -> JoinScreen(s)
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
            me?.let {
                val role = when (it.role) { "driver" -> "Driver"; "sender" -> "Shop"; else -> "Receiver" }
                Body("${it.name.ifBlank { "Badge ${it.uid.takeLast(8)}" }} · $role${if (it.vehicle.isNotBlank()) " · ${it.vehicle}" else ""}", Tokens.muted, 15)
            }
        }
    }

    @Composable
    private fun SignInScreen() {
        Sheet {
            Bi("अपना बैज फ़ोन के पीछे लगाइए", "Tap your badge on the back of the phone", size = 24)
            Body("New here? Tap a new badge and the phone helps you join. It remembers you until you switch.", Tokens.muted, 16)
        }
        if (!nfc.enabled) Body("NFC बंद है। Turn on NFC in Settings.", Tokens.red)
    }

    @Composable
    private fun JoinScreen(s: Screen.Join) {
        val f = s.form
        fun set(next: JoinForm) { screen = s.copy(form = next, errors = emptyList()) }
        Sheet {
            Bi("Daak से जुड़िए", "Join Daak with this badge", size = 24)
            Body("Badge ${s.uid.takeLast(8)}. Your phone and UPI ID are kept sealed; only your name, role and route are visible to others.", Tokens.muted, 15)
        }
        Body("आप कौन हैं? · Who are you?", Tokens.muted, 15)
        Choice("ड्राइवर · Driver", "I carry parcels on a bus route", f.role == "driver") { set(f.copy(role = "driver")) }
        Choice("दुकान · Shop sending parcels", "I book parcels to other shops", f.role == "sender") { set(f.copy(role = "sender")) }
        Choice("दुकान · Shop receiving parcels", "Parcels are delivered to me", f.role == "receiver") { set(f.copy(role = "receiver")) }
        if (f.role != null) {
            Field(if (f.role == "driver") "नाम · Your name" else "दुकान का नाम · Shop name", f.name, { set(f.copy(name = it)) }, if (f.role == "driver") "Ramesh Yadav" else "Gupta Garments")
            Field("मोबाइल · Mobile number", f.phone, { set(f.copy(phone = it.filter(Char::isDigit).take(10))) }, "98765 43210", number = true)
            if (f.role == "driver") {
                Field("UPI ID · where your pay goes", f.upi, { set(f.copy(upi = it.trim())) }, "ramesh@okaxis")
                Field("बस नंबर · Bus number (number plate)", f.vehicle, { set(f.copy(vehicle = it.uppercase())) }, "UP-78-AT-1123")
                Body("बस किसकी है? · Who runs the bus?", Tokens.muted, 15)
                listOf("UPSRTC" to "UP state bus", "BSRTC" to "Bihar state bus", "Private" to "Private operator").forEach { (id, sub) ->
                    Choice(id, sub, f.busOperator == id) { set(f.copy(busOperator = id)) }
                }
                Body("पहचान पत्र · Government ID (checked once by Daak, kept sealed)", Tokens.muted, 15)
                listOf(
                    Triple("dl", "ड्राइविंग लाइसेंस · Driving licence", "Best: it also shows you can drive the bus"),
                    Triple("voter", "वोटर आईडी · Voter ID", null),
                    Triple("aadhaar_masked", "आधार (छुपा हुआ) · Masked Aadhaar", "Cover the first 8 digits before the photo"),
                ).forEach { (id, title, sub) -> Choice(title, sub, f.idType == id) { set(f.copy(idType = id)) } }
                if (f.idType != null) {
                    Field("ID के आखिरी 4 अंक · Last 4 characters of the ID", f.idLast4, { set(f.copy(idLast4 = it.filter(Char::isLetterOrDigit).take(4).uppercase())) }, "4821")
                    if (f.idPhoto == null) Secondary("ID की फोटो लीजिए · Take a photo of the ID") { openCamera() }
                    else Body("ID की फोटो ली गई · ID photo taken.", Tokens.green, 16, FontWeight.SemiBold)
                    if (f.idPhoto != null) Secondary("दोबारा लें · Retake the photo") { openCamera() }
                }
                Body("आप कौन सा रास्ता चलाते हैं? · Which stretches do you drive?", Tokens.muted, 15)
                s.net?.legs?.forEach { l ->
                    Choice(l.label, "${l.km} km", l.id in f.legs) { set(f.copy(legs = if (l.id in f.legs) f.legs - l.id else f.legs + l.id)) }
                } ?: Body("Loading routes…", Tokens.muted, 15)
            } else {
                Body("आपका बस अड्डा · Your bus stand", Tokens.muted, 15)
                s.net?.stops?.forEach { st -> Choice(st.name, null, f.stop == st.id) { set(f.copy(stop = st.id)) } } ?: Body("Loading stands…", Tokens.muted, 15)
            }
            s.errors.forEach { Body(it, Tokens.red, 16) }
            Action(if (s.sending) "जुड़ रहे हैं…" else "जुड़ें", if (s.sending) "Joining…" else "Join Daak", enabled = !s.sending) { submitJoin(s) }
        }
        if (!s.sending) Secondary("रद्द करें · Cancel") { screen = Screen.SignIn }
    }

    @Composable
    private fun HomeScreen() {
        val p = me ?: return
        if (p.role == "driver") WorkCard(work)
        TodoCard()
        when (p.role) {
            "driver" -> {
                Action("पार्सल सौंपें या लें", "Hand over or take a parcel  ·  or just tap it") { screen = Screen.Handoff() }
                Action(
                    if ((work?.savePercent ?: 0) > 0) "बचत चालू है (5%)" else "बचत चालू करें (5%)",
                    if (savingBusy) "Saving…" else if ((work?.savePercent ?: 0) > 0) "Bachat is on: 5% of each payout is saved" else "Save 5% of every payout in Bachat",
                    if ((work?.savePercent ?: 0) > 0) Tokens.green else Tokens.ink,
                    enabled = !savingBusy,
                ) { toggleBachat() }
            }
            "sender" -> {
                Action("नया पार्सल बुक करें", "Book a new parcel  ·  or just tap it") { screen = Screen.Pack() }
                Secondary("ड्राइवर को सौंपें · Hand a booked parcel to the driver") { screen = Screen.Handoff() }
            }
            else -> {
                Action("पार्सल लें", "Receive a parcel  ·  or just tap it") { screen = Screen.Handoff() }
                Secondary("पार्सल की स्थिति · Check where a parcel is") { screen = Screen.Look() }
            }
        }
        if (queued > 0) Sheet { Bi("$queued हैंडऑफ़ सिग्नल का इंतज़ार कर रहे हैं", "$queued handoff(s) waiting for signal; they send by themselves", Tokens.amber, 18) }
        Spacer(Modifier.height(8.dp))
        Secondary("बैज बदलें · Switch badge") { signOut() }
    }

    @Composable
    private fun TodoCard() {
        val t = todo ?: return
        Sheet {
            Body("आगे क्या करना है · What's next for you", Tokens.muted, 15)
            if (t.isEmpty()) Body("Nothing waiting right now.", Tokens.muted, 17)
            t.take(4).forEach { Body(it.text, size = 17, weight = FontWeight.Medium) }
        }
    }

    @Composable
    private fun WorkCard(w: Work?) {
        Sheet {
            Body("मेरा काम · My work", Tokens.muted, 15)
            if (w == null) { Body("Loading your record…", Tokens.muted, 16); return@Sheet }
            Body("${w.proven} deliveries proven · ${w.km} km · ${w.cleanPercent}% clean", size = 19, weight = FontWeight.SemiBold)
            Body("कमाई · Earned ₹${"%.2f".format(w.earned)}", Tokens.green, 19, FontWeight.SemiBold)
            Body("सौंपते ही ${w.atHandover}% · You get ${w.atHandover}% at handover, the rest when the parcel is delivered", size = 17, weight = FontWeight.SemiBold)
            w.nextTier?.let { Body(it, Tokens.muted, 15) }
            Body("बचत · Bachat ₹${"%.2f".format(w.bachat)}", size = 17)
            if (w.advance > 0) Body("ईंधन एडवांस उपलब्ध · Fuel advance ₹${w.advance}", Tokens.green, 17, FontWeight.SemiBold)
            else Body("Fuel advance: ${w.advanceReason}", Tokens.muted, 15)
        }
    }

    @Composable
    private fun HandoffScreen(s: Screen.Handoff) {
        val n = s.info?.next
        val otherName = if (s.iGive) n?.toName else n?.fromName
        Step(1, "पार्सल लगाइए", "Tap the parcel",
            when { s.loading -> "Reading the parcel…"; s.info?.code != null -> "${s.info.code} · ${if (s.iGive) "you give" else "you take"} at ${n?.place?.substringBefore(",")}"; s.parcel != null -> "Parcel ${s.parcel.uid.takeLast(8)}"; else -> null },
            s.parcel == null && s.problem == null)
        Step(2, if (otherName != null) "$otherName का बैज लगाइए" else "दूसरे व्यक्ति का बैज लगाइए",
            if (otherName != null) "Tap $otherName's badge" else "Tap the other person's badge",
            s.other?.let { "$otherName confirmed" }, s.parcel != null && !s.loading && s.other == null && s.problem == null)
        Step(3, "ढक्कन की फोटो", "Photo of the lid, with the code readable",
            if (s.sending) "Checking with the sealed AI…" else null, s.other != null)
        s.problem?.let { Verdict(Tokens.amber, "रुकिए", "Hold on", it) }
        if (s.other != null && !s.sending) Action("फोटो लीजिए", "Take the photo") { openCamera() }
        if (s.sending) Bi("जाँच हो रही है…", "Checking the photo. This takes a few seconds.", Tokens.muted, 18)
        if (!s.sending) Secondary("वापस · Back") { goHome() }
    }

    @Composable
    private fun ResultScreen(s: Screen.Result) {
        val v = s.verdict
        when {
            s.offline -> Verdict(Tokens.amber, "फ़ोन में सेव", "Saved on the phone", "No signal. It sends by itself when the signal is back; the payment waits until it is checked.")
            v.verdict == "green" -> Verdict(Tokens.green, "सौंप दिया", "Handed over", "Checked: right parcel, right stop, still sealed.${s.place?.let { " $it." } ?: ""}${if (v.message.contains("% payment abhi")) " Your pay for this stretch is on its way now; the rest comes when the parcel is delivered." else ""}")
            v.verdict == "held" -> Verdict(Tokens.red, "भुगतान रोका गया", "Payment held", v.message.substringAfter(". ").ifBlank { v.message })
            else -> Verdict(Tokens.amber, "दर्ज हुआ, जाँच बाकी", "Recorded, waiting for the check", "The AI check could not run just now. The handoff is recorded and the payment waits; it is checked again automatically.")
        }
        v.code?.let { Body("$it${v.hop?.let { h -> " · handoff $h" } ?: ""}", Tokens.muted, 15) }
        Action("अगला पार्सल", "Next parcel") { screen = Screen.Handoff() }
        Secondary("होम · Home") { goHome() }
    }

    @Composable
    private fun PackScreen(s: Screen.Pack) {
        val plan = s.plan
        Step(1, "नया पार्सल लगाइए", "Tap the new parcel", when { s.parcel != null -> "Parcel ${s.parcel.uid.takeLast(8)}"; else -> null }, s.parcel == null && s.problem == null)
        if (s.receivers != null && s.booking == null) {
            Body("किसे भेजना है? · Send to", Tokens.muted, 15)
            s.receivers.forEach { r -> Choice(r.name, r.stopName, s.receiver?.uid == r.uid) { if (!s.loading && !s.paying) chooseReceiver(s, r) } }
        }
        if (s.loading) Body("Working out the route and the best drivers…", Tokens.muted, 16)
        if (plan != null && s.booking == null) {
            Sheet {
                Body("रास्ता और ड्राइवर · Route and drivers", Tokens.muted, 15)
                Body("${plan.from.substringBefore(",")} › ${plan.to}", size = 19, weight = FontWeight.SemiBold)
                Body("Pickup at ${plan.from}", Tokens.muted, 15)
            }
            plan.stretches.forEachIndexed { i, st ->
                val d = st.drivers[s.picks[i]]
                Choice("${st.from.substringBefore(",")} › ${st.to.substringBefore(",")} · ${st.km} km", "${d.name}${if (d.vehicle.isNotBlank()) " · ${d.vehicle}" else ""} · ${d.proven} proven · ${d.cleanPercent}% clean${if (st.drivers.size > 1) "  ·  tap to change" else ""}", true) {
                    if (st.drivers.size > 1 && !s.paying) screen = s.copy(picks = s.picks.toMutableList().also { it[i] = (it[i] + 1) % st.drivers.size })
                }
            }
            Sheet {
                Body("Daak meter: ${plan.meter} · ${plan.km} km", Tokens.muted, 15)
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
            Step(2, "पार्सल दोबारा लगाइए", "Tap the parcel again to attach its tracking link", if (s.written && s.problem == null) "Link attached" else null, !s.written)
            if (s.written) Sheet { Bi("अब ड्राइवर को सौंपिए", "Next: when the driver comes, tap this parcel and the driver's badge to hand it over.", size = 18) }
        }
        s.problem?.let { Verdict(Tokens.amber, "ध्यान दें", "Please note", it) }
        if (s.written || (s.problem != null && s.booking != null)) Action("अगला पार्सल", "Book another parcel") { nfc.pendingWrite = null; screen = Screen.Pack() }
        if (!s.paying) Secondary("होम · Home") { nfc.pendingWrite = null; goHome() }
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
            else -> Verdict(Tokens.ink, "रास्ते में", "On the way", "${info.code} · next: ${info.next?.fromName} to ${info.next?.toName} at ${info.next?.place}")
        }
        Secondary("होम · Home") { goHome() }
    }
}

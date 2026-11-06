package com.adilhusain.daak

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Box
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
    /** When the driver's bus leaves on each chosen stretch, "HH:MM". */
    val times: Map<String, String> = emptyMap(),
)

/** Where the person is in the app. */
sealed interface Screen {
    data object SignIn : Screen
    data class Checking(val uid: String) : Screen
    data class Join(val uid: String, val form: JoinForm = JoinForm(), val net: Network? = null, val sending: Boolean = false, val errors: List<String> = emptyList(), val idToken: String? = null) : Screen
    data object Home : Screen
    data class Handoff(
        val parcel: Tap? = null, val info: ParcelInfo? = null, val loading: Boolean = false,
        val other: Tap? = null, val iGive: Boolean = true, val sending: Boolean = false, val problem: String? = null,
        /** The other person's signed code, when they showed it instead of tapping a badge. */
        val otherCode: String? = null,
    ) : Screen
    data class Result(val verdict: Verdict, val offline: Boolean = false, val place: String? = null) : Screen
    data class Pack(
        val parcel: Tap? = null, val receivers: List<Receiver>? = null, val receiver: Receiver? = null,
        val plan: Plan? = null, val picks: List<Int> = emptyList(), val loading: Boolean = false, val paying: Boolean = false,
        val booking: Booking? = null, val written: Boolean = false, val problem: String? = null,
        /** Today's daily order waiting for this parcel (code and receiver), and whether this booking now repeats daily. */
        val dailyCode: String? = null, val dailyTo: String? = null, val drivers: List<String> = emptyList(),
        val dailySaved: Boolean = false, val dailyBusy: Boolean = false,
        /** Weight band, worked out from what the shop measured: s up to 5 kg, m to 15, l to 30, xl to 50. */
        val weight: String = "s",
        /** What the shop typed: kilograms and the three sides in centimetres. */
        val kg: String = "", val lengthCm: String = "", val widthCm: String = "", val heightCm: String = "",
    ) : Screen
    data class Look(val parcel: Tap? = null, val info: ParcelInfo? = null, val loading: Boolean = false) : Screen
    /** One parcel opened from "My parcels"; Back returns to where it was opened. */
    data class Parcel(val code: String, val from: Screen, val detail: ParcelDetail? = null, val problem: String? = null) : Screen
}

/** What the shop typed, as numbers, once all four are filled in. */
fun Screen.Pack.measured(): Measured? {
    val n = listOf(kg, lengthCm, widthCm, heightCm).map { it.toDoubleOrNull() ?: return null }
    return Measured(n[0], n[1], n[2], n[3])
}

class MainActivity : ComponentActivity() {
    private var screen by mutableStateOf<Screen>(Screen.SignIn)
    private var me by mutableStateOf<Person?>(null)
    private var note by mutableStateOf<String?>(null)
    private var queued by mutableStateOf(0)
    private var work by mutableStateOf<Work?>(null)
    private var todo by mutableStateOf<List<Todo>?>(null)
    private var daily by mutableStateOf<DailyList?>(null)
    private var shopBal by mutableStateOf<ShopBal?>(null)
    private var answering by mutableStateOf<String?>(null)
    private var awayBusy by mutableStateOf(false)
    private var timesEdit by mutableStateOf<Map<String, String>?>(null)
    private var timesBusy by mutableStateOf(false)
    /** Stretches being edited on the Me tab (null when unchanged). */
    private var legsEdit by mutableStateOf<Set<String>?>(null)
    /** Adding an ID from the Me tab: type, last 4, photo, sending. */
    private var idType by mutableStateOf<String?>(null)
    private var idLast4 by mutableStateOf("")
    private var idPhoto by mutableStateOf<File?>(null)
    private var idSending by mutableStateOf(false)
    private var idPhotoForMe = false
    /** Stretch names for display ("Kanpur to Lucknow"), from the published network. */
    private var legNames by mutableStateOf<Map<String, String>>(emptyMap())
    /** "My parcels": the pages loaded so far, and whether the next is on its way. */
    private var mine by mutableStateOf<ParcelList?>(null)
    private var mineBusy by mutableStateOf(false)
    /** Which of "My parcels" to show: still moving (default), delivered, or all. */
    private var mineFilter by mutableStateOf("transit")

    /** Digits typed into a time field become "HH:MM". */
    private fun timeInput(v: String): String {
        val d = v.filter(Char::isDigit).take(4)
        return if (d.length <= 2) d else "${d.take(2)}:${d.drop(2)}"
    }

    // ---------- tabs ----------
    /** The tab shown when the screen is Home; the other tabs are their own screens. */
    private var homeTab by mutableStateOf("jobs")
    /** Where the person was in each tab, so switching away and back keeps their place. */
    private var savedHandoff: Screen? = null
    private var savedPack: Screen.Pack? = null
    private var savedLook: Screen.Look? = null
    private var savingBusy by mutableStateOf(false)

    private lateinit var nfc: Nfc
    private lateinit var voice: Voice
    private lateinit var outbox: Outbox
    private lateinit var where: Where
    private var photoFile: File? = null
    private val prefs by lazy { getSharedPreferences("daak", Context.MODE_PRIVATE) }

    private val askLocation = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        if (granted.values.any { it }) { where.refresh(); askLocationOn() }
    }

    private val turnOnLocation = registerForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { r ->
        if (r.resultCode == RESULT_OK) where.refresh()
    }

    private fun hasLocationPermission() = listOf(android.Manifest.permission.ACCESS_FINE_LOCATION, android.Manifest.permission.ACCESS_COARSE_LOCATION)
        .any { checkSelfPermission(it) == android.content.pm.PackageManager.PERMISSION_GRANTED }

    /**
     * Every handoff carries where it happened. Without the permission, Android's prompt opens; with it but location
     * switched off, the system's "Turn on location?" window opens. Either way the handoff goes ahead without a place.
     */
    private fun ensureLocation() {
        if (!hasLocationPermission()) askLocation.launch(arrayOf(android.Manifest.permission.ACCESS_FINE_LOCATION, android.Manifest.permission.ACCESS_COARSE_LOCATION))
        else askLocationOn()
    }

    private fun askLocationOn() {
        val req = com.google.android.gms.location.LocationSettingsRequest.Builder()
            .addLocationRequest(com.google.android.gms.location.LocationRequest.Builder(com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY, 10_000).build())
            .setAlwaysShow(true).build()
        com.google.android.gms.location.LocationServices.getSettingsClient(this).checkLocationSettings(req)
            .addOnSuccessListener { where.refresh() }
            .addOnFailureListener { e ->
                if (e is com.google.android.gms.common.api.ResolvableApiException)
                    runCatching { turnOnLocation.launch(androidx.activity.result.IntentSenderRequest.Builder(e.resolution).build()) }
            }
    }

    private val takePhoto = registerForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val s = screen
        val file = photoFile
        if (ok && file != null && idPhotoForMe) { idPhotoForMe = false; idPhoto = shrink(file); return@registerForActivityResult }
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
        prefs.getString("lang", null)?.let { Lang.hindi = it == "hi" }
        nfc = Nfc(this, ::onTap)
        ensureLocation()
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

    /** The role's first tab: a driver's jobs, a shop's booking, a receiver's handoff. */
    private fun goHome() {
        val p = me ?: run { screen = Screen.SignIn; return }
        savedHandoff = null; savedPack = null; savedLook = null
        when (p.role) {
            "driver" -> { homeTab = "jobs"; screen = Screen.Home }
            "sender" -> screen = Screen.Pack()
            else -> screen = Screen.Handoff()
        }
        refreshHome()
    }

    private fun tabsFor(role: String) = when (role) {
        "driver" -> listOf(TabItem("jobs", "काम", "Jobs"), TabItem("hand", "सौंपें", "Hand over"), TabItem("earn", "कमाई", "Earnings"), TabItem("me", "मैं", "Me"))
        "sender" -> listOf(TabItem("book", "बुक", "Book"), TabItem("parcels", "पार्सल", "Parcels"), TabItem("money", "बैलेंस", "Balance"), TabItem("me", "मैं", "Me"))
        else -> listOf(TabItem("receive", "लें", "Receive"), TabItem("track", "स्थिति", "Track"), TabItem("me", "मैं", "Me"))
    }

    private fun currentTab(): String? = tabOf(screen)

    private fun tabOf(sc: Screen): String? {
        val role = me?.role ?: return null
        return when (sc) {
            is Screen.Parcel -> tabOf(sc.from)
            Screen.Home -> homeTab
            is Screen.Handoff, is Screen.Result -> when (role) { "driver" -> "hand"; "sender" -> "parcels"; else -> "receive" }
            is Screen.Pack -> "book"
            is Screen.Look -> "track"
            else -> null
        }
    }

    /** Switch tab, keeping the place in the one left; choosing the current tab again starts it fresh. */
    private fun selectTab(id: String) {
        val again = id == currentTab()
        when (val s = screen) {
            is Screen.Handoff, is Screen.Result -> savedHandoff = s
            is Screen.Pack -> { savedPack = s; nfc.pendingWrite = null }
            is Screen.Look -> savedLook = s
            else -> Unit
        }
        note = null
        when (id) {
            "hand", "receive" -> screen = if (again) Screen.Handoff() else savedHandoff ?: Screen.Handoff()
            "book" -> {
                val p = if (again) Screen.Pack() else savedPack ?: Screen.Pack()
                screen = p
                if (p.booking != null && !p.written) nfc.pendingWrite = p.booking.trackUrl
                loadBalance()
            }
            "track" -> { screen = if (again) Screen.Look() else savedLook ?: Screen.Look(); if (mine == null) loadMine(reset = true) }
            else -> { homeTab = id; screen = Screen.Home; refreshHome() }
        }
    }

    private fun refreshHome() {
        val p = me ?: return
        if (p.role == "driver") {
            loadWork()
            if (legNames.isEmpty()) thread { val n = runCatching { Api.network() }.getOrNull(); if (n != null) runOnUiThread { legNames = n.legs.associate { it.id to it.label } } }
        }
        if (p.role == "sender") {
            thread { val d = runCatching { Api.daily(p.uid) }.getOrNull(); runOnUiThread { daily = d } }
            loadBalance()
        }
        thread { val t = runCatching { Api.todo(p.uid) }.getOrNull(); runOnUiThread { todo = t } }
        loadMine(reset = true)
    }

    /** First page, or the next one appended to what is shown. */
    private fun loadMine(reset: Boolean = false) {
        val p = me ?: return
        val have = mine
        if ((mineBusy && !reset) || (!reset && have != null && have.page >= have.pages)) return
        val page = if (reset || have == null) 1 else have.page + 1
        val filter = mineFilter
        mineBusy = true
        thread {
            val r = runCatching { Api.myParcels(p.uid, page, filter) }
            runOnUiThread {
                if (filter != mineFilter) return@runOnUiThread // the person switched filter meanwhile
                mineBusy = false
                r.onSuccess { l -> mine = if (page == 1) l else l.copy(rows = (have?.rows ?: emptyList()) + l.rows) }
            }
        }
    }

    private fun openParcel(code: String) {
        val from = (screen as? Screen.Parcel)?.from ?: screen
        screen = Screen.Parcel(code, from)
        thread {
            val r = runCatching { Api.parcelDetail(code) }
            runOnUiThread {
                val now = screen as? Screen.Parcel ?: return@runOnUiThread
                if (now.code != code) return@runOnUiThread
                screen = r.fold({ now.copy(detail = it) }, { now.copy(problem = "Could not load $code. Check the signal and try again.") })
            }
        }
    }

    /** "Continue with Google": the phone's Google account, no sticker. Known accounts sign in; new ones join. */
    private fun googleSignIn() {
        val option = com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption.Builder(Api.GOOGLE_CLIENT_ID).build()
        val request = androidx.credentials.GetCredentialRequest.Builder().addCredentialOption(option).build()
        lifecycleScope.launch {
            val token = runCatching {
                val r = androidx.credentials.CredentialManager.create(this@MainActivity).getCredential(this@MainActivity, request)
                com.google.android.libraries.identity.googleid.GoogleIdTokenCredential.createFrom(r.credential.data).idToken
            }.getOrElse { note = pick("Google से साइन इन नहीं हुआ।", "Google sign-in did not finish.") + " " + (it.message ?: ""); return@launch }
            screen = Screen.Checking("google")
            thread {
                val g = runCatching { Api.google(token) }
                runOnUiThread {
                    g.onSuccess { m ->
                        if (!m.known) startJoin(m.uid, token, m.name)
                        else { remember(Person(m.uid, m.name, m.role ?: "driver", m.vehicle.orEmpty())); voice.buzz() }
                    }.onFailure { screen = Screen.SignIn; note = it.message }
                }
            }
        }
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
        me = null; work = null; todo = null; mine = null; screen = Screen.SignIn
    }

    private fun firstName(p: Person?) = p?.name?.substringBefore(",")?.ifBlank { null } ?: "ji"

    // ---------- joining ----------

    private fun startJoin(uid: String, idToken: String? = null, name: String = "") {
        screen = Screen.Join(uid, JoinForm(name = name), idToken = idToken)
        voice.buzz(); voice.say("यह बैज नया है। Daak से जुड़िए।")
        thread { val n = runCatching { Api.network() }.getOrNull(); runOnUiThread { (screen as? Screen.Join)?.let { screen = it.copy(net = n) } } }
    }

    private fun submitJoin(s: Screen.Join) {
        val f = s.form
        screen = s.copy(sending = true, errors = emptyList())
        thread {
            val r = runCatching { Api.join(s.uid, f.role ?: "", f.name, f.phone, f.upi, f.vehicle, f.legs.toList(), f.stop, f.busOperator, f.idType, f.idLast4, f.idPhoto, f.times.filterKeys { it in f.legs }.filterValues { it.isNotBlank() }, s.idToken) }
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
        ensureLocation()
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

    /** Scans the other person's code with Google's scanner; it stands in for tapping their badge. */
    private fun scanOther(s: Screen.Handoff) {
        val opts = com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(com.google.mlkit.vision.barcode.common.Barcode.FORMAT_QR_CODE).build()
        com.google.mlkit.vision.codescanner.GmsBarcodeScanning.getClient(this, opts).startScan()
            .addOnSuccessListener { b ->
                val raw = b.rawValue.orEmpty()
                val parts = raw.split("|")
                if (parts.size < 5 || parts[0] != "DAAK1") { note = pick("यह Daak कोड नहीं है।", "That is not a Daak code."); voice.buzz(false); return@addOnSuccessListener }
                val uid = parts.subList(1, parts.size - 3).joinToString("|")
                val now = screen as? Screen.Handoff ?: return@addOnSuccessListener
                takeOther(now.copy(otherCode = raw), Tap(uid, null, false))
            }
            .addOnFailureListener { note = pick("स्कैन नहीं हुआ। बैज लगाइए।", "Could not scan; tap their badge instead.") }
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
        val h = Handoff(s.parcel.uid, from, to, photo, at = at, spot = where.last, signer = mine, sig = sig, otherCode = s.otherCode)
        screen = s.copy(sending = true)
        thread {
            val result = runCatching { Api.handoff(h) }
            runOnUiThread {
                result.onSuccess { v ->
                    screen = Screen.Result(v, place = s.info?.next?.place)
                    voice.buzz(v.verdict == "green")
                    voice.say(when (v.verdict) {
                        "green" -> "सौंप दिया गया। भुगतान जारी।"
                        "held" -> v.reasonHi ?: "भुगतान रोका गया।"
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

    private fun loadBalance() {
        val uid = me?.uid ?: return
        thread { val b = runCatching { Api.shopBalance(uid) }.getOrNull(); runOnUiThread { shopBal = b } }
    }

    /** Opens the parcel's tracking page, with its route on the map, in the phone's browser. */
    private fun openMap(code: String) {
        runCatching { startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, Uri.parse("${Api.base}/track/$code"))) }
            .onFailure { note = "No browser found to open the map." }
    }

    /** Opens the phone's UPI app (GPay, PhonePe, Paytm) to pay Daak; the operator credits it once the payment shows. */
    private fun payByUpi(rupees: Int) {
        val upi = shopBal?.upiId ?: run { note = "Ask Daak for its UPI ID to top up."; return }
        val uri = Uri.parse("upi://pay?pa=${Uri.encode(upi)}&pn=Daak&am=$rupees&cu=INR&tn=${Uri.encode("Daak top-up ${me?.name ?: ""}".trim())}")
        runCatching { startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, uri)) }
            .onFailure { note = "No UPI app found. Pay $upi by UPI and send the reference to Daak." }
    }

    private fun startPack(tap: Tap) {
        screen = Screen.Pack(parcel = tap, loading = true)
        loadBalance()
        thread {
            val known = runCatching { Api.parcel(tap.uid) }.getOrNull()
            val waiting = if (known?.registered == true) null else runCatching { Api.daily(me!!.uid) }.getOrNull()
            val receivers = runCatching { Api.receivers() }.getOrNull()
            runOnUiThread {
                when {
                    waiting?.waitingCode != null -> { screen = Screen.Pack(parcel = tap, receivers = receivers, dailyCode = waiting.waitingCode, dailyTo = waiting.waitingReceiver); voice.buzz(); voice.say("आज का रोज़ का पार्सल बुक है। इसे जोड़िए।") }
                    known?.registered == true && known.delivered -> { screen = Screen.Pack(problem = "${known.code} was already delivered. Use a new sticker for a new parcel."); voice.buzz(false) }
                    known?.registered == true && known.code != null && tap.writable && tap.text != "${Api.base}/track/${known.code}" -> {
                        // Booked, but the sticker never got its tracking link: write it now, then the next tap starts the pickup.
                        val b = Booking(known.code, "${Api.base}/track/${known.code}", emptyList())
                        nfc.pendingWrite = b.trackUrl
                        screen = Screen.Pack(parcel = tap, booking = b)
                        voice.buzz(); voice.say("पार्सल दोबारा लगाइए।")
                    }
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
            val measured = s.measured()
            val band = measured?.let { m -> charge(plan, m).getOrNull()?.band?.id } ?: s.weight
            val r = runCatching { Api.pack(s.parcel!!.uid, me!!.uid, s.receiver!!.uid, drivers, band, measured) }
            runOnUiThread {
                r.onSuccess { b ->
                    nfc.pendingWrite = b.trackUrl
                    screen = s.copy(paying = false, booking = b, drivers = drivers, problem = null)
                    loadBalance()
                    voice.buzz(); voice.say("बुकिंग हो गई। कोड ढक्कन पर लिखिए, फिर पार्सल दोबारा लगाइए।")
                }.onFailure { screen = s.copy(paying = false, problem = "बुकिंग नहीं हुई: ${it.message}. Nothing was charged.") ; voice.buzz(false) }
            }
        }
    }

    /** The shop's daily order was booked and paid this morning; this parcel becomes it. */
    private fun attachDaily(s: Screen.Pack) {
        screen = s.copy(paying = true)
        thread {
            val r = runCatching { Api.attachDaily(me!!.uid, s.parcel!!.uid) }
            runOnUiThread {
                r.onSuccess { code ->
                    val b = Booking(code, "${Api.base}/track/$code", emptyList())
                    nfc.pendingWrite = b.trackUrl
                    screen = s.copy(paying = false, booking = b, dailySaved = true)
                    voice.buzz(); voice.say("जुड़ गया। कोड ढक्कन पर लिखिए, फिर पार्सल दोबारा लगाइए।")
                }.onFailure { screen = s.copy(paying = false, problem = it.message); voice.buzz(false) }
            }
        }
    }

    private fun makeDaily(s: Screen.Pack) {
        screen = s.copy(dailyBusy = true)
        thread {
            val r = runCatching { Api.makeDaily(me!!.uid, s.receiver!!.uid, s.drivers, s.weight) }
            runOnUiThread {
                val now = screen as? Screen.Pack ?: return@runOnUiThread
                r.onSuccess { screen = now.copy(dailyBusy = false, dailySaved = true); voice.buzz(); voice.say("हर दिन सुबह चार बजे बुक होगा।") }
                    .onFailure { screen = now.copy(dailyBusy = false, problem = it.message); voice.buzz(false) }
            }
        }
    }

    private fun finishPack(s: Screen.Pack, tap: Tap) {
        if (tap.uid != s.parcel?.uid) { note = "यह दूसरा टैग है। That is a different tag; tap the same parcel."; voice.buzz(false); return }
        val ok = tap.text == s.booking?.trackUrl
        if (!ok && tap.writable) {
            // The write did not finish (a quick tap, or the sticker moved). Keep it queued: the next tap tries again.
            nfc.pendingWrite = s.booking?.trackUrl
            screen = s.copy(problem = "The link did not save. Hold the parcel still on the back of the phone and tap again.")
            voice.buzz(false); return
        }
        nfc.pendingWrite = null
        screen = s.copy(written = true, problem = if (ok) null else "This sticker cannot take a link; the booking still stands and the code on the lid is enough.")
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

    private fun answerJob(t: Todo, accept: Boolean) {
        val uid = me?.uid ?: return
        answering = t.code
        thread {
            val r = runCatching { Api.job(t.code, uid, accept) }
            val fresh = runCatching { Api.todo(uid) }.getOrNull()
            runOnUiThread {
                answering = null
                r.onSuccess {
                    // The answer reaches the public log a few seconds after it is saved, so the fresh list can still offer it: drop it here.
                    todo = (fresh ?: todo)?.filterNot { it.action == "offer" && it.code == t.code }; voice.buzz(); voice.say(if (accept) "काम स्वीकार किया।" else "काम मना किया।") }
                    .onFailure { note = "जवाब नहीं गया। Could not send; try again." }
            }
        }
    }

    private fun toggleAway() {
        val uid = me?.uid ?: return
        val next = !(work?.awayToday ?: false)
        awayBusy = true
        thread {
            val r = runCatching { Api.setAway(uid, next) }
            val w = runCatching { Api.work(uid) }.getOrNull()
            val t = runCatching { Api.todo(uid) }.getOrNull()
            runOnUiThread {
                awayBusy = false
                r.onSuccess { n ->
                    if (w != null) work = w; if (t != null) todo = t
                    voice.buzz(); voice.say(if (next) "आज की छुट्टी दर्ज हुई।" else "आज चला रहे हैं।")
                    if (next && n > 0) note = "$n stretch(es) for today handed to other drivers."
                }.onFailure { note = "सेव नहीं हुआ। Could not save; try again." }
            }
        }
    }

    private fun sendId() {
        val uid = me?.uid ?: return
        val type = idType ?: return
        val photo = idPhoto ?: return
        idSending = true
        thread {
            val r = runCatching { Api.submitId(uid, type, idLast4, photo) }
            val w = runCatching { Api.work(uid) }.getOrNull()
            runOnUiThread {
                idSending = false
                r.onSuccess { if (w != null) work = w; idType = null; idLast4 = ""; idPhoto = null; voice.buzz(); voice.say("पहचान पत्र भेजा गया। Daak जाँच करेगा।") }
                    .onFailure { note = it.message ?: "Could not send the ID." }
            }
        }
    }

    private fun saveTimes(times: Map<String, String>, legs: Set<String>? = null) {
        val uid = me?.uid ?: return
        timesBusy = true
        thread {
            val r = runCatching { Api.setTimes(uid, times.filterValues { it.isNotBlank() }.filterKeys { legs == null || it in legs }, legs?.toList()) }
            val w = runCatching { Api.work(uid) }.getOrNull()
            runOnUiThread {
                timesBusy = false
                r.onSuccess { if (w != null) work = w; timesEdit = null; legsEdit = null; voice.buzz(); note = null }
                    .onFailure { note = it.message ?: "Could not save the times." }
            }
        }
    }

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
        val tabs = me?.let { tabsFor(it.role) }
        val current = currentTab()
        // Back goes to the first tab before it leaves the app.
        androidx.activity.compose.BackHandler(enabled = tabs != null && current != null && current != tabs.first().id) { selectTab(tabs!!.first().id) }
        (screen as? Screen.Parcel)?.let { p -> androidx.activity.compose.BackHandler { screen = p.from } }
        val scroll = rememberScrollState()
        androidx.compose.runtime.LaunchedEffect(current, screen is Screen.Parcel) { scroll.scrollTo(0) }
        // "My parcels" loads its next page by itself when the list nears the end of the screen.
        androidx.compose.runtime.LaunchedEffect(scroll) {
            androidx.compose.runtime.snapshotFlow { scroll.maxValue > 0 && scroll.value >= scroll.maxValue - 900 }
                .collect { near -> if (near && screen !is Screen.Parcel) loadMine() }
        }
        Column(Modifier.fillMaxSize().background(Tokens.paper).safeDrawingPadding()) {
        Column(
            Modifier.weight(1f).verticalScroll(scroll).padding(Tokens.pad),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Header()
            when (val s = screen) {
                Screen.SignIn -> SignInScreen()
                is Screen.Checking -> Waiting(pick("बैज जाँच रहे हैं", "Checking your badge"))
                is Screen.Join -> JoinScreen(s)
                Screen.Home -> HomeScreen()
                is Screen.Handoff -> HandoffScreen(s)
                is Screen.Result -> ResultScreen(s)
                is Screen.Pack -> PackScreen(s)
                is Screen.Look -> LookScreen(s)
                is Screen.Parcel -> ParcelScreen(s)
            }
            note?.let { Body(it, Tokens.red, 17) }
        }
        if (tabs != null && current != null) SegmentedTabs(tabs, current) { selectTab(it.id) }
        }
    }

    @Composable
    private fun Header() {
        // The mark, and who this phone is signed in as (first name and role); the full details live on the Me tab.
        val p = me
        Brand(
            name = p?.name?.trim()?.substringBefore(" ")?.takeIf { it.isNotEmpty() },
            role = when (p?.role) {
                "driver" -> pick("ड्राइवर", "Driver"); "sender" -> pick("भेजने वाली दुकान", "Sending shop"); "receiver" -> pick("पाने वाली दुकान", "Receiving shop"); else -> null
            },
        )
    }

    @Composable
    private fun SignInScreen() {
        Sheet {
            Bi("Daak में आइए", "Sign in to Daak", size = 24)
            Body(pick("अपने Google खाते से, या बैज फ़ोन के पीछे लगाकर। नए हैं? यही से जुड़िए।", "With your Google account, or tap your badge on the back of the phone. New here? You join the same way."), Tokens.muted, 16)
        }
        Action(pick("Google से जारी रखें", "Continue with Google")) { googleSignIn() }
        if (!nfc.enabled) Body("NFC बंद है। Turn on NFC in Settings.", Tokens.red)
        LanguageSwitch()
    }

    private var vouchBusy by mutableStateOf(false)

    /**
     * Who vouches for this driver, and, for someone whose ID Daak has checked, a key to vouch for a newcomer:
     * scan their code, and this phone signs "I know them" onto the public log.
     */
    @Composable
    private fun TrustCard(w: Work) {
        Sheet {
            Heading("भरोसा", "Who vouches for you")
            if (w.vouchedBy.isEmpty()) Body(pick("अभी किसी ने नहीं। जिस ड्राइवर की पहचान जाँची जा चुकी है, उससे अपना कोड स्कैन करवाएँ।", "No one yet. Ask a driver whose ID Daak has checked to scan your code."), Tokens.muted, 15)
            else Body(pick("${w.vouchedBy.joinToString(", ")} ने आपके लिए भरोसा दिया", "Vouched for by ${w.vouchedBy.joinToString(", ")}"), Tokens.green, 16, FontWeight.SemiBold)
            if (w.idStatus == "verified") {
                if (vouchBusy) Waiting(pick("भेज रहे हैं", "Sending"))
                else Secondary(pick("नए ड्राइवर के लिए भरोसा दें: उनका कोड स्कैन करें", "Vouch for a new driver: scan their code")) { vouchFor() }
            }
        }
        MyCode()
    }

    private fun vouchFor() {
        val uid = me?.uid ?: return
        val opts = com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(com.google.mlkit.vision.barcode.common.Barcode.FORMAT_QR_CODE).build()
        com.google.mlkit.vision.codescanner.GmsBarcodeScanning.getClient(this, opts).startScan().addOnSuccessListener { b ->
            val code = b.rawValue.orEmpty()
            if (!code.startsWith("DAAK1|")) { note = pick("यह Daak कोड नहीं है।", "That is not a Daak code."); return@addOnSuccessListener }
            vouchBusy = true
            thread {
                val r = runCatching { Api.vouch(uid, code) }
                runOnUiThread {
                    vouchBusy = false
                    r.onSuccess { name -> note = null; voice.buzz(); android.widget.Toast.makeText(this, pick("$name के लिए भरोसा दर्ज हुआ", "Vouched for $name, on the public log"), android.widget.Toast.LENGTH_LONG).show() }
                        .onFailure { note = it.message; voice.buzz(false) }
                }
            }
        }
    }

    /** Hindi or English, for the whole app; remembered on the phone. */
    @Composable
    private fun LanguageSwitch() {
        Sheet {
            Heading("भाषा", "Language")
            androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(true to "हिंदी", false to "English").forEach { (hindi, label) ->
                    SmallKey(label, Modifier.weight(1f), filled = Lang.hindi == hindi) {
                        Lang.hindi = hindi
                        prefs.edit().putString("lang", if (hindi) "hi" else "en").apply()
                    }
                }
            }
        }
    }

    @Composable
    private fun JoinScreen(s: Screen.Join) {
        val f = s.form
        fun set(next: JoinForm) { screen = s.copy(form = next, errors = emptyList()) }
        Sheet {
            Bi("Daak से जुड़िए", if (s.idToken != null) "Join Daak with your Google account" else "Join Daak with this badge", size = 24)
            Body((if (s.idToken != null) pick("Google खाते से। ", "Signed in with Google. ") else "Badge ${s.uid.takeLast(8)}. ") + pick("आपका फ़ोन नंबर, UPI और ईमेल छिपे रहते हैं; दूसरों को सिर्फ़ नाम, काम और रास्ता दिखता है।", "Your phone, UPI ID and email are kept sealed; only your name, role and route are visible to others."), Tokens.muted, 15)
        }
        Heading("आप कौन हैं?", "Who are you?")
        Choice("ड्राइवर · Driver", "I carry parcels on a bus route", f.role == "driver") { set(f.copy(role = "driver")) }
        Choice("दुकान · Shop sending parcels", "I book parcels to other shops", f.role == "sender") { set(f.copy(role = "sender")) }
        Choice("दुकान · Shop receiving parcels", "Parcels are delivered to me", f.role == "receiver") { set(f.copy(role = "receiver")) }
        if (f.role != null) {
            Field(if (f.role == "driver") "नाम · Your name" else "दुकान का नाम · Shop name", f.name, { set(f.copy(name = it)) }, if (f.role == "driver") "Ramesh Yadav" else "Gupta Garments")
            Field("मोबाइल · Mobile number", f.phone, { set(f.copy(phone = it.filter(Char::isDigit).take(10))) }, "98765 43210", number = true)
            if (f.role == "driver") {
                Field("UPI ID · where your pay goes", f.upi, { set(f.copy(upi = it.trim())) }, "ramesh@okaxis")
                Field("बस नंबर · Bus number (number plate)", f.vehicle, { set(f.copy(vehicle = it.uppercase())) }, "UP-78-AT-1123")
                Heading("बस किसकी है?", "Who runs the bus?")
                listOf("UPSRTC" to "UP state bus", "BSRTC" to "Bihar state bus", "Private" to "Private operator").forEach { (id, sub) ->
                    Choice(id, sub, f.busOperator == id) { set(f.copy(busOperator = id)) }
                }
                Heading("पहचान पत्र", "Government ID")
                Body("Checked once by Daak and kept sealed. Only the last 4 characters are stored.", Tokens.muted, 14)
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
                Heading("आपका रास्ता", "Stretches you drive")
                s.net?.legs?.forEach { l ->
                    Choice(l.label, "${l.km} km", l.id in f.legs) { set(f.copy(legs = if (l.id in f.legs) f.legs - l.id else f.legs + l.id)) }
                    if (l.id in f.legs) Field("बस कब चलती है · Your bus leaves at (HH:MM)", f.times[l.id] ?: "", { v -> set(f.copy(times = f.times + (l.id to timeInput(v)))) }, "06:30", number = true)
                } ?: Waiting("Loading routes")
            } else {
                Heading("आपका बस अड्डा", "Your bus stand")
                s.net?.stops?.forEach { st -> Choice(st.name, null, f.stop == st.id) { set(f.copy(stop = st.id)) } } ?: Waiting("Loading stands")
            }
            s.errors.forEach { Body(it, Tokens.red, 16) }
            Action("जुड़ें", "Join Daak", busy = s.sending) { submitJoin(s) }
        }
        if (!s.sending) TextKey("रद्द करें · Cancel") { screen = Screen.SignIn }
    }

    @Composable
    private fun HomeScreen() {
        val p = me ?: return
        when (homeTab) {
            "jobs" -> {
                Action("पार्सल सौंपें या लें", "Hand over or take a parcel, or just tap it") { selectTab("hand") }
                QueuedNote()
                OfferCard((todo ?: emptyList()).filter { it.action == "offer" })
                TodoCard("Nothing waiting. New jobs and handoffs show here.")
                work?.let { w -> Toggle("आज छुट्टी · Not driving today", if (w.awayToday) "Today's stretches go to other drivers" else "Turn on if your bus is not running today", w.awayToday, awayBusy) { toggleAway() } }
                MyParcels("Parcels you carry show here once a shop books you.")
            }
            "earn" -> {
                WorkCard(work)
                val on = (work?.savePercent ?: 0) > 0
                Toggle("बचत · Bachat", if (on) "5% of every payout goes to your savings pot" else "Save 5% of every payout automatically", on, savingBusy) { toggleBachat() }
            }
            "parcels" -> {
                TodoCard("No parcels waiting. Book one in the Book tab.")
                Secondary("ड्राइवर को सौंपें · Hand a booked parcel to the driver") { screen = Screen.Handoff() }
                DailyCard()
                MyParcels("Parcels you book show here.")
                QueuedNote()
            }
            "money" -> BalanceScreen()
            "me" -> MeScreen(p)
        }
    }

    @Composable
    private fun QueuedNote() {
        if (queued > 0) Sheet { Bi("$queued हैंडऑफ़ सिग्नल का इंतज़ार कर रहे हैं", "$queued handoff(s) waiting for signal; they send by themselves", Tokens.amber, 18) }
    }

    @Composable
    private fun BalanceScreen() {
        val b = shopBal
        Sheet {
            Heading("बैलेंस", "Balance")
            if (b == null) Waiting("Loading")
            else Line("Prepaid for bookings", "₹${"%.2f".format(b.rupees)}", if (b.rupees >= 250) Tokens.green else Tokens.red, big = true)
            Body("Your Daak agent pays every booking from this balance. Top up by UPI; it shows here once Daak sees the payment.", Tokens.muted, 14)
        }
        Heading("UPI से जोड़ें", "Top up by UPI")
        listOf(500, 1000, 2000).forEach { amt -> Choice("₹$amt", "Opens your UPI app with Daak's ID and the amount", false) { payByUpi(amt) } }
    }

    @Composable
    private fun MeScreen(p: Person) {
        val role = when (p.role) { "driver" -> pick("ड्राइवर", "Driver"); "sender" -> pick("पार्सल भेजने वाली दुकान", "Shop sending parcels"); else -> pick("पार्सल लेने वाली दुकान", "Shop receiving parcels") }
        Sheet {
            Heading("मैं", "Me")
            Line("नाम · Name", p.name.ifBlank { "Not set" })
            Line("भूमिका · Role", role)
            if (p.vehicle.isNotBlank()) Line("बस · Bus", p.vehicle)
            Line("बैज · Badge", "…${p.uid.takeLast(8)}")
            Body("Handoffs from this phone are signed with a key kept in its secure hardware, so nobody can record one in your name.", Tokens.muted, 14)
        }
        LanguageSwitch()
        if (p.role == "driver") work?.let { w ->
            val edit = timesEdit ?: w.times
            val legs = legsEdit ?: w.legs.toSet()
            Sheet {
                Heading("रास्ते और बस का समय", "Your stretches and bus times")
                Body(pick("आप कौन से रास्ते चलाते हैं और बस कब चलती है, सोमवार से शनिवार। दुकानों को आपका समय दिखता है।", "Which stretches you drive and when your bus leaves, Monday to Saturday. Shops see your ETA and only connecting buses are booked."), Tokens.muted, 14)
                (legNames.keys.ifEmpty { w.legs }).forEach { leg ->
                    Choice(legNames[leg] ?: leg.replace("-", " to "), null, leg in legs) { legsEdit = if (leg in legs) legs - leg else legs + leg }
                    if (leg in legs) Field(pick("बस कब चलती है (HH:MM)", "Your bus leaves at (HH:MM)"), edit[leg] ?: "", { v -> timesEdit = edit + (leg to timeInput(v)) }, "06:30", number = true)
                }
            }
            if ((timesEdit != null || legsEdit != null) && legs.isNotEmpty()) Action("सेव करें", "Save", busy = timesBusy) { saveTimes(edit, legsEdit) }
        }
        if (p.role == "driver") work?.let { w -> TrustCard(w) }
        if (p.role == "driver") work?.let { w ->
            Sheet {
                Heading("पहचान पत्र", "Your ID")
                when (w.idStatus) {
                    "verified" -> Body("Checked by Daak. Shops see \"ID checked\" on your record.", Tokens.green, 16, FontWeight.SemiBold)
                    "pending" -> Body("Sent. Daak checks it soon.", Tokens.muted, 16)
                    else -> {
                        Body(if (w.idStatus == "rejected") "Daak could not accept the last photo. Send it again." else "Add a government ID so shops see your record is checked. Only the last 4 characters are kept.", Tokens.muted, 14)
                        listOf("dl" to "ड्राइविंग लाइसेंस · Driving licence", "voter" to "वोटर आईडी · Voter ID", "aadhaar_masked" to "आधार (छुपा हुआ) · Masked Aadhaar").forEach { (id, title) ->
                            Choice(title, if (id == "aadhaar_masked") "Cover the first 8 digits before the photo" else null, idType == id) { idType = id }
                        }
                        if (idType != null) {
                            Field("ID के आखिरी 4 अंक · Last 4 characters", idLast4, { idLast4 = it.filter(Char::isLetterOrDigit).take(4).uppercase() }, "4821")
                            Secondary(if (idPhoto == null) "ID की फोटो लीजिए · Take a photo of the ID" else "फोटो ली गई · Photo taken, tap to retake") { idPhotoForMe = true; openCamera() }
                            if (idPhoto != null && idLast4.length == 4) Action("ID भेजें", "Send the ID to Daak", busy = idSending) { sendId() }
                        }
                    }
                }
            }
        }
        QueuedNote()
        TextKey("बैज बदलें · Switch badge") { signOut() }
    }

    @Composable
    private fun DailyCard() {
        val d = daily ?: return
        if (d.orders.isEmpty()) return
        Sheet {
            Heading("रोज़ के पार्सल", "Daily orders")
            d.waitingCode?.let { Body("आज का पार्सल बुक है: ${d.waitingReceiver} ($it). Tap the parcel to attach it.", Tokens.green, 17, FontWeight.SemiBold) }
            d.orders.filter { it.active }.take(4).forEach {
                Line(it.receiver, it.lastCode ?: "4 am")
                Body(it.daysText, Tokens.muted, 14)
            }
        }
    }

    @Composable
    private fun OfferCard(offers: List<Todo>) {
        if (offers.isEmpty()) return
        Sheet {
            Heading("नया काम", "New jobs · ${offers.size}")
            offers.take(3).forEachIndexed { i, o ->
                if (i > 0) Rule()
                Body(o.code, Tokens.ink, 17, FontWeight.Bold)
                Body(o.text, Tokens.ink, 16)
                if (answering == o.code) Waiting("Sending")
                else androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SmallKey("स्वीकार · Accept", Modifier.weight(1f), Tokens.green) { answerJob(o, true) }
                    SmallKey("मना · Decline", Modifier.weight(1f), filled = false) { answerJob(o, false) }
                }
            }
            if (offers.size > 3) Body("+${offers.size - 3} more after you answer these", Tokens.muted, 14)
        }
    }

    @Composable
    private fun TodoCard(empty: String? = null) {
        val all = todo ?: return
        val t = all.filter { it.action != "offer" }
        if (t.isEmpty()) { if (empty != null) Body(empty, Tokens.muted, 16); return }
        Sheet {
            Heading("आगे क्या करना है", "Up next")
            t.take(3).forEachIndexed { i, item ->
                if (i > 0) Rule()
                Column(Modifier.fillMaxWidth().clickable { openParcel(item.code) }, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Body(item.code, Tokens.ink, 17, FontWeight.Bold)
                    Body(item.text.replace("${item.code} ", ""), Tokens.muted, 15)
                }
            }
            if (t.size > 3) Body("+${t.size - 3} more in My parcels below", Tokens.muted, 14)
        }
    }

    @Composable
    private fun WorkCard(w: Work?) {
        Sheet {
            Heading("मेरा काम", "My work")
            if (w == null) { Waiting("Loading your record"); return@Sheet }
            Stats(listOf("${w.proven}" to "proven", "${w.km} km" to "carried", "${w.cleanPercent}%" to "clean"))
            Line("कमाई · Earned", "₹${"%.2f".format(w.earned)}", Tokens.green, big = true)
            // How much of each stretch's pay arrives at the handover, and how close the next step is.
            val goal = if (w.atHandover <= 50) 10 else 50
            Line("सौंपते ही · At handover", "${w.atHandover}% of your pay")
            if (w.atHandover < 90) Progress(w.proven / goal.toFloat())
            w.nextTier?.let { Body(it, Tokens.muted, 14) }
            Line("बचत · Bachat", "₹${"%.2f".format(w.bachat)}")
            if (w.advance > 0) Line("ईंधन एडवांस · Fuel advance", "₹${w.advance} ready", Tokens.green)
            else Body("Fuel advance: ${w.advanceReason}", Tokens.muted, 14)
        }
    }

    @Composable
    private fun HandoffScreen(s: Screen.Handoff) {
        val n = s.info?.next
        val otherName = if (s.iGive) n?.toName else n?.fromName
        // Receiving: the code comes first, big enough to scan across a bus stand.
        if (s.parcel == null && showCode) MyCode()
        Bi("पार्सल सौंपें या लें", "Hand over or take a parcel", size = 24)
        Step(1, "पार्सल लगाइए", "Tap the parcel",
            when { s.loading -> "Reading the parcel…"; s.info?.code != null -> "${s.info.code} · ${if (s.iGive) "you give" else "you take"} at ${n?.place?.substringBefore(",")}"; s.parcel != null -> "Parcel ${s.parcel.uid.takeLast(8)}"; else -> null },
            s.parcel == null && s.problem == null)
        val step2 = s.parcel != null && !s.loading && s.other == null && s.problem == null
        Step(2, if (otherName != null) "$otherName का कोड स्कैन करें या बैज लगाएँ" else "दूसरे व्यक्ति का कोड स्कैन करें या बैज लगाएँ",
            if (otherName != null) "Scan $otherName's code, or tap their badge" else "Scan the other person's code, or tap their badge",
            s.other?.let { pick("$otherName ने पुष्टि की", "$otherName confirmed") + if (s.otherCode != null) pick(" · दोनों फ़ोन ने साइन किया", " · both phones signed") else "" }, step2)
        if (step2) Action("कोड स्कैन करें", if (otherName != null) "Scan $otherName's code" else "Scan their code") { scanOther(s) }
        Step(3, "ढक्कन की फोटो", "Photo of the lid, with the code readable",
            if (s.sending) "Checking with the sealed AI…" else null, s.other != null)
        s.problem?.let { Verdict(Tokens.amber, "रुकिए", "Hold on", it) }
        if (s.other != null && !s.sending) Action("फोटो लीजिए", "Take the photo") { openCamera() }
        if (s.sending) Waiting(pick("फ़ोटो जाँच रहे हैं", "Checking the photo"), pick("कुछ सेकंड लगेंगे", "A few seconds"))
        if (s.parcel == null && !showCode) MyCode()
    }

    private var showCode by mutableStateOf(false)

    /**
     * This person's code for the other side of a handoff: signed by this phone's key, renewed every 30 seconds,
     * good for two minutes and once. The other person scans it instead of tapping a badge.
     */
    @Composable
    private fun MyCode() {
        val p = me ?: return
        if (!showCode) { Secondary(pick("लेने वाले हैं? अपना कोड दिखाएँ", "Receiving a parcel? Show my code")) { showCode = true }; return }
        var tick by androidx.compose.runtime.remember { mutableStateOf(0) }
        androidx.compose.runtime.LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(30_000); tick++ } }
        val image = androidx.compose.runtime.remember(tick) {
            val issuedAt = System.currentTimeMillis()
            val nonce = java.util.UUID.randomUUID().toString().replace("-", "").take(12)
            val sig = runCatching { DeviceKey.sign("daak.receive|${p.uid}|$issuedAt|$nonce") }.getOrNull()
            sig?.let { qr("DAAK1|${p.uid}|$issuedAt|$nonce|$it", 640) }
        }
        Sheet {
            Heading("मेरा कोड", "My code")
            Body(pick("पार्सल देने वाले से इसे स्कैन करवाएँ। हर 30 सेकंड में नया बनता है और एक ही बार चलता है।", "Let the person handing over scan this. It renews every 30 seconds and works once."), Tokens.muted, 15)
            if (image == null) Body(pick("इस फ़ोन की चाबी नहीं मिली।", "This phone's key is not available."), Tokens.red, 15)
            else androidx.compose.foundation.Image(image, contentDescription = pick("मेरा कोड", "My code"), modifier = Modifier.fillMaxWidth().aspectRatio(1f))
            TextKey(pick("छिपाएँ", "Hide")) { showCode = false }
        }
    }

    /** A QR code as an image, drawn with ZXing. */
    private fun qr(text: String, size: Int): androidx.compose.ui.graphics.ImageBitmap {
        val m = com.google.zxing.qrcode.QRCodeWriter().encode(text, com.google.zxing.BarcodeFormat.QR_CODE, size, size, mapOf(com.google.zxing.EncodeHintType.MARGIN to 1))
        val px = IntArray(size * size) { i -> if (m.get(i % size, i / size)) 0xFF1F2A44.toInt() else 0xFFFFFDF8.toInt() }
        return Bitmap.createBitmap(px, size, size, Bitmap.Config.ARGB_8888).asImageBitmap()
    }

    @Composable
    private fun ResultScreen(s: Screen.Result) {
        val v = s.verdict
        when {
            s.offline -> Verdict(Tokens.amber, "फ़ोन में सेव", "Saved on the phone", "No signal. It sends by itself when the signal is back; the payment waits until it is checked.")
            v.verdict == "green" -> Verdict(Tokens.green, "सौंप दिया", "Handed over", "Checked: right parcel, right stop, still sealed.${s.place?.let { " $it." } ?: ""}${if (v.message.contains("% payment abhi")) " Your pay for this stretch is on its way now; the rest comes when the parcel is delivered." else ""}")
            v.verdict == "held" -> Verdict(Tokens.red, "भुगतान रोका गया", "Payment held", if (Lang.hindi && v.reasonHi != null) v.reasonHi else v.message.substringAfter(". ").ifBlank { v.message })
            else -> Verdict(Tokens.amber, "दर्ज हुआ, जाँच बाकी", "Recorded, waiting for the check", "The AI check could not run just now. The handoff is recorded and the payment waits; it is checked again automatically.")
        }
        v.code?.let { Body("$it${v.hop?.let { h -> " · handoff $h" } ?: ""}", Tokens.muted, 15) }
        v.code?.let { code -> Secondary("मैप पर देखें · See it on the map") { openMap(code) } }
        Action("अगला पार्सल", "Next parcel") { screen = Screen.Handoff() }
    }

    @Composable
    private fun PackScreen(s: Screen.Pack) {
        val plan = s.plan
        Bi("पार्सल बुक करें", "Book a parcel", size = 24)
        Step(1, "नया पार्सल लगाइए", "Tap the new parcel", when { s.parcel != null -> "Parcel ${s.parcel.uid.takeLast(8)}"; else -> null }, s.parcel == null && s.problem == null)
        if (s.dailyCode != null && s.booking == null) {
            Sheet {
                Body("रोज़ का पार्सल · Today's daily order", Tokens.green, 16, FontWeight.SemiBold)
                Bi("${s.dailyTo} के लिए आज की बुकिंग हो चुकी है", "Daak booked and paid today's parcel to ${s.dailyTo} at 4 am (${s.dailyCode}). Attach this parcel to it.", size = 18)
            }
            if (s.paying) Waiting("Attaching")
            else Action("इसे जोड़ें", "Use this parcel for today's order") { attachDaily(s) }
            Body("या नया पार्सल बुक करें · Or book a different parcel below", Tokens.muted, 15)
        }
        if (s.receivers != null && s.booking == null) {
            Heading("किसे भेजना है?", "Send to")
            s.receivers.forEach { r -> Choice(r.name, r.stopName, s.receiver?.uid == r.uid) { if (!s.loading && !s.paying) chooseReceiver(s, r) } }
        }
        if (s.loading) Waiting(pick("रास्ता और ड्राइवर ढूँढ रहे हैं", "Working out the route and the best drivers"))
        if (plan != null && s.booking == null) {
            Sheet {
                Heading("रास्ता", "Route")
                Body("${plan.from.substringBefore(",")} › ${plan.to}", size = 19, weight = FontWeight.SemiBold)
                Body("Pickup at ${plan.from}", Tokens.muted, 15)
            }
            plan.stretches.forEachIndexed { i, st ->
                val d = st.drivers[s.picks[i]]
                Choice("${st.from.substringBefore(",")} › ${st.to.substringBefore(",")} · ${st.km} km", "${d.name}${if (d.vehicle.isNotBlank()) " · ${d.vehicle}" else ""} · ${d.proven} proven · ${d.cleanPercent}% clean${d.departsAt?.let { " · bus ${clock(it)}${d.arrivesAt?.let { a -> " to ${clock(a)}" } ?: ""}" } ?: " · no bus time yet"}${if (st.drivers.size > 1) "  ·  tap to change" else ""}", true) {
                    if (st.drivers.size > 1 && !s.paying) screen = s.copy(picks = s.picks.toMutableList().also { it[i] = (it[i] + 1) % st.drivers.size })
                }
            }
            // The shop measures; the price follows as it types, on the larger of the weight and the volume weight.
            val charged = s.measured()?.let { charge(plan, it) }
            val fee = charged?.getOrNull()?.fee ?: plan.fee
            if (plan.bands.isNotEmpty()) {
                Heading("वज़न और नाप", "Weight and size")
                Field(pick("वज़न (kg)", "Weight (kg)"), s.kg, { if (!s.paying) screen = s.copy(kg = it.filter { c -> c.isDigit() || c == '.' }) }, "3.5", number = true)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(Triple(pick("लंबाई cm", "Length cm"), s.lengthCm) { v: String -> s.copy(lengthCm = v) },
                        Triple(pick("चौड़ाई cm", "Width cm"), s.widthCm) { v: String -> s.copy(widthCm = v) },
                        Triple(pick("ऊँचाई cm", "Height cm"), s.heightCm) { v: String -> s.copy(heightCm = v) }).forEach { (label, value, set) ->
                        Box(Modifier.weight(1f)) { Field(label, value, { if (!s.paying) screen = set(it.filter { c -> c.isDigit() || c == '.' }) }, "30", number = true) }
                    }
                }
                charged?.onSuccess { c ->
                    Sheet {
                        Line(pick("इतने का किराया", "Charged as"), "${"%.1f".format(c.chargeableKg)} kg", Tokens.ink, big = true)
                        Body(pick("नाप से वज़न ${"%.1f".format(c.volumeKg)} kg (L × W × H ÷ ${plan.volumeDivisor.toInt()})। मीटर ×${c.factor}, ड्राइवरों का किराया भी उतना।", "Volume weight ${"%.1f".format(c.volumeKg)} kg (L × W × H ÷ ${plan.volumeDivisor.toInt()}). Meter ×${c.factor}: the drivers' pay too."), Tokens.muted, 14)
                    }
                }?.onFailure { e -> if (s.kg.isNotBlank() && s.lengthCm.isNotBlank() && s.widthCm.isNotBlank() && s.heightCm.isNotBlank()) Body(e.message ?: "", Tokens.red, 15) }
            }
            Sheet {
                plan.stretches.lastOrNull()?.drivers?.getOrNull(s.picks.lastOrNull() ?: 0)?.arrivesAt?.let { Line("पहुँचेगा · Arrives", clock(it), Tokens.green) }
                Line("Daak meter", "${plan.km} km")
                Body(plan.meter, Tokens.muted, 14)
                Line("किराया · Fee", "₹${"%.2f".format(fee)}", big = true)
                shopBal?.let { Line("बैलेंस · Your balance", "₹${"%.2f".format(it.rupees)}", if (it.rupees >= fee) Tokens.green else Tokens.red) }
            }
            val short = shopBal?.let { fee - it.rupees } ?: 0.0
            if (short > 0 && !s.paying) {
                Verdict(Tokens.amber, "बैलेंस कम है", "Balance too low", "Top up at least ₹${kotlin.math.ceil(short).toInt()} by UPI. It shows here once Daak sees the payment.")
                Action("UPI से ₹${maxOf(500, kotlin.math.ceil(short).toInt())} जोड़ें", "Top up ₹${maxOf(500, kotlin.math.ceil(short).toInt())} by UPI") { payByUpi(maxOf(500, kotlin.math.ceil(short).toInt())) }
            }
            if (s.paying) Waiting(pick("बुकिंग और भुगतान", "Booking and paying"), pick("आम तौर पर 15 से 20 सेकंड", "Usually 15 to 20 seconds"))
            else if (plan.bands.isNotEmpty() && charged?.isSuccess != true) Body(pick("बुक करने के लिए वज़न और नाप लिखें।", "Enter the weight and size to book."), Tokens.muted, 16)
            else if (short <= 0) Action("₹${"%.2f".format(fee)} में बुक करें", "Book and pay ₹${"%.2f".format(fee)} from your balance") { pay(s) }
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
            Secondary("मैप पर देखें · See the route on the map") { openMap(b.code) }
            if (s.receiver != null && s.drivers.isNotEmpty()) {
                if (s.dailySaved) Body("रोज़ जाएगा · Repeats Monday to Saturday. Daak books and pays it at 4 am; you only tap that day's parcel.", Tokens.green, 16, FontWeight.SemiBold)
                else Secondary("हर दिन भेजें · Send this every day (Mon to Sat)", busy = s.dailyBusy) { makeDaily(s) }
            }
        }
        s.problem?.let { Verdict(Tokens.amber, "ध्यान दें", "Please note", it) }
        if (s.written || (s.problem != null && s.booking != null)) Action("अगला पार्सल", "Book another parcel") { nfc.pendingWrite = null; screen = Screen.Pack() }
    }

    @Composable
    private fun LookScreen(s: Screen.Look) {
        val info = s.info
        when {
            s.parcel == null -> Sheet { Bi("पार्सल फ़ोन के पीछे लगाइए", "Tap a parcel to see where it is", size = 22) }
            s.loading -> Waiting(pick("पढ़ रहे हैं", "Reading the parcel"))
            info == null -> Verdict(Tokens.amber, "इंटरनेट नहीं", "No internet", "Try again when there is signal.")
            !info.registered -> Verdict(Tokens.amber, "बुक नहीं है", "Not booked", "This parcel has no Daak booking.")
            info.delivered -> Verdict(Tokens.green, "पहुँच गया", "Delivered", "${info.code} · ${info.label}")
            else -> Verdict(Tokens.ink, "रास्ते में", "On the way", "${info.code} · next: ${info.next?.fromName} to ${info.next?.toName} at ${info.next?.place}")
        }
        info?.code?.let { code -> Secondary("मैप पर देखें · See it on the map") { openMap(code) } }
        if (s.parcel == null) MyParcels("Parcels coming to you show here once a shop books one.")
    }

    /** A parcel's state in the chosen language; the server words it in English. */
    private fun statusText(key: String, english: String, handed: Int, stops: Int) = if (!Lang.hindi) english else when (key) {
        "paid" -> "पहुँच गया, ड्राइवरों को पूरा भुगतान"
        "releasing" -> "पहुँच गया, बाकी भुगतान जल्द"
        "refunded" -> "दावा निपटा, दुकान को पैसे वापस"
        "held" -> "भुगतान रुका है"
        "review" -> "पहुँच गया, जाँच बाकी"
        else -> "रास्ते में, $stops में से $handed पड़ाव"
    }

    private fun statusColor(key: String) = when (key) { "paid", "releasing" -> Tokens.green; "held", "refunded" -> Tokens.red; "review" -> Tokens.amber; else -> Tokens.ink }

    /** Every parcel this person sends, carries or receives, newest first; more load at the end of the list. */
    @Composable
    private fun MyParcels(empty: String) {
        val l = mine
        Heading("मेरे पार्सल", "My parcels")
        androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(Triple("transit", "चल रहे", "Active"), Triple("paid", "पहुँचे", "Delivered"), Triple("all", "सब", "All")).forEach { (id, hi, en) ->
                val n = l?.counts?.get(id)
                SmallKey(pick(hi, en) + (n?.let { " $it" } ?: ""), Modifier.weight(1f), filled = mineFilter == id) {
                    if (mineFilter != id) { mineFilter = id; mine = null; loadMine(reset = true) }
                }
            }
        }
        when {
            l == null -> if (mineBusy) Waiting("Loading your parcels") else Body("Could not load your parcels.", Tokens.muted, 15)
            l.rows.isEmpty() -> Body(empty, Tokens.muted, 15)
            else -> {
                l.rows.forEach { r ->
                    ParcelItem(r.code, "₹${"%.2f".format(r.fee)}", statusText(r.statusKey, r.status, r.handed, r.stops), statusColor(r.statusKey),
                        "${r.label.removePrefix("Parcel from ")} · ${dayTime(r.createdAt)}") { openParcel(r.code) }
                }
                if (l.page < l.pages) Secondary("और दिखाएँ · Show more (${l.total - l.rows.size} left)", busy = mineBusy) { loadMine() }
            }
        }
    }

    /** One parcel: where it is, each stop's check, and what each driver was paid. */
    @Composable
    private fun ParcelScreen(s: Screen.Parcel) {
        androidx.compose.foundation.layout.Row { SmallKey("‹ वापस · Back", filled = false) { screen = s.from } }
        val d = s.detail
        when {
            s.problem != null -> Verdict(Tokens.amber, "नहीं खुला", "Could not open", s.problem)
            d == null -> Waiting(pick("पढ़ रहे हैं", "Reading ${s.code}"))
            else -> {
                Sheet {
                    Body(d.code, Tokens.ink, 30, FontWeight.Bold)
                    Body(d.label.removePrefix("Parcel from "), Tokens.muted, 15)
                    Body(statusText(d.statusKey, d.status, d.stops.count { it.verdict != null }, d.stops.size), statusColor(d.statusKey), 18, FontWeight.SemiBold)
                    Line("Fee", "₹${"%.2f".format(d.fee)}")
                    Line("Distance", "${d.km} km · ${d.weight}")
                    Line("Booked", dayTime(d.createdAt))
                }
                Heading("पड़ाव", "Stops")
                d.stops.forEach { st ->
                    Sheet {
                        Body("${st.hop}. ${st.place}", Tokens.ink, 17, FontWeight.SemiBold)
                        if (st.km > 0) Body("${st.km} km on this stretch", Tokens.muted, 14)
                        when (st.verdict) {
                            "green" -> Body("Checked and handed over, ${dayTime(st.at!!)}", Tokens.green, 16, FontWeight.Medium)
                            "held" -> Body("Payment held, ${dayTime(st.at!!)}", Tokens.red, 16, FontWeight.Medium)
                            "unchecked" -> Body("Handed over, waiting for the check, ${dayTime(st.at!!)}", Tokens.amber, 16, FontWeight.Medium)
                            null -> Body(st.etaAt?.let { "Expected ${clock(it)}" + (st.departsAt?.let { b -> ", bus leaves ${clock(b)}" } ?: "") } ?: "Not handed over yet", Tokens.muted, 16)
                            else -> Body(st.verdict, Tokens.muted, 16)
                        }
                        st.reason?.let { Body(it, Tokens.muted, 14) }
                        if (st.paid > 0) Body("Paid ₹${"%.2f".format(st.paid)} at the handover${st.pct?.let { " ($it%)" } ?: ""}, ₹${"%.2f".format(st.held ?: 0.0)} held until delivery", Tokens.ink, 15)
                    }
                }
                d.holdback?.let { Sheet { Body(it, Tokens.ink, 15) } }
                Secondary("मैप पर देखें · See it on the map") { openMap(d.code) }
            }
        }
    }
}

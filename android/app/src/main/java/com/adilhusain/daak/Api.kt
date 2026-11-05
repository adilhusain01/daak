package com.adilhusain.daak

import android.content.Context
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/** The server's answer to one handoff. verdict is "green", "held" or "unchecked". */
data class Verdict(val verdict: String, val message: String, val code: String?, val hop: Int?)

data class Handoff(val parcel: String, val from: String, val to: String, val photo: File, val at: Long = System.currentTimeMillis(), val spot: Spot? = null, val signer: String? = null, val sig: String? = null)

/** What a driver sees about their own work, read from the server (which reads the public Hedera log). */
data class Work(
    val name: String?, val proven: Int, val km: Int, val earned: Double, val bachat: Double,
    val cleanPercent: Int, val advance: Int, val advanceReason: String, val savePercent: Int,
    /** Share of each leg's pay at the handover (50, 70 or 90), and what lifts it. */
    val atHandover: Int = 50, val nextTier: String? = null,
)

data class Me(val known: Boolean, val name: String?, val role: String?, val vehicle: String?)
data class Next(val hop: Int, val place: String, val km: Int?, val fromHash: String, val toHash: String, val toName: String, val toRole: String, val fromName: String, val fromRole: String)
data class StopOpt(val id: String, val name: String)
data class LegOpt(val id: String, val label: String, val km: Int)
data class Network(val stops: List<StopOpt>, val legs: List<LegOpt>)
data class Receiver(val uid: String, val name: String, val stopName: String)
data class DriverOpt(val uid: String, val name: String, val vehicle: String, val proven: Int, val km: Int, val cleanPercent: Int)
data class Stretch(val id: String, val from: String, val to: String, val km: Int, val drivers: List<DriverOpt>)
data class Plan(val from: String, val to: String, val km: Int, val fee: Double, val meter: String, val stretches: List<Stretch>, val bands: List<Band> = emptyList())
/** A weight band and what the whole booking costs in it. */
data class Band(val id: String, val label: String, val fee: Double)
data class Todo(val code: String, val text: String, val action: String)
data class ParcelInfo(val registered: Boolean, val code: String?, val label: String?, val delivered: Boolean, val next: Next?)
data class RoutePlan(val label: String, val from: String, val to: String, val stops: List<Pair<String, Int>>, val km: Int, val fee: Double, val meter: String)

/** First 12 hex characters of SHA-256, the same short id the server and the public log use for a badge. */
fun badgeHash(uid: String): String =
    java.security.MessageDigest.getInstance("SHA-256").digest(uid.toByteArray()).joinToString("") { "%02x".format(it) }.take(12)

data class Booking(val code: String, val trackUrl: String, val shares: List<Double>)
/** A shop's standing order, and today's booking of one that waits for its parcel. */
data class Daily(val id: String, val receiver: String, val daysText: String, val active: Boolean, val lastRun: String?, val lastCode: String?)
/** A shop's prepaid rupees, held by its agent on Hedera, and where to send a UPI top-up. */
data class ShopBal(val rupees: Double, val upiId: String?)
data class DailyList(val orders: List<Daily>, val waitingCode: String?, val waitingReceiver: String?)

object Api {
    val base: String = BuildConfig.API_BASE

    private fun enc(s: String) = java.net.URLEncoder.encode(s, "UTF-8")

    private fun get(path: String): Pair<Int, JSONObject> {
        val conn = URL("$base$path").openConnection() as HttpURLConnection
        conn.setRequestProperty("x-daak-app", BuildConfig.APP_KEY)
        conn.connectTimeout = 8000
        conn.readTimeout = 30000
        val code = conn.responseCode
        val text = (if (code in 200..299) conn.inputStream else conn.errorStream).bufferedReader().readText()
        return code to JSONObject(text)
    }

    fun me(uid: String): Me {
        val (code, j) = get("/api/me/${enc(uid)}")
        if (code == 404) return Me(false, null, null, null)
        if (code !in 200..299) error("server $code")
        return Me(true, j.optString("name"), j.optString("role"), j.optString("vehicle"))
    }

    fun parcel(uid: String): ParcelInfo {
        val (code, j) = get("/api/parcel/${enc(uid)}")
        if (code == 404) return ParcelInfo(false, null, null, false, null)
        if (code !in 200..299) error("server $code")
        val n = j.optJSONObject("next")
        return ParcelInfo(
            true, j.optString("code"), j.optString("label"), j.optBoolean("delivered"),
            n?.let { Next(it.getInt("hop"), it.getString("place"), if (it.isNull("km")) null else it.getInt("km"), it.getString("fromHash"), it.getString("toHash"), it.getString("toName"), it.getString("toRole"), it.optString("fromName", "the giver"), it.optString("fromRole", "driver")) },
        )
    }

    private fun post(path: String, body: JSONObject, readMs: Int = 30000): Pair<Int, JSONObject> {
        val conn = URL("$base$path").openConnection() as HttpURLConnection
        conn.setRequestProperty("x-daak-app", BuildConfig.APP_KEY)
        conn.requestMethod = "POST"
        conn.connectTimeout = 8000
        conn.readTimeout = readMs
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.outputStream.use { it.write(body.toString().toByteArray()) }
        val code = conn.responseCode
        val text = (if (code in 200..299) conn.inputStream else conn.errorStream).bufferedReader().readText()
        return code to JSONObject(text)
    }

    fun network(): Network {
        val (_, j) = get("/api/network")
        val s = j.getJSONArray("stops"); val l = j.getJSONArray("legs")
        val names = List(s.length()) { s.getJSONObject(it).let { o -> o.getString("id") to o.getString("name") } }.toMap()
        return Network(
            List(s.length()) { s.getJSONObject(it).let { o -> StopOpt(o.getString("id"), o.getString("name")) } },
            List(l.length()) { l.getJSONObject(it).let { o -> LegOpt(o.getString("id"), "${names[o.getString("from")]?.substringBefore(",")} › ${names[o.getString("to")]?.substringBefore(",")}", o.getInt("km")) } },
        )
    }

    /** Returns null on success, or the list of problems to show next to the form. */
    fun join(
        uid: String, role: String, name: String, phone: String, upi: String, vehicle: String, legs: List<String>, stop: String?,
        busOperator: String? = null, idType: String? = null, idLast4: String = "", idPhoto: java.io.File? = null,
    ): List<String>? {
        val body = JSONObject().put("uid", uid).put("role", role).put("name", name).put("phone", phone).put("upi", upi).put("vehicle", vehicle)
            .put("legs", org.json.JSONArray(legs)).apply {
                if (stop != null) put("stop", stop)
                if (busOperator != null) put("busOperator", busOperator)
                if (idType != null) put("idType", idType)
                if (idLast4.isNotEmpty()) put("idLast4", idLast4)
                if (idPhoto != null) put("idPhoto", android.util.Base64.encodeToString(idPhoto.readBytes(), android.util.Base64.NO_WRAP))
            }
        val (code, j) = post("/api/join", body, 60000)
        if (code in 200..299) return null
        val e = j.optJSONArray("errors") ?: return listOf("Server ${code}")
        return List(e.length()) { e.getString(it) }
    }

    /** A driver answers a job offer; the answer goes on the public log. */
    fun job(code: String, uid: String, accept: Boolean) {
        val (c, j) = post("/api/job", JSONObject().put("code", code).put("uid", uid).put("decision", if (accept) "accept" else "decline"))
        if (c !in 200..299) error(j.optString("error", "server $c"))
    }

    fun shopBalance(sender: String): ShopBal {
        val (code, j) = get("/api/shop/${enc(sender)}")
        if (code !in 200..299) error(j.optString("error", "server $code"))
        return ShopBal(j.getDouble("rupees"), if (j.isNull("upiId")) null else j.getString("upiId"))
    }

    fun daily(sender: String): DailyList {
        val (code, j) = get("/api/standing?sender=${enc(sender)}")
        if (code !in 200..299) error(j.optString("error", "server $code"))
        val a = j.getJSONArray("orders")
        val w = j.optJSONObject("waiting")
        return DailyList(
            List(a.length()) { a.getJSONObject(it).let { o ->
                Daily(o.getString("id"), o.getString("receiver"), o.getString("daysText"), o.getBoolean("active"),
                    if (o.isNull("lastRun")) null else o.getString("lastRun"), if (o.isNull("lastCode")) null else o.getString("lastCode"))
            } },
            w?.getString("code"), w?.getString("receiver"),
        )
    }

    /** Makes a booking repeat Monday to Saturday; Daak's agent books and pays it each morning. */
    fun makeDaily(sender: String, receiver: String, drivers: List<String>, weight: String = "s") {
        val (code, j) = post("/api/standing", JSONObject().put("sender", sender).put("receiver", receiver).put("drivers", org.json.JSONArray(drivers)).put("days", "1111110").put("weight", weight), 60000)
        if (code !in 200..299) error(j.optString("error", "server $code"))
    }

    /** Attaches the tapped parcel to today's daily booking; returns its code. */
    fun attachDaily(sender: String, parcel: String): String {
        val (code, j) = post("/api/standing/attach", JSONObject().put("sender", sender).put("parcel", parcel), 60000)
        if (code !in 200..299) error(j.optString("error", "server $code"))
        return j.getString("code")
    }


    fun registerDevice(uid: String, devicePub: String) {
        post("/api/device", JSONObject().put("uid", uid).put("devicePub", devicePub))
    }

    fun receivers(): List<Receiver> {
        val (_, j) = get("/api/receivers")
        val a = j.getJSONArray("receivers")
        return List(a.length()) { a.getJSONObject(it).let { o -> Receiver(o.getString("uid"), o.getString("name"), o.getString("stopName")) } }
    }

    fun plan(sender: String, receiver: String): Plan {
        val (code, j) = post("/api/plan", JSONObject().put("sender", sender).put("receiver", receiver), 60000)
        if (code !in 200..299) error(j.optString("error", "server $code"))
        val st = j.getJSONArray("stretches")
        return Plan(j.getString("from"), j.getString("to"), j.getInt("km"), j.getDouble("feeRupees"), j.getString("meter"),
            List(st.length()) { i -> st.getJSONObject(i).let { o ->
                val d = o.getJSONArray("drivers")
                Stretch(o.getString("id"), o.getString("from"), o.getString("to"), o.getInt("km"),
                    List(d.length()) { k -> d.getJSONObject(k).let { x -> DriverOpt(x.getString("uid"), x.getString("name"), x.optString("vehicle"), x.getInt("proven"), x.getInt("km"), (x.getDouble("cleanRate") * 100).toInt()) } })
            } },
            j.optJSONArray("bands")?.let { b -> List(b.length()) { b.getJSONObject(it).let { o -> Band(o.getString("id"), o.getString("label"), o.getDouble("feeRupees")) } } } ?: emptyList())
    }

    fun todo(uid: String): List<Todo> {
        val (_, j) = get("/api/driver/${enc(uid)}/parcels")
        val a = j.getJSONArray("parcels")
        return List(a.length()) { a.getJSONObject(it).let { o -> Todo(o.getString("code"), o.getString("text"), o.getString("action")) } }
    }

    fun route(): RoutePlan {
        val (_, j) = get("/api/routes")
        val r = j.getJSONArray("routes").getJSONObject(0)
        val stops = r.getJSONArray("stops")
        return RoutePlan(
            r.getString("label"), r.getString("from"), r.getString("to"),
            List(stops.length()) { stops.getJSONObject(it).let { s -> s.getString("place") to s.getInt("km") } },
            r.getInt("km"), r.getDouble("feeRupees"), r.getString("meter"),
        )
    }

    fun work(uid: String): Work {
        val conn = URL("$base/api/driver/${enc(uid)}").openConnection() as HttpURLConnection
        conn.setRequestProperty("x-daak-app", BuildConfig.APP_KEY)
        conn.connectTimeout = 8000
        conn.readTimeout = 30000
        val j = JSONObject(conn.inputStream.bufferedReader().readText())
        val adv = j.getJSONObject("advance")
        return Work(
            j.optString("name").ifEmpty { null }, j.getInt("proven"), j.getInt("km"), j.getDouble("earnedRupees"),
            j.getDouble("bachatRupees"), (j.getDouble("cleanRate") * 100).toInt(), adv.getInt("eligibleRupees"),
            adv.getString("reason"), j.getInt("savePercent"),
            j.optJSONObject("tier")?.optInt("advancePct", 50) ?: 50,
            j.optJSONObject("tier")?.let { if (it.isNull("next")) null else it.optString("next") },
        )
    }

    fun setSave(uid: String, percent: Int) {
        val conn = URL("$base/api/driver/${enc(uid)}").openConnection() as HttpURLConnection
        conn.setRequestProperty("x-daak-app", BuildConfig.APP_KEY)
        conn.requestMethod = "POST"
        conn.connectTimeout = 8000
        conn.readTimeout = 30000
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.outputStream.use { it.write(JSONObject().put("savePercent", percent).toString().toByteArray()) }
        if (conn.responseCode !in 200..299) error("server ${conn.responseCode}")
    }

    /** The shop's agent books and pays for this parcel's delivery; returns the link to write on its tag. */
    fun pack(parcel: String, sender: String? = null, receiver: String? = null, drivers: List<String> = emptyList(), weight: String = "s"): Booking {
        val conn = URL("$base/api/pack").openConnection() as HttpURLConnection
        conn.setRequestProperty("x-daak-app", BuildConfig.APP_KEY)
        conn.requestMethod = "POST"
        conn.connectTimeout = 8000
        conn.readTimeout = 90000
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        val body = JSONObject().put("parcel", parcel).put("weight", weight)
        if (sender != null && receiver != null && drivers.isNotEmpty()) body.put("sender", sender).put("receiver", receiver).put("drivers", org.json.JSONArray(drivers))
        conn.outputStream.use { it.write(body.toString().toByteArray()) }
        val text = (if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream).bufferedReader().readText()
        val j = JSONObject(text)
        if (conn.responseCode !in 200..299) error(j.optString("error", "server ${conn.responseCode}"))
        val shares = j.getJSONArray("shares")
        return Booking(j.getString("code"), j.getString("trackUrl"), List(shares.length()) { shares.getJSONObject(it).getDouble("rupees") })
    }

    /** Sends one handoff with its photo. Throws on any network failure so the caller can queue it. */
    fun handoff(h: Handoff): Verdict {
        val boundary = "daak" + UUID.randomUUID().toString().replace("-", "")
        val body = ByteArrayOutputStream().apply {
            fun field(name: String, value: String) {
                write("--$boundary\r\nContent-Disposition: form-data; name=\"$name\"\r\n\r\n$value\r\n".toByteArray())
            }
            field("parcel", h.parcel)
            field("from", h.from)
            field("to", h.to)
            field("at", h.at.toString())
            h.spot?.let { field("lat", it.lat.toString()); field("lng", it.lng.toString()); field("acc", it.accuracyM.toString()) }
            if (h.signer != null && h.sig != null) { field("signer", h.signer); field("sig", h.sig) }
            write("--$boundary\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"lid.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".toByteArray())
            write(h.photo.readBytes())
            write("\r\n--$boundary--\r\n".toByteArray())
        }.toByteArray()

        val conn = URL("$base/api/handoff").openConnection() as HttpURLConnection

        conn.setRequestProperty("x-daak-app", BuildConfig.APP_KEY)
        conn.requestMethod = "POST"
        conn.connectTimeout = 8000
        conn.readTimeout = 60000
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")
        conn.outputStream.use { it.write(body) }
        val text = (if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream).bufferedReader().readText()
        if (conn.responseCode !in 200..299) error("server ${conn.responseCode}: $text")
        val j = JSONObject(text)
        return Verdict(
            j.optString("verdict", "unchecked"),
            j.optString("message", ""),
            j.optString("code").ifEmpty { null },
            if (j.has("hop")) j.getInt("hop") else null,
        )
    }
}

/** Handoffs that could not be sent yet (no signal on the highway). Saved to disk, sent later. */
class Outbox(context: Context) {
    private val dir = File(context.filesDir, "outbox").apply { mkdirs() }

    fun add(h: Handoff) {
        val id = h.at.toString()
        h.photo.copyTo(File(dir, "$id.jpg"), overwrite = true)
        File(dir, "$id.json").writeText(
            JSONObject().put("parcel", h.parcel).put("from", h.from).put("to", h.to).put("at", h.at)
                .apply { h.spot?.let { put("lat", it.lat).put("lng", it.lng).put("acc", it.accuracyM.toDouble()) }; h.signer?.let { put("signer", it) }; h.sig?.let { put("sig", it) } }.toString(),
        )
    }

    fun size() = dir.listFiles { f -> f.extension == "json" }?.size ?: 0

    /** Tries every queued handoff once, oldest first; keeps the ones that still fail. */
    fun flush(): Int {
        var sent = 0
        dir.listFiles { f -> f.extension == "json" }?.sortedBy { it.name }?.forEach { meta ->
            val j = JSONObject(meta.readText())
            val photo = File(dir, meta.nameWithoutExtension + ".jpg")
            runCatching {
                val spot = if (j.has("lat")) Spot(j.getDouble("lat"), j.getDouble("lng"), j.getDouble("acc").toFloat()) else null
                Api.handoff(Handoff(j.getString("parcel"), j.getString("from"), j.getString("to"), photo, j.getLong("at"), spot, j.optString("signer").ifEmpty { null }, j.optString("sig").ifEmpty { null }))
                meta.delete(); photo.delete(); sent++
            }
        }
        return sent
    }
}

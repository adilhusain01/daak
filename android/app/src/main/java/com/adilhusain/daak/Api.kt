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

data class Handoff(val parcel: String, val from: String, val to: String, val photo: File, val at: Long = System.currentTimeMillis(), val spot: Spot? = null)

/** What a driver sees about their own work, read from the server (which reads the public Hedera log). */
data class Work(
    val name: String?, val proven: Int, val km: Int, val earned: Double, val bachat: Double,
    val cleanPercent: Int, val advance: Int, val advanceReason: String, val savePercent: Int,
)

data class Me(val known: Boolean, val name: String?, val role: String?, val vehicle: String?)
data class Next(val hop: Int, val place: String, val km: Int?, val fromHash: String, val toHash: String, val toName: String, val toRole: String)
data class ParcelInfo(val registered: Boolean, val code: String?, val label: String?, val delivered: Boolean, val next: Next?)
data class RoutePlan(val label: String, val from: String, val to: String, val stops: List<Pair<String, Int>>, val km: Int, val fee: Double, val meter: String)

/** First 12 hex characters of SHA-256, the same short id the server and the public log use for a badge. */
fun badgeHash(uid: String): String =
    java.security.MessageDigest.getInstance("SHA-256").digest(uid.toByteArray()).joinToString("") { "%02x".format(it) }.take(12)

data class Booking(val code: String, val trackUrl: String, val shares: List<Double>)

object Api {
    private val base = BuildConfig.API_BASE

    private fun enc(s: String) = java.net.URLEncoder.encode(s, "UTF-8")

    private fun get(path: String): Pair<Int, JSONObject> {
        val conn = URL("$base$path").openConnection() as HttpURLConnection
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
            n?.let { Next(it.getInt("hop"), it.getString("place"), if (it.isNull("km")) null else it.getInt("km"), it.getString("fromHash"), it.getString("toHash"), it.getString("toName"), it.getString("toRole")) },
        )
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
        conn.connectTimeout = 8000
        conn.readTimeout = 30000
        val j = JSONObject(conn.inputStream.bufferedReader().readText())
        val adv = j.getJSONObject("advance")
        return Work(
            j.optString("name").ifEmpty { null }, j.getInt("proven"), j.getInt("km"), j.getDouble("earnedRupees"),
            j.getDouble("bachatRupees"), (j.getDouble("cleanRate") * 100).toInt(), adv.getInt("eligibleRupees"),
            adv.getString("reason"), j.getInt("savePercent"),
        )
    }

    fun setSave(uid: String, percent: Int) {
        val conn = URL("$base/api/driver/${enc(uid)}").openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.connectTimeout = 8000
        conn.readTimeout = 30000
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.outputStream.use { it.write(JSONObject().put("savePercent", percent).toString().toByteArray()) }
        if (conn.responseCode !in 200..299) error("server ${conn.responseCode}")
    }

    /** The shop's agent books and pays for this parcel's delivery; returns the link to write on its tag. */
    fun pack(parcel: String): Booking {
        val conn = URL("$base/api/pack").openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.connectTimeout = 8000
        conn.readTimeout = 90000
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.outputStream.use { it.write(JSONObject().put("parcel", parcel).toString().toByteArray()) }
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
            write("--$boundary\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"lid.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".toByteArray())
            write(h.photo.readBytes())
            write("\r\n--$boundary--\r\n".toByteArray())
        }.toByteArray()

        val conn = URL("$base/api/handoff").openConnection() as HttpURLConnection
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
                .apply { h.spot?.let { put("lat", it.lat).put("lng", it.lng).put("acc", it.accuracyM.toDouble()) } }.toString(),
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
                Api.handoff(Handoff(j.getString("parcel"), j.getString("from"), j.getString("to"), photo, j.getLong("at"), spot))
                meta.delete(); photo.delete(); sent++
            }
        }
        return sent
    }
}

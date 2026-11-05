package com.adilhusain.daak

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationManager
import android.os.Build
import java.util.concurrent.Executors

/** Where a handoff happens, from Android's own location service. Null when location is off or denied. */
data class Spot(val lat: Double, val lng: Double, val accuracyM: Float)

class Where(context: Context) {
    private val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    @Volatile var last: Spot? = null
        private set

    /** Asks for a fresh fix; keeps the best recent one as a fallback. */
    @SuppressLint("MissingPermission")
    fun refresh() {
        val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER).filter { runCatching { lm.isProviderEnabled(it) }.getOrDefault(false) }
        providers.mapNotNull { runCatching { lm.getLastKnownLocation(it) }.getOrNull() }
            .minByOrNull { it.accuracy }?.let { keep(it) }
        if (Build.VERSION.SDK_INT >= 30) {
            providers.forEach { p -> runCatching { lm.getCurrentLocation(p, null, Executors.newSingleThreadExecutor()) { it?.let(::keep) } } }
        }
    }

    private fun keep(l: Location) {
        val cur = last
        if (cur == null || l.accuracy <= cur.accuracyM + 20) last = Spot(l.latitude, l.longitude, l.accuracy)
    }
}

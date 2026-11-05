package com.adilhusain.daak

import android.app.Activity
import android.nfc.NdefMessage
import android.nfc.NdefRecord
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.Ndef
import android.os.Bundle

/** One tap: the chip's serial number and the text or link written on it, if any. */
data class Tap(val uid: String, val text: String?, val writable: Boolean)

/**
 * Reads tags with Android's reader mode. A presence check every second keeps the link steady,
 * and the same tag resting on the phone is reported once until it leaves.
 */
class Nfc(private val activity: Activity, private val onTap: (Tap) -> Unit) : NfcAdapter.ReaderCallback {
    private val adapter: NfcAdapter? = NfcAdapter.getDefaultAdapter(activity)
    private var lastUid: String? = null
    private var lastAt = 0L

    /** Set before a tap to write this text onto the next tag instead of only reading it. */
    @Volatile var pendingWrite: String? = null

    val available get() = adapter != null
    val enabled get() = adapter?.isEnabled == true

    fun start() {
        val options = Bundle().apply { putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 1000) }
        adapter?.enableReaderMode(
            activity, this,
            NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NO_PLATFORM_SOUNDS,
            options,
        )
    }

    fun stop() {
        adapter?.disableReaderMode(activity)
    }

    override fun onTagDiscovered(tag: Tag) {
        val uid = tag.id.joinToString(":") { "%02x".format(it) }
        val now = System.currentTimeMillis()
        if (uid == lastUid && now - lastAt < 2500) return
        lastUid = uid
        lastAt = now

        val ndef = Ndef.get(tag)
        var text: String? = null
        var writable = false
        if (ndef != null) {
            runCatching {
                ndef.connect()
                writable = ndef.isWritable
                pendingWrite?.let { link ->
                    if (writable) {
                        ndef.writeNdefMessage(NdefMessage(NdefRecord.createUri(link)))
                        pendingWrite = null
                    }
                }
                text = ndef.ndefMessage?.records?.firstOrNull()?.let(::recordText)
            }
            runCatching { ndef.close() }
        }
        activity.runOnUiThread { onTap(Tap(uid, text, writable)) }
    }

    private fun recordText(r: NdefRecord): String? = when {
        r.toUri() != null -> r.toUri().toString()
        r.tnf == NdefRecord.TNF_WELL_KNOWN && r.type.contentEquals(NdefRecord.RTD_TEXT) -> {
            val p = r.payload
            val langLength = p[0].toInt() and 0x3F
            String(p, 1 + langLength, p.size - 1 - langLength)
        }
        else -> null
    }
}

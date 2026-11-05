package com.adilhusain.daak

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.Signature
import java.security.spec.ECGenParameterSpec

/**
 * The phone's own signing key (P-256) in Android's secure key store. It never leaves the phone: Daak's
 * server only ever sees the public half and the signatures, so it cannot sign a handoff in someone's name.
 */
object DeviceKey {
    private const val ALIAS = "daak-handoff-key"
    private val store: KeyStore get() = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    private fun ensure() {
        if (store.containsAlias(ALIAS)) return
        val gen = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
        gen.initialize(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .build(),
        )
        gen.generateKeyPair()
    }

    /** The public key as base64 SPKI, the form the server verifies with. */
    fun publicKey(): String {
        ensure()
        return Base64.encodeToString(store.getCertificate(ALIAS).publicKey.encoded, Base64.NO_WRAP)
    }

    fun sign(message: String): String {
        ensure()
        val key = store.getKey(ALIAS, null) as PrivateKey
        val s = Signature.getInstance("SHA256withECDSA").apply { initSign(key); update(message.toByteArray()) }
        return Base64.encodeToString(s.sign(), Base64.NO_WRAP)
    }

    fun sha256Hex(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
}

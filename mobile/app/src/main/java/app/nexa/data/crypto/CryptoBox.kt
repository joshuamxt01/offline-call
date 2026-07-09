package app.nexa.data.crypto

import android.util.Base64
import com.goterl.lazysodium.LazySodiumAndroid
import com.goterl.lazysodium.SodiumAndroid
import com.goterl.lazysodium.interfaces.Box
import java.security.SecureRandom
import javax.inject.Inject
import javax.inject.Singleton

/**
 * End-to-end message encryption using libsodium `crypto_box` (X25519 +
 * XSalsa20-Poly1305). Wire-compatible with the web client (base64 ciphertext +
 * nonce). The server only ever sees ciphertext.
 */
@Singleton
class CryptoBox @Inject constructor() {
    private val sodium = LazySodiumAndroid(SodiumAndroid())
    private val box: Box.Native = sodium
    private val secureRandom = SecureRandom()

    data class KeyPairB64(val publicKey: String, val privateKey: String)
    data class Sealed(val ciphertext: String, val nonce: String)

    fun generateKeyPair(): KeyPairB64 {
        val pub = ByteArray(Box.PUBLICKEYBYTES)
        val sec = ByteArray(Box.SECRETKEYBYTES)
        check(box.cryptoBoxKeypair(pub, sec)) { "keypair generation failed" }
        return KeyPairB64(b64(pub), b64(sec))
    }

    fun encrypt(recipientPubB64: String, myPrivB64: String, plaintext: String): Sealed {
        val msg = plaintext.toByteArray(Charsets.UTF_8)
        val nonce = ByteArray(Box.NONCEBYTES).also { secureRandom.nextBytes(it) }
        val cipher = ByteArray(Box.MACBYTES + msg.size)
        check(
            box.cryptoBoxEasy(cipher, msg, msg.size.toLong(), nonce, unb64(recipientPubB64), unb64(myPrivB64)),
        ) { "encryption failed" }
        return Sealed(b64(cipher), b64(nonce))
    }

    /** Decrypt. In a 1:1 chat the peer's public key decrypts both directions. */
    fun decrypt(peerPubB64: String, myPrivB64: String, ciphertextB64: String, nonceB64: String): String? {
        val cipher = unb64(ciphertextB64)
        if (cipher.size < Box.MACBYTES) return null
        val msg = ByteArray(cipher.size - Box.MACBYTES)
        val ok = box.cryptoBoxOpenEasy(
            msg, cipher, cipher.size.toLong(), unb64(nonceB64), unb64(peerPubB64), unb64(myPrivB64),
        )
        return if (ok) String(msg, Charsets.UTF_8) else null
    }

    private fun b64(bytes: ByteArray) = Base64.encodeToString(bytes, Base64.NO_WRAP)
    private fun unb64(s: String) = Base64.decode(s, Base64.NO_WRAP)
}

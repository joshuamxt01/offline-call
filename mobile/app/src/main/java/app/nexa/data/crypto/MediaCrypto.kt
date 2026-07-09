package app.nexa.data.crypto

import android.util.Base64
import com.goterl.lazysodium.LazySodiumAndroid
import com.goterl.lazysodium.SodiumAndroid
import com.goterl.lazysodium.interfaces.SecretBox
import java.security.SecureRandom
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Symmetric media encryption (libsodium secretbox). Each media blob gets a fresh
 * random key; the key + nonce travel inside the E2E-encrypted message. Wire-
 * compatible with the web client (base64). The server/B2 only see ciphertext.
 */
@Singleton
class MediaCrypto @Inject constructor() {
    private val sodium = LazySodiumAndroid(SodiumAndroid())
    private val secretBox: SecretBox.Native = sodium
    private val random = SecureRandom()

    data class Encrypted(val cipher: ByteArray, val key: String, val nonce: String)

    fun encrypt(bytes: ByteArray): Encrypted {
        val key = ByteArray(SecretBox.KEYBYTES).also { random.nextBytes(it) }
        val nonce = ByteArray(SecretBox.NONCEBYTES).also { random.nextBytes(it) }
        val cipher = ByteArray(SecretBox.MACBYTES + bytes.size)
        check(secretBox.cryptoSecretBoxEasy(cipher, bytes, bytes.size.toLong(), nonce, key)) { "media encryption failed" }
        return Encrypted(cipher, b64(key), b64(nonce))
    }

    fun decrypt(cipher: ByteArray, keyB64: String, nonceB64: String): ByteArray? {
        if (cipher.size < SecretBox.MACBYTES) return null
        val out = ByteArray(cipher.size - SecretBox.MACBYTES)
        val ok = secretBox.cryptoSecretBoxOpenEasy(out, cipher, cipher.size.toLong(), unb64(nonceB64), unb64(keyB64))
        return if (ok) out else null
    }

    private fun b64(b: ByteArray) = Base64.encodeToString(b, Base64.NO_WRAP)
    private fun unb64(s: String) = Base64.decode(s, Base64.NO_WRAP)
}

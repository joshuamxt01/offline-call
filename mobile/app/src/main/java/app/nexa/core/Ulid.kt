package app.nexa.core

import java.security.SecureRandom

/**
 * Minimal ULID generator (Crockford base32, 48-bit timestamp + 80-bit random =
 * 26 chars). Monotonic-ish and lexicographically sortable by time — used as the
 * client-authored message id so offline-composed messages order correctly.
 */
object Ulid {
    private const val ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
    private val random = SecureRandom()

    fun generate(): String {
        val time = System.currentTimeMillis()
        val sb = StringBuilder(26)
        // 48-bit timestamp → 10 chars
        var t = time
        val timeChars = CharArray(10)
        for (i in 9 downTo 0) {
            timeChars[i] = ENCODING[(t and 0x1F).toInt()]
            t = t shr 5
        }
        sb.append(timeChars)
        // 80-bit randomness → 16 chars
        repeat(16) { sb.append(ENCODING[random.nextInt(32)]) }
        return sb.toString()
    }
}

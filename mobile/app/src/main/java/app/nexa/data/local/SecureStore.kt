package app.nexa.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import app.nexa.data.crypto.CryptoBox
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Encrypted persistent store for the session (tokens, identity ids) and the
 * device's E2EE identity keypair. Backed by Android Keystore via
 * EncryptedSharedPreferences — the private key never leaves the device.
 */
@Singleton
class SecureStore @Inject constructor(
    @ApplicationContext context: Context,
    private val crypto: CryptoBox,
) {
    private val prefs: SharedPreferences = run {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "nexa_secure",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    private val _loggedIn = MutableStateFlow(accessToken != null)
    val loggedIn: StateFlow<Boolean> = _loggedIn

    var accessToken: String?
        get() = prefs.getString(K_ACCESS, null)
        set(v) = prefs.edit().putString(K_ACCESS, v).apply()

    var refreshToken: String?
        get() = prefs.getString(K_REFRESH, null)
        set(v) = prefs.edit().putString(K_REFRESH, v).apply()

    var userId: String?
        get() = prefs.getString(K_USER, null)
        set(v) = prefs.edit().putString(K_USER, v).apply()

    var deviceId: String?
        get() = prefs.getString(K_DEVICE, null)
        set(v) = prefs.edit().putString(K_DEVICE, v).apply()

    var username: String?
        get() = prefs.getString(K_USERNAME, null)
        set(v) = prefs.edit().putString(K_USERNAME, v).apply()

    /** Backend base URL. Editable in the app (login screen) so one APK works on
     *  any network — LAN IP, tunnel URL, etc. Defaults to the build-time value. */
    var serverUrl: String
        get() = prefs.getString(K_SERVER, null)?.takeIf { it.isNotBlank() }
            ?: app.nexa.BuildConfig.API_BASE_URL
        set(v) = prefs.edit().putString(K_SERVER, v.trim().trimEnd('/')).apply()

    /** Selected incoming-call ringtone: a bundled id ("ringtone_nexa", …) or "custom". */
    var ringtoneId: String
        get() = prefs.getString(K_RINGTONE, DEFAULT_RINGTONE) ?: DEFAULT_RINGTONE
        set(v) = prefs.edit().putString(K_RINGTONE, v).apply()

    /** content:// URI of a user-picked audio file, used when ringtoneId == "custom". */
    var customRingtoneUri: String?
        get() = prefs.getString(K_RINGTONE_URI, null)
        set(v) = prefs.edit().putString(K_RINGTONE_URI, v).apply()

    /** The device's identity keypair, created once and reused. */
    fun identity(): CryptoBox.KeyPairB64 {
        val pub = prefs.getString(K_ID_PUB, null)
        val priv = prefs.getString(K_ID_PRIV, null)
        if (pub != null && priv != null) return CryptoBox.KeyPairB64(pub, priv)
        val kp = crypto.generateKeyPair()
        prefs.edit().putString(K_ID_PUB, kp.publicKey).putString(K_ID_PRIV, kp.privateKey).apply()
        return kp
    }

    /** Fresh identity for a brand-new account (overwrites). */
    fun resetIdentity(): CryptoBox.KeyPairB64 {
        val kp = crypto.generateKeyPair()
        prefs.edit().putString(K_ID_PUB, kp.publicKey).putString(K_ID_PRIV, kp.privateKey).apply()
        return kp
    }

    fun saveSession(access: String, refresh: String, userId: String, deviceId: String, username: String) {
        prefs.edit()
            .putString(K_ACCESS, access)
            .putString(K_REFRESH, refresh)
            .putString(K_USER, userId)
            .putString(K_DEVICE, deviceId)
            .putString(K_USERNAME, username)
            .apply()
        _loggedIn.value = true
    }

    fun updateTokens(access: String, refresh: String) {
        prefs.edit().putString(K_ACCESS, access).putString(K_REFRESH, refresh).apply()
    }

    fun clearSession() {
        prefs.edit()
            .remove(K_ACCESS).remove(K_REFRESH).remove(K_USER).remove(K_DEVICE).remove(K_USERNAME)
            .apply()
        _loggedIn.value = false
    }

    private companion object {
        const val K_ACCESS = "access_token"
        const val K_REFRESH = "refresh_token"
        const val K_USER = "user_id"
        const val K_DEVICE = "device_id"
        const val K_USERNAME = "username"
        const val K_SERVER = "server_url"
        const val K_ID_PUB = "identity_pub"
        const val K_ID_PRIV = "identity_priv"
        const val K_RINGTONE = "ringtone_id"
        const val K_RINGTONE_URI = "ringtone_uri"
        const val DEFAULT_RINGTONE = "ringtone_nexa"
    }
}

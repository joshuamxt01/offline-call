package app.nexa.data.repository

import android.os.Build
import app.nexa.core.ApiResult
import app.nexa.data.local.SecureStore
import app.nexa.data.protocol.LoginRequest
import app.nexa.data.protocol.RegisterRequest
import app.nexa.data.realtime.SocketManager
import app.nexa.data.remote.ApiService
import kotlinx.coroutines.flow.StateFlow
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val api: ApiService,
    private val store: SecureStore,
    private val socket: SocketManager,
) {
    val loggedIn: StateFlow<Boolean> = store.loggedIn
    val username: String? get() = store.username

    private val deviceName get() = "${Build.MANUFACTURER} ${Build.MODEL}".trim()

    suspend fun register(username: String, email: String, password: String): ApiResult<Unit> = call {
        val identity = store.resetIdentity()
        val res = api.register(
            RegisterRequest(username, email, password, "android", identity.publicKey, deviceName),
        )
        store.saveSession(res.accessToken, res.refreshToken, res.user.id, res.device.id, res.user.username)
        socket.connect()
    }

    suspend fun login(emailOrUsername: String, password: String): ApiResult<Unit> = call {
        val identity = store.identity()
        val res = api.login(
            LoginRequest(emailOrUsername, password, "android", identity.publicKey, deviceName),
        )
        store.saveSession(res.accessToken, res.refreshToken, res.user.id, res.device.id, res.user.username)
        socket.connect()
    }

    suspend fun logout() {
        store.refreshToken?.let { runCatching { api.logout(app.nexa.data.protocol.RefreshRequest(it)) } }
        socket.disconnect()
        store.clearSession()
    }

    /** Re-establish the realtime connection on app start if a session exists. */
    fun bootstrapSocket() {
        if (store.accessToken != null) socket.connect()
    }

    private inline fun call(block: () -> Unit): ApiResult<Unit> = try {
        block(); ApiResult.Success(Unit)
    } catch (e: HttpException) {
        val msg = runCatching {
            org.json.JSONObject(e.response()?.errorBody()?.string() ?: "").getJSONObject("error").getString("message")
        }.getOrDefault("Request failed")
        ApiResult.Error("HTTP_${e.code()}", msg)
    } catch (e: Exception) {
        ApiResult.Error("NETWORK", e.message ?: "Network error")
    }
}

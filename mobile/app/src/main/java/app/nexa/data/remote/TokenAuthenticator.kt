package app.nexa.data.remote

import app.nexa.data.local.SecureStore
import app.nexa.data.protocol.RefreshRequest
import app.nexa.data.protocol.RefreshResponse
import kotlinx.serialization.json.Json
import okhttp3.Authenticator
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route
import javax.inject.Inject

/**
 * On a 401, rotates the refresh token once and retries the original request with
 * a fresh access token. Uses a bare OkHttpClient (no interceptors) to avoid a
 * refresh loop. If refresh fails, the session is cleared.
 */
class TokenAuthenticator @Inject constructor(
    private val store: SecureStore,
    private val json: Json,
) : Authenticator {

    private val bareClient = OkHttpClient()

    @Synchronized
    override fun authenticate(route: Route?, response: Response): Request? {
        if (responseCount(response) >= 2) return null // already retried
        val refresh = store.refreshToken ?: return null

        val rotated = runCatching { rotate(refresh) }.getOrNull()
        if (rotated == null) {
            store.clearSession()
            return null
        }
        store.updateTokens(rotated.accessToken, rotated.refreshToken)
        return response.request.newBuilder()
            .header("Authorization", "Bearer ${rotated.accessToken}")
            .build()
    }

    private fun rotate(refreshToken: String): RefreshResponse {
        val body = json.encodeToString(RefreshRequest.serializer(), RefreshRequest(refreshToken))
            .toRequestBody("application/json".toMediaType())
        val req = Request.Builder()
            .url("${store.serverUrl}/api/v1/auth/refresh")
            .post(body)
            .build()
        bareClient.newCall(req).execute().use { res ->
            if (!res.isSuccessful) error("refresh failed: ${res.code}")
            val text = res.body?.string() ?: error("empty refresh body")
            return json.decodeFromString(RefreshResponse.serializer(), text)
        }
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }
}

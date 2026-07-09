package app.nexa.data.remote

import app.nexa.data.local.SecureStore
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

/**
 * Redirects our API calls (which Retrofit builds against the sentinel host
 * `api.nexa.local`) to whatever backend the user configured in `SecureStore`.
 * This makes the base URL runtime-configurable, so one APK works on any network.
 *
 * Requests to any OTHER host (e.g. Backblaze B2 presigned upload/download URLs)
 * are left untouched.
 */
class BaseUrlInterceptor @Inject constructor(
    private val store: SecureStore,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (request.url.host != SENTINEL_HOST) return chain.proceed(request)

        val base = store.serverUrl.toHttpUrlOrNull() ?: return chain.proceed(request)
        val newUrl = request.url.newBuilder()
            .scheme(base.scheme)
            .host(base.host)
            .port(base.port)
            .build()
        return chain.proceed(request.newBuilder().url(newUrl).build())
    }

    companion object {
        const val SENTINEL_HOST = "api.nexa.local"
        const val SENTINEL_BASE = "http://api.nexa.local/api/v1/"
    }
}

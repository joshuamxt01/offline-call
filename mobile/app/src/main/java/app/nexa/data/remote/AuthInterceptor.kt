package app.nexa.data.remote

import app.nexa.data.local.SecureStore
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject

/** Attaches the bearer access token to every request (except auth endpoints). */
class AuthInterceptor @Inject constructor(
    private val store: SecureStore,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val path = request.url.encodedPath
        val skip = path.endsWith("/auth/login") ||
            path.endsWith("/auth/register") ||
            path.endsWith("/auth/refresh")
        val token = store.accessToken
        val out = if (!skip && token != null) {
            request.newBuilder().header("Authorization", "Bearer $token").build()
        } else {
            request
        }
        return chain.proceed(out)
    }
}

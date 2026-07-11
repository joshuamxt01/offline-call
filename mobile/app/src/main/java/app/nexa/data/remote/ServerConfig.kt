package app.nexa.data.remote

import app.nexa.BuildConfig

/**
 * The absolute base URL the app is talking to (the build default, or the server
 * the user configured). Kept here so plain image loaders (Coil) — which don't go
 * through Retrofit's sentinel base — can build absolute avatar URLs.
 */
object ServerConfig {
    @Volatile
    var baseUrl: String = BuildConfig.API_BASE_URL

    /** Public URL that redirects to the user's profile picture (or 404). */
    fun avatarUrl(userId: String, version: String? = null): String {
        val base = baseUrl.trimEnd('/')
        val v = if (version.isNullOrBlank()) "" else "?v=$version"
        return "$base/api/v1/users/$userId/avatar$v"
    }
}

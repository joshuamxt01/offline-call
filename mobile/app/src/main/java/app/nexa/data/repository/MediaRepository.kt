package app.nexa.data.repository

import android.content.Context
import app.nexa.data.crypto.MediaCrypto
import app.nexa.data.protocol.MediaEnvelope
import app.nexa.data.protocol.MediaUploadUrlRequest
import app.nexa.data.remote.ApiService
import dagger.hilt.android.qualifiers.ApplicationContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Encrypts recorded media, uploads the ciphertext to B2 (presigned PUT), and
 * downloads + decrypts on the receiving side, caching to the app cache dir.
 */
@Singleton
class MediaRepository @Inject constructor(
    private val api: ApiService,
    private val crypto: MediaCrypto,
    @ApplicationContext private val context: Context,
) {
    private val octet = "application/octet-stream".toMediaType()

    suspend fun upload(bytes: ByteArray, kind: String, mimeType: String, durationMs: Long): MediaEnvelope {
        val enc = crypto.encrypt(bytes)
        val res = api.mediaUploadUrl(
            MediaUploadUrlRequest(
                kind = if (kind == "voice") "voice_note" else "video_note",
                contentType = "application/octet-stream",
                sizeBytes = enc.cipher.size.toLong(),
                durationMs = durationMs,
            ),
        )
        api.uploadToPresigned(res.uploadUrl, "application/octet-stream", enc.cipher.toRequestBody(octet))
        api.mediaCommit(res.objectId)
        return MediaEnvelope(
            v = 1, mediaObjectId = res.objectId, key = enc.key, nonce = enc.nonce,
            mimeType = mimeType, durationMs = durationMs, kind = kind,
        )
    }

    /** Returns a decrypted, playable local file (cached). */
    suspend fun download(env: MediaEnvelope): File {
        val ext = if (env.kind == "voice") "m4a" else "mp4"
        val cacheFile = File(context.cacheDir, "media_${env.mediaObjectId}.$ext")
        if (cacheFile.exists() && cacheFile.length() > 0) return cacheFile

        val res = api.mediaDownloadUrl(env.mediaObjectId)
        val cipher = api.downloadFromPresigned(res.url).bytes()
        val plain = crypto.decrypt(cipher, env.key, env.nonce) ?: error("media decryption failed")
        cacheFile.writeBytes(plain)
        return cacheFile
    }

    /** Seed the cache with a just-recorded file so the sender plays instantly. */
    fun cacheLocal(env: MediaEnvelope, source: File) {
        val ext = if (env.kind == "voice") "m4a" else "mp4"
        val dest = File(context.cacheDir, "media_${env.mediaObjectId}.$ext")
        if (!dest.exists()) source.copyTo(dest, overwrite = true)
    }
}

package app.nexa.data.recorder

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject

/** Records a voice note to an AAC/m4a file in the cache dir. One recording at a time. */
class AudioRecorder @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private var recorder: MediaRecorder? = null
    private var file: File? = null
    private var startedAt = 0L

    data class Recording(val file: File, val durationMs: Long)

    fun start(): Boolean = runCatching {
        val f = File(context.cacheDir, "voice_${System.currentTimeMillis()}.m4a")
        file = f
        recorder = buildRecorder().apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            setAudioEncodingBitRate(128_000)
            setAudioSamplingRate(44_100)
            setOutputFile(f.absolutePath)
            prepare()
            start()
        }
        startedAt = System.currentTimeMillis()
        true
    }.getOrElse { cleanup(); false }

    fun stop(): Recording? = runCatching {
        recorder?.stop()
        val dur = System.currentTimeMillis() - startedAt
        val f = file
        release()
        if (f != null && f.length() > 0) Recording(f, dur) else null
    }.getOrElse { release(); null }

    fun cancel() {
        runCatching { recorder?.stop() }
        release()
        file?.delete()
        file = null
    }

    private fun buildRecorder(): MediaRecorder =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(context) else @Suppress("DEPRECATION") MediaRecorder()

    private fun release() {
        runCatching { recorder?.release() }
        recorder = null
    }

    private fun cleanup() {
        release()
        file?.delete()
        file = null
    }
}

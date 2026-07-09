package app.nexa.service

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import app.nexa.R
import app.nexa.data.local.SecureStore
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Plays the user's selected incoming-call ringtone (one of the bundled tones in
 * res/raw, or a custom audio file they picked from storage) and vibrates while a
 * call is ringing. A separate short "preview" player is used from Settings.
 */
@Singleton
class RingtonePlayer @Inject constructor(
    @ApplicationContext private val context: Context,
    private val store: SecureStore,
) {
    private var player: MediaPlayer? = null
    private var preview: MediaPlayer? = null

    private val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
    } else {
        @Suppress("DEPRECATION") context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }

    /** Start the selected ringtone looping + vibrate. Call [stop] to end. */
    fun startRinging() {
        stop()
        val mp = buildFor(store.ringtoneId, store.customRingtoneUri, loop = true) ?: return
        runCatching { mp.start() }.onFailure { runCatching { mp.release() }; return }
        player = mp
        vibrate()
    }

    fun stop() {
        player?.let { runCatching { it.stop() }; runCatching { it.release() } }
        player = null
        runCatching { vibrator?.cancel() }
    }

    /** Play a tone once (for the Settings preview). */
    fun previewTone(id: String, customUri: String?) {
        stopPreview()
        val mp = buildFor(id, customUri, loop = false) ?: return
        mp.setOnCompletionListener { stopPreview() }
        runCatching { mp.start() }.onFailure { stopPreview() }
        preview = mp
    }

    fun stopPreview() {
        preview?.let { runCatching { it.stop() }; runCatching { it.release() } }
        preview = null
    }

    private fun buildFor(id: String, customUri: String?, loop: Boolean): MediaPlayer? = runCatching {
        val mp = MediaPlayer()
        mp.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build(),
        )
        if (id == CUSTOM && !customUri.isNullOrBlank()) {
            mp.setDataSource(context, Uri.parse(customUri))
        } else {
            val res = rawResId(id)
            val afd = context.resources.openRawResourceFd(res) ?: return null
            afd.use { mp.setDataSource(it.fileDescriptor, it.startOffset, it.length) }
        }
        mp.isLooping = loop
        mp.prepare()
        mp
    }.getOrNull()

    private fun rawResId(id: String): Int {
        val name = if (id.startsWith("ringtone_")) id else DEFAULT
        val res = context.resources.getIdentifier(name, "raw", context.packageName)
        return if (res != 0) res else R.raw.ringtone_nexa
    }

    private fun vibrate() {
        val pattern = longArrayOf(0, 700, 900) // wait, buzz, gap — repeats
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION") vibrator?.vibrate(pattern, 0)
            }
        }
    }

    companion object {
        const val CUSTOM = "custom"
        private const val DEFAULT = "ringtone_nexa"

        /** The bundled tones, in display order. id must match a res/raw/<id>.wav file. */
        val BUILTIN: List<Pair<String, String>> = listOf(
            "ringtone_nexa" to "Nexa (default)",
            "ringtone_marimba" to "Marimba",
            "ringtone_pulse" to "Pulse",
            "ringtone_digital" to "Digital",
            "ringtone_gentle" to "Gentle",
        )
    }
}

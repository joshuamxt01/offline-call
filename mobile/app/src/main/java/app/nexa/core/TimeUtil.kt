package app.nexa.core

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** ISO-8601 (JS toISOString) <-> epoch millis, compatible with minSdk 24. */
object TimeUtil {
    private val iso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    fun parseIso(value: String?): Long {
        if (value.isNullOrBlank()) return System.currentTimeMillis()
        return runCatching { iso.parse(value)?.time ?: System.currentTimeMillis() }
            .getOrElse { System.currentTimeMillis() }
    }

    fun nowIso(): String = iso.format(Date())

    fun formatTime(millis: Long): String =
        SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(millis))

    fun formatDuration(seconds: Int?): String {
        val s = seconds ?: 0
        return "%d:%02d".format(s / 60, s % 60)
    }
}

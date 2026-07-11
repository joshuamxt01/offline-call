package app.nexa

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import app.nexa.service.AppForeground
import app.nexa.service.CallForegroundService
import app.nexa.service.MessagingService
import coil.ImageLoader
import coil.ImageLoaderFactory
import dagger.hilt.android.HiltAndroidApp
import okhttp3.OkHttpClient
import java.io.File
import java.io.PrintWriter
import javax.inject.Inject

@HiltAndroidApp
class NexaApp : Application(), ImageLoaderFactory {
    // The app's OkHttp (auth interceptor attaches the bearer token to our API,
    // and skips B2 presigned URLs) — so Coil can load "contacts-only" avatars.
    @Inject lateinit var okHttpClient: OkHttpClient

    override fun newImageLoader(): ImageLoader =
        ImageLoader.Builder(this).okHttpClient(okHttpClient).build()

    override fun onCreate() {
        super.onCreate()
        installCrashLogger()
        registerActivityLifecycleCallbacks(AppForeground)
        createNotificationChannels()
    }

    /**
     * Last-resort safety net: if any thread dies with an uncaught exception, write
     * the full stack trace to <app files>/last-crash.txt before the process exits,
     * then let the system handle it normally. Lets us recover the exact cause of a
     * field crash even without a USB/logcat connection.
     */
    private fun installCrashLogger() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            runCatching {
                val dir = getExternalFilesDir(null) ?: filesDir
                PrintWriter(File(dir, "last-crash.txt")).use { w ->
                    w.println("thread: ${thread.name}")
                    throwable.printStackTrace(w)
                }
            }
            previous?.uncaughtException(thread, throwable)
        }
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(
                CallForegroundService.CHANNEL_ONGOING,
                getString(R.string.call_channel_name),
                NotificationManager.IMPORTANCE_LOW,
            ).apply { description = getString(R.string.call_channel_desc) },
        )
        nm.createNotificationChannel(
            NotificationChannel(
                CallForegroundService.CHANNEL_INCOMING,
                getString(R.string.incoming_call_channel_name),
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                // We play our own user-selectable ringtone (RingtonePlayer), so mute
                // the channel's default sound/vibration to avoid double-ringing.
                setSound(null, null)
                enableVibration(false)
            },
        )
        // New-message notifications (built-in push).
        nm.createNotificationChannel(
            NotificationChannel(
                MessagingService.CHANNEL_MESSAGES,
                "Messages",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply { description = "New chat messages" },
        )
        // The quiet "Nexa is active" foreground-service notification.
        nm.createNotificationChannel(
            NotificationChannel(
                MessagingService.CHANNEL_ONGOING,
                "Running in background",
                NotificationManager.IMPORTANCE_MIN,
            ).apply { description = "Keeps Nexa connected so you get messages and calls" },
        )
    }
}

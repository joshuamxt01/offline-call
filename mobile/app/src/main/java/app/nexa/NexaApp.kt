package app.nexa

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import app.nexa.service.AppForeground
import app.nexa.service.CallForegroundService
import app.nexa.service.MessagingService
import coil.ImageLoader
import coil.ImageLoaderFactory
import dagger.hilt.android.HiltAndroidApp
import okhttp3.OkHttpClient
import java.io.File
import java.io.FileWriter
import java.io.PrintWriter
import java.util.Date
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
        installMainThreadGuard()
        registerActivityLifecycleCallbacks(AppForeground)
        createNotificationChannels()
    }

    /**
     * Global safety net for BACKGROUND threads: log any uncaught exception, then
     * keep the process alive instead of letting the system kill it. (Main-thread
     * exceptions are handled by [installMainThreadGuard] and never reach here.)
     */
    private fun installCrashLogger() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            logThrowable(thread.name, throwable)
            if (thread === Looper.getMainLooper().thread) {
                // Shouldn't happen (the loop guard catches main-thread throws first),
                // but if it ever does, defer to the system so we don't hang.
                previous?.uncaughtException(thread, throwable)
            }
            // Otherwise: swallow. Only the offending worker thread ends; the app lives.
        }
    }

    /**
     * The big one: wrap the main-thread message loop so that an uncaught exception
     * in ANY framework callback dispatched on the main thread — Activity/Service/
     * BroadcastReceiver lifecycle, a foreground-service startForeground(), a Compose
     * frame — is caught and logged instead of taking the whole app down. This is what
     * turns "the app vanished" into "that one action failed but the app kept running".
     */
    private fun installMainThreadGuard() {
        Handler(Looper.getMainLooper()).post {
            while (true) {
                try {
                    Looper.loop()
                } catch (t: Throwable) {
                    // A message handler threw. Log it and resume the loop so the app
                    // survives. Looper.loop() only exits by throwing, so re-entering it
                    // simply continues dispatching the next message.
                    logThrowable("main-loop", t)
                }
            }
        }
    }

    /**
     * Append a timestamped stack trace to <app files>/last-crash.txt so we can
     * recover the exact cause of a field failure even without USB/logcat.
     */
    private fun logThrowable(tag: String, throwable: Throwable) {
        Log.e("NexaCrash", "[$tag] uncaught", throwable)
        runCatching {
            val dir = getExternalFilesDir(null) ?: filesDir
            PrintWriter(FileWriter(File(dir, "last-crash.txt"), /* append = */ true)).use { w ->
                w.println("---- ${Date()} [$tag] ----")
                throwable.printStackTrace(w)
            }
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

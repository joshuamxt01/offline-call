package app.nexa

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import app.nexa.service.CallForegroundService
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class NexaApp : Application() {
    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
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
    }
}

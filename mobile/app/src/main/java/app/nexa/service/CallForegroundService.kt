package app.nexa.service

import android.Manifest
import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import androidx.core.content.ContextCompat
import app.nexa.MainActivity
import app.nexa.R

/**
 * Keeps the process alive and shows an ongoing notification while a call is
 * active (required for reliable mic/camera capture in the background).
 */
class CallForegroundService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopForegroundCompat()
            stopSelf()
            return START_NOT_STICKY
        }
        val peer = intent?.getStringExtra(EXTRA_PEER) ?: "Nexa call"
        val video = intent?.getBooleanExtra(EXTRA_VIDEO, false) ?: false
        startForegroundWithNotification(peer, video)
        return START_STICKY
    }

    private fun startForegroundWithNotification(peer: String, video: Boolean) {
        val contentIntent = android.app.PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            android.app.PendingIntent.FLAG_IMMUTABLE,
        )
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ONGOING)
            .setContentTitle("Ongoing call")
            .setContentText(peer)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setOngoing(true)
            .setContentIntent(contentIntent)
            .build()

        startForegroundSafely(notification, video)
    }

    /**
     * Start the foreground service WITHOUT ever crashing the app.
     *
     * On Android 14 (targetSdk 34) startForeground() with the microphone/camera
     * type throws if the matching runtime permission isn't granted, and starting
     * such a "while-in-use" service from the background (e.g. answering from the
     * lock screen) throws ForegroundServiceStartNotAllowedException. A throw here
     * runs on the service's main thread and kills the whole process the instant a
     * call is answered. So: request only the types we actually hold permission
     * for, and fall back to dataSync (no while-in-use restriction) then to a plain
     * FGS, catching everything.
     */
    private fun startForegroundSafely(notification: Notification, video: Boolean) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            runCatching { startForeground(NOTIFICATION_ID, notification) }
            return
        }
        val hasMic = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED
        val hasCam = video && ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED

        var micCamType = 0
        if (hasMic) micCamType = micCamType or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
        if (hasCam) micCamType = micCamType or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA

        // Try the precise mic/camera type first, then dataSync, then a bare FGS.
        val attempts = buildList {
            if (micCamType != 0) add(micCamType)
            add(ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        }
        for (type in attempts) {
            if (runCatching { startForeground(NOTIFICATION_ID, notification, type) }.isSuccess) return
        }
        // Last resort: satisfy the startForegroundService() contract however we can.
        if (runCatching { startForeground(NOTIFICATION_ID, notification) }.isFailure) {
            runCatching { stopSelf() }
        }
    }

    private fun stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION") stopForeground(true)
        }
    }

    companion object {
        const val CHANNEL_ONGOING = "nexa_call_ongoing"
        const val CHANNEL_INCOMING = "nexa_call_incoming"
        const val NOTIFICATION_ID = 1001
        const val INCOMING_NOTIFICATION_ID = 1002
        const val ACTION_STOP = "app.nexa.CALL_STOP"
        const val ACTION_ANSWER = "app.nexa.CALL_ANSWER" // handled by MainActivity
        const val EXTRA_PEER = "peer"
        const val EXTRA_VIDEO = "video"

        fun start(context: Context, peerName: String, video: Boolean = false) {
            val intent = Intent(context, CallForegroundService::class.java)
                .putExtra(EXTRA_PEER, peerName)
                .putExtra(EXTRA_VIDEO, video)
            // CRITICAL: answering from the lock screen / background makes
            // startForegroundService() itself throw ForegroundServiceStartNotAllowedException
            // (Android 12+) — on the MAIN thread, at THIS call site, before the service ever
            // runs. Unguarded, that crashes the whole app the instant a call is answered. The
            // call still works without the service while the UI is in the foreground, so swallow it.
            runCatching {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
                else context.startService(intent)
            }
        }

        fun stop(context: Context) {
            runCatching { context.startService(Intent(context, CallForegroundService::class.java).setAction(ACTION_STOP)) }
        }

        /**
         * High-priority, full-screen incoming-call alert. This is what makes the
         * phone ring and show the call even when the app is backgrounded or the
         * screen is locked — the fix for "the web can't call the phone".
         */
        fun showIncoming(context: Context, peerName: String) {
            val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT

            // Tapping the notification (or the full-screen alert) opens the call UI.
            val launch = Intent(context, MainActivity::class.java).apply {
                this.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val contentPi = PendingIntent.getActivity(context, 1, launch, flags)

            // Answer -> open MainActivity, which calls CallManager.accept().
            val answer = Intent(context, MainActivity::class.java).apply {
                action = ACTION_ANSWER
                this.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val answerPi = PendingIntent.getActivity(context, 2, answer, flags)

            // Decline -> broadcast to CallActionReceiver, which calls reject() (no UI).
            val decline = Intent(context, CallActionReceiver::class.java).setAction(CallActionReceiver.ACTION_DECLINE)
            val declinePi = PendingIntent.getBroadcast(context, 3, decline, flags)

            val caller = Person.Builder().setName(peerName).setImportant(true).build()

            val notif = NotificationCompat.Builder(context, CHANNEL_INCOMING)
                .setContentTitle("Incoming Nexa call")
                .setContentText(peerName)
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setOngoing(true)
                .setAutoCancel(false)
                .setContentIntent(contentPi)
                .setFullScreenIntent(contentPi, true) // wakes the screen / shows full-screen
                // Renders the standard green "Answer" / red "Decline" call buttons.
                .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, declinePi, answerPi))
                .build()
            runCatching { NotificationManagerCompat.from(context).notify(INCOMING_NOTIFICATION_ID, notif) }
        }

        fun cancelIncoming(context: Context) {
            runCatching { NotificationManagerCompat.from(context).cancel(INCOMING_NOTIFICATION_ID) }
        }
    }
}

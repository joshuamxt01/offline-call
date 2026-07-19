package app.nexa.service

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import app.nexa.MainActivity
import app.nexa.R
import app.nexa.data.local.ContactDao
import app.nexa.data.local.SecureStore
import app.nexa.data.protocol.MessageDto
import app.nexa.data.realtime.SocketManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Built-in push: a foreground service that keeps the realtime socket alive while
 * the app is backgrounded and posts a notification for each incoming message.
 * No Google/FCM — the connection is to our own server. Runs while logged in.
 */
@AndroidEntryPoint
class MessagingService : android.app.Service() {

    @Inject lateinit var socket: SocketManager
    @Inject lateinit var contactDao: ContactDao
    @Inject lateinit var store: SecureStore

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var collecting = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // startForeground() throws ForegroundServiceStartNotAllowedException (Android 12+)
        // when the system restarts this service in the BACKGROUND — a START_STICKY
        // redelivery with a null intent, e.g. while the phone is locked during an incoming
        // call. That uncaught throw was crashing the whole app on the device that answers.
        // If we can't go foreground right now, bail out quietly; MainActivity starts us
        // again (from the foreground, where it's allowed) the next time the app is opened.
        val started = runCatching { startForeground(ONGOING_ID, ongoingNotification()) }.isSuccess
        if (!started) {
            stopSelf()
            return START_NOT_STICKY
        }
        runCatching { socket.connect() }
        if (!collecting) {
            collecting = true
            scope.launch {
                socket.messageEvents.collect { dto -> runCatching { onMessage(dto) } }
            }
        }
        return START_STICKY
    }

    private suspend fun onMessage(dto: MessageDto) {
        if (dto.senderId == store.userId) return       // my own message
        if (AppForeground.isForeground) return          // app is open — no notification
        val name = contactDao.nameOf(dto.senderId) ?: "New message"
        val preview = when (dto.type) {
            "voice" -> "🎤 Voice message"
            "video" -> "📹 Video message"
            "image" -> "📷 Photo"
            else -> "New message"
        }
        notifyMessage(dto.senderId.hashCode(), name, preview)
    }

    private fun notifyMessage(id: Int, title: String, text: String) {
        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) return
        val open = Intent(this, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pi = PendingIntent.getActivity(
            this, id, open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notif = NotificationCompat.Builder(this, CHANNEL_MESSAGES)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(text)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setContentIntent(pi)
            .build()
        runCatching { NotificationManagerCompat.from(this).notify(id, notif) }
    }

    private fun ongoingNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ONGOING)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("Nexa is active")
            .setContentText("You'll be notified of new messages and calls.")
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)
            .setShowWhen(false)
            .build()

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        const val CHANNEL_MESSAGES = "nexa_messages"
        const val CHANNEL_ONGOING = "nexa_service"
        private const val ONGOING_ID = 42

        fun start(context: Context) {
            runCatching { ContextCompat.startForegroundService(context, Intent(context, MessagingService::class.java)) }
        }

        fun stop(context: Context) {
            runCatching { context.stopService(Intent(context, MessagingService::class.java)) }
        }
    }
}

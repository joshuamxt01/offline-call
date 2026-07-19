package app.nexa.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import app.nexa.data.repository.CallManager
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

/**
 * Handles the "Decline" action on the incoming-call notification. (Answer is an
 * Activity intent so the in-call UI opens; Decline needs no UI, so it's a
 * lightweight broadcast that just rejects the call.)
 *
 * Uses a Hilt EntryPoint to reach the singleton CallManager — simpler and more
 * robust here than @AndroidEntryPoint field injection on a BroadcastReceiver.
 */
class CallActionReceiver : BroadcastReceiver() {

    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface CallManagerEntryPoint {
        fun callManager(): CallManager
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_DECLINE) return
        runCatching {
            val entryPoint = EntryPointAccessors.fromApplication(
                context.applicationContext, CallManagerEntryPoint::class.java,
            )
            entryPoint.callManager().reject()
        }
    }

    companion object {
        const val ACTION_DECLINE = "app.nexa.CALL_DECLINE"
    }
}

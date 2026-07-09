package app.nexa.data.realtime

/** Parsed realtime events surfaced by SocketManager. */

data class ReceiptEvent(
    val messageId: String?,
    val conversationId: String?,
    val upToMessageId: String?,
    val userId: String?,
    val deliveredAt: String?,
    val readAt: String?,
)

data class TypingEvent(val conversationId: String, val userId: String, val active: Boolean)

data class PresenceEvent(val userId: String, val online: Boolean, val lastSeen: String?)

sealed interface CallEvent {
    data class Incoming(val callId: String, val callerId: String, val type: String) : CallEvent
    data class Answered(val callId: String) : CallEvent
    data class Rejected(val callId: String) : CallEvent
    data class Cancelled(val callId: String, val reason: String?) : CallEvent
    data class Ended(val callId: String, val reason: String?, val duration: Int) : CallEvent
}

sealed interface SignalEvent {
    val callId: String
    data class Offer(override val callId: String, val sdp: String) : SignalEvent
    data class Answer(override val callId: String, val sdp: String) : SignalEvent
    data class Ice(override val callId: String, val candidate: String) : SignalEvent
}

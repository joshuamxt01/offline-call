package app.nexa.data.protocol

/**
 * Socket.IO event names — mirrors shared/src/events.ts. Keep in sync with the
 * backend; this is the wire contract for realtime.
 */
object RtEvents {
    const val NAMESPACE = "/rt"

    // Client → Server
    const val PRESENCE_HEARTBEAT = "presence:heartbeat"
    const val PRESENCE_SUBSCRIBE = "presence:subscribe"
    const val MESSAGE_SEND = "message:send"
    const val MESSAGE_DELIVERED = "message:delivered"
    const val MESSAGE_READ = "message:read"
    const val TYPING_START = "typing:start"
    const val TYPING_STOP = "typing:stop"
    const val CALL_INVITE = "call:invite"
    const val CALL_ANSWER = "call:answer"
    const val CALL_REJECT = "call:reject"
    const val CALL_END = "call:end"
    const val SIGNAL_OFFER = "signal:offer"
    const val SIGNAL_ANSWER = "signal:answer"
    const val SIGNAL_ICE = "signal:ice"

    // Server → Client
    const val PRESENCE_UPDATE = "presence:update"
    const val MESSAGE_NEW = "message:new"
    const val MESSAGE_RECEIPT = "message:receipt"
    const val TYPING = "typing"
    const val CALL_INCOMING = "call:incoming"
    const val CALL_ANSWERED = "call:answered"
    const val CALL_REJECTED = "call:rejected"
    const val CALL_CANCELLED = "call:cancelled"
    const val CALL_ENDED = "call:ended"
}

/** LAN / offline protocol — mirrors shared/src/lan.ts. */
object LanProtocol {
    const val SERVICE_TYPE = "_nexa._tcp"
    const val VERSION = 1
}

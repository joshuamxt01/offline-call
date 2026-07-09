package app.nexa.data.realtime

import app.nexa.data.local.SecureStore
import app.nexa.data.protocol.MessageDto
import app.nexa.data.protocol.RtEvents
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.json.Json
import org.json.JSONObject
import java.net.URI
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Single authenticated Socket.IO connection to the backend /rt namespace.
 * Exposes typed flows for messaging, presence, and call signaling, plus emit
 * helpers. This is the CloudSignaling transport for online calls; LanSignaling
 * implements the same call/signal surface offline over the LAN.
 *
 * Event handlers run on the socket's thread and publish via tryEmit (buffered,
 * non-blocking) so we never block the transport thread.
 */
@Singleton
class SocketManager @Inject constructor(
    private val store: SecureStore,
    private val json: Json,
) {
    private var socket: Socket? = null

    private val _connected = MutableStateFlow(false)
    val connected: StateFlow<Boolean> = _connected

    val messageEvents = MutableSharedFlow<MessageDto>(extraBufferCapacity = 128)
    val receiptEvents = MutableSharedFlow<ReceiptEvent>(extraBufferCapacity = 128)
    val typingEvents = MutableSharedFlow<TypingEvent>(extraBufferCapacity = 64)
    val presenceEvents = MutableSharedFlow<PresenceEvent>(extraBufferCapacity = 128)
    val callEvents = MutableSharedFlow<CallEvent>(extraBufferCapacity = 64)
    val signalEvents = MutableSharedFlow<SignalEvent>(extraBufferCapacity = 256)

    fun connect() {
        val token = store.accessToken ?: return
        if (socket?.connected() == true) return

        val opts = IO.Options().apply {
            auth = mapOf("accessToken" to token)
            transports = arrayOf("websocket")
            reconnection = true
            forceNew = true
        }
        val s = IO.socket(URI.create(store.serverUrl + RtEvents.NAMESPACE), opts)
        socket = s
        wire(s)
        s.connect()
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
        _connected.value = false
    }

    private fun wire(s: Socket) {
        s.on(Socket.EVENT_CONNECT) {
            _connected.value = true
            s.emit(RtEvents.PRESENCE_HEARTBEAT)
        }
        s.on(Socket.EVENT_DISCONNECT) { _connected.value = false }

        s.on(RtEvents.MESSAGE_NEW) { a ->
            obj(a)?.let { messageEvents.tryEmit(json.decodeFromString(MessageDto.serializer(), it.toString())) }
        }
        s.on(RtEvents.MESSAGE_RECEIPT) { a ->
            obj(a)?.let { o ->
                receiptEvents.tryEmit(
                    ReceiptEvent(
                        messageId = o.strOrNull("messageId"),
                        conversationId = o.strOrNull("conversationId"),
                        upToMessageId = o.strOrNull("upToMessageId"),
                        userId = o.strOrNull("userId"),
                        deliveredAt = o.strOrNull("delivered_at"),
                        readAt = o.strOrNull("read_at"),
                    ),
                )
            }
        }
        s.on(RtEvents.TYPING) { a ->
            obj(a)?.let { o -> typingEvents.tryEmit(TypingEvent(o.getString("conversationId"), o.getString("userId"), o.optBoolean("active"))) }
        }
        s.on(RtEvents.PRESENCE_UPDATE) { a ->
            obj(a)?.let { o ->
                o.strOrNull("userId")?.let { uid -> presenceEvents.tryEmit(PresenceEvent(uid, o.optBoolean("online"), o.strOrNull("lastSeen"))) }
            }
        }

        s.on(RtEvents.CALL_INCOMING) { a ->
            obj(a)?.let { o -> callEvents.tryEmit(CallEvent.Incoming(o.getString("callId"), o.getString("callerId"), o.getString("type"))) }
        }
        s.on(RtEvents.CALL_ANSWERED) { a -> obj(a)?.let { o -> callEvents.tryEmit(CallEvent.Answered(o.getString("callId"))) } }
        s.on(RtEvents.CALL_REJECTED) { a -> obj(a)?.let { o -> callEvents.tryEmit(CallEvent.Rejected(o.getString("callId"))) } }
        s.on(RtEvents.CALL_CANCELLED) { a -> obj(a)?.let { o -> callEvents.tryEmit(CallEvent.Cancelled(o.getString("callId"), o.strOrNull("reason"))) } }
        s.on(RtEvents.CALL_ENDED) { a -> obj(a)?.let { o -> callEvents.tryEmit(CallEvent.Ended(o.getString("callId"), o.strOrNull("reason"), o.optInt("duration"))) } }

        s.on(RtEvents.SIGNAL_OFFER) { a -> obj(a)?.let { o -> signalEvents.tryEmit(SignalEvent.Offer(o.getString("callId"), o.getString("sdp"))) } }
        s.on(RtEvents.SIGNAL_ANSWER) { a -> obj(a)?.let { o -> signalEvents.tryEmit(SignalEvent.Answer(o.getString("callId"), o.getString("sdp"))) } }
        s.on(RtEvents.SIGNAL_ICE) { a -> obj(a)?.let { o -> signalEvents.tryEmit(SignalEvent.Ice(o.getString("callId"), o.getJSONObject("candidate").toString())) } }
    }

    // ---- Emit helpers ----
    fun heartbeat() { socket?.emit(RtEvents.PRESENCE_HEARTBEAT) }

    fun sendMessage(convId: String, id: String, ciphertext: String, nonce: String, clientCreatedAt: String) {
        socket?.emit(
            RtEvents.MESSAGE_SEND,
            JSONObject().put("id", id).put("conversationId", convId).put("type", "text")
                .put("ciphertext", ciphertext).put("nonce", nonce).put("clientCreatedAt", clientCreatedAt),
        )
    }

    fun sendMediaMessage(
        convId: String, id: String, type: String, ciphertext: String, nonce: String,
        mediaObjectId: String, clientCreatedAt: String,
    ) {
        socket?.emit(
            RtEvents.MESSAGE_SEND,
            JSONObject().put("id", id).put("conversationId", convId).put("type", type)
                .put("ciphertext", ciphertext).put("nonce", nonce)
                .put("mediaObjectId", mediaObjectId).put("clientCreatedAt", clientCreatedAt),
        )
    }

    fun markDelivered(messageId: String) { socket?.emit(RtEvents.MESSAGE_DELIVERED, JSONObject().put("messageId", messageId)) }
    fun markRead(convId: String, upToMessageId: String) { socket?.emit(RtEvents.MESSAGE_READ, JSONObject().put("conversationId", convId).put("upToMessageId", upToMessageId)) }
    fun typing(convId: String, active: Boolean) { socket?.emit(if (active) RtEvents.TYPING_START else RtEvents.TYPING_STOP, JSONObject().put("conversationId", convId)) }

    fun callInvite(callId: String, calleeId: String, type: String) { socket?.emit(RtEvents.CALL_INVITE, JSONObject().put("callId", callId).put("calleeId", calleeId).put("type", type)) }
    fun callAnswer(callId: String) { socket?.emit(RtEvents.CALL_ANSWER, JSONObject().put("callId", callId)) }
    fun callReject(callId: String, reason: String = "declined") { socket?.emit(RtEvents.CALL_REJECT, JSONObject().put("callId", callId).put("reason", reason)) }
    fun callEnd(callId: String) { socket?.emit(RtEvents.CALL_END, JSONObject().put("callId", callId)) }

    fun signalOffer(callId: String, sdp: String) { socket?.emit(RtEvents.SIGNAL_OFFER, JSONObject().put("callId", callId).put("sdp", sdp)) }
    fun signalAnswer(callId: String, sdp: String) { socket?.emit(RtEvents.SIGNAL_ANSWER, JSONObject().put("callId", callId).put("sdp", sdp)) }
    fun signalIce(callId: String, candidateJson: JSONObject) { socket?.emit(RtEvents.SIGNAL_ICE, JSONObject().put("callId", callId).put("candidate", candidateJson)) }

    private fun obj(args: Array<out Any?>): JSONObject? = args.firstOrNull() as? JSONObject
    private fun JSONObject.strOrNull(key: String): String? = if (!has(key) || isNull(key)) null else optString(key)
}

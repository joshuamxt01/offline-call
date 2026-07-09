package app.nexa.data.signaling

import app.nexa.data.realtime.SignalEvent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.DataInputStream
import java.io.DataOutputStream
import java.net.ServerSocket
import java.net.Socket
import javax.inject.Inject

/**
 * Offline signaling over a direct LAN socket (length-prefixed JSON frames,
 * mirroring shared/src/lan.ts). Implements the SAME SignalingChannel surface as
 * CloudSignaling, so the WebRTC session is identical — only the transport of the
 * SDP/ICE differs. No internet, no TURN: host ICE candidates only.
 *
 * One instance handles a single peer connection (host or client role).
 */
class LanSignaling @Inject constructor() : SignalingChannel {

    private val _signals = MutableSharedFlow<SignalEvent>(extraBufferCapacity = 64)
    override val signals: SharedFlow<SignalEvent> = _signals

    /** LAN call lifecycle (invite/bye) — the cloud equivalent lives in SocketManager. */
    val lanInvites = MutableSharedFlow<LanInvite>(extraBufferCapacity = 8)
    val lanBye = MutableSharedFlow<String>(extraBufferCapacity = 8)

    data class LanInvite(val callId: String, val fromDeviceId: String, val type: String)

    private var socket: Socket? = null
    private var out: DataOutputStream? = null
    private var serverSocket: ServerSocket? = null

    /** Act as the group owner / listener; accepts one peer and reads frames. */
    fun host(port: Int, scope: CoroutineScope) {
        scope.launch(Dispatchers.IO) {
            runCatching {
                val server = ServerSocket(port)
                serverSocket = server
                val s = server.accept()
                bind(s, scope)
            }
        }
    }

    /** Connect to a discovered peer and read frames. */
    fun connect(host: String, port: Int, scope: CoroutineScope) {
        scope.launch(Dispatchers.IO) {
            runCatching {
                val s = Socket(host, port)
                bind(s, scope)
            }
        }
    }

    private fun bind(s: Socket, scope: CoroutineScope) {
        socket = s
        out = DataOutputStream(s.getOutputStream())
        val input = DataInputStream(s.getInputStream())
        scope.launch(Dispatchers.IO) {
            runCatching {
                while (!s.isClosed) {
                    val len = input.readInt()
                    if (len <= 0 || len > 1_000_000) break
                    val buf = ByteArray(len)
                    input.readFully(buf)
                    handleFrame(JSONObject(String(buf, Charsets.UTF_8)))
                }
            }
        }
    }

    private fun handleFrame(frame: JSONObject) {
        val callId = frame.optString("callId")
        when (frame.optString("t")) {
            "offer" -> _signals.tryEmit(SignalEvent.Offer(callId, frame.getString("sdp")))
            "answer" -> _signals.tryEmit(SignalEvent.Answer(callId, frame.getString("sdp")))
            "ice" -> _signals.tryEmit(SignalEvent.Ice(callId, frame.getJSONObject("candidate").toString()))
            "invite" -> lanInvites.tryEmit(LanInvite(callId, frame.optString("from"), frame.optString("type")))
            "bye" -> lanBye.tryEmit(callId)
        }
    }

    private fun writeFrame(frame: JSONObject) {
        val o = out ?: return
        synchronized(o) {
            val bytes = frame.toString().toByteArray(Charsets.UTF_8)
            o.writeInt(bytes.size)
            o.write(bytes)
            o.flush()
        }
    }

    fun sendInvite(callId: String, fromDeviceId: String, type: String) =
        writeFrame(JSONObject().put("t", "invite").put("callId", callId).put("from", fromDeviceId).put("type", type))

    override fun sendOffer(callId: String, sdp: String) =
        writeFrame(JSONObject().put("t", "offer").put("callId", callId).put("sdp", sdp))

    override fun sendAnswer(callId: String, sdp: String) =
        writeFrame(JSONObject().put("t", "answer").put("callId", callId).put("sdp", sdp))

    override fun sendIce(callId: String, candidate: JSONObject) =
        writeFrame(JSONObject().put("t", "ice").put("callId", callId).put("candidate", candidate))

    fun sendBye(callId: String) = writeFrame(JSONObject().put("t", "bye").put("callId", callId))

    fun close() {
        runCatching { socket?.close() }
        runCatching { serverSocket?.close() }
        socket = null
        serverSocket = null
        out = null
    }
}

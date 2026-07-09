package app.nexa.data.signaling

import app.nexa.data.realtime.SignalEvent
import app.nexa.data.realtime.SocketManager
import kotlinx.coroutines.flow.SharedFlow
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

/** Online signaling over the backend Socket.IO connection. */
@Singleton
class CloudSignaling @Inject constructor(
    private val socket: SocketManager,
) : SignalingChannel {
    override val signals: SharedFlow<SignalEvent> = socket.signalEvents
    override fun sendOffer(callId: String, sdp: String) = socket.signalOffer(callId, sdp)
    override fun sendAnswer(callId: String, sdp: String) = socket.signalAnswer(callId, sdp)
    override fun sendIce(callId: String, candidate: JSONObject) = socket.signalIce(callId, candidate)
}

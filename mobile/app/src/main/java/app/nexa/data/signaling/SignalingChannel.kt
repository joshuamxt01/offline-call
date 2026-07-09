package app.nexa.data.signaling

import app.nexa.data.realtime.SignalEvent
import kotlinx.coroutines.flow.SharedFlow
import org.json.JSONObject

/**
 * Transport-agnostic SDP/ICE channel. The WebRTC session drives the SAME
 * PeerConnection regardless of whether these messages travel over the cloud
 * (Socket.IO) or the LAN (direct socket). This is what makes "the cloud never
 * carries local media" true by construction. See docs/06-OFFLINE-HYBRID.md.
 */
interface SignalingChannel {
    /** Incoming SDP/ICE for the active call. */
    val signals: SharedFlow<SignalEvent>

    fun sendOffer(callId: String, sdp: String)
    fun sendAnswer(callId: String, sdp: String)
    fun sendIce(callId: String, candidate: JSONObject)
}

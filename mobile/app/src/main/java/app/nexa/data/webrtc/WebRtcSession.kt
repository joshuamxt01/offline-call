package app.nexa.data.webrtc

import android.content.Context
import app.nexa.data.protocol.TurnCredentials
import app.nexa.data.realtime.SignalEvent
import app.nexa.data.signaling.SignalingChannel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import org.webrtc.*
import java.util.concurrent.CopyOnWriteArrayList

/**
 * One WebRTC call. Drives a single PeerConnection using an injected
 * SignalingChannel (cloud OR LAN — identical logic). Media is peer-to-peer;
 * signaling only carries SDP/ICE. Not a Hilt singleton — one per call.
 */
class WebRtcSession(
    private val appContext: Context,
    private val factory: PeerConnectionFactory,
    private val eglBase: EglBase,
    private val signaling: SignalingChannel,
    private val scope: CoroutineScope,
    private val callId: String,
    private val isVideo: Boolean,
) {
    val eglBaseContext: EglBase.Context get() = eglBase.eglBaseContext

    val localVideoTrack = MutableStateFlow<VideoTrack?>(null)
    val remoteVideoTrack = MutableStateFlow<VideoTrack?>(null)
    val connected = MutableStateFlow(false)

    private var peer: PeerConnection? = null
    private var audioTrack: AudioTrack? = null
    private var videoTrack: VideoTrack? = null
    private var videoCapturer: VideoCapturer? = null
    private var videoSource: VideoSource? = null
    private var surfaceHelper: SurfaceTextureHelper? = null
    private var usingFront = true
    private val pendingIce = CopyOnWriteArrayList<IceCandidate>()
    private var remoteSet = false
    private var disconnectJob: Job? = null

    private val diagLines = java.util.Collections.synchronizedList(mutableListOf<String>())
    /** The negotiation log for this call (for field diagnostics). */
    fun diagText(): String = synchronized(diagLines) { diagLines.joinToString("\n") }

    /** Set up local media + PeerConnection and start listening for signals.
     *  The caller additionally calls [makeOffer] once the callee has answered. */
    fun start(turn: TurnCredentials?, onFailed: () -> Unit) {
        // Never let media/peer setup crash the app — end the call gracefully instead.
        runCatching {
            createLocalMedia()
            createPeer(turn, onFailed)
            observeSignals()
        }.onFailure { onFailed() }
    }

    /** Caller-side: create and send the SDP offer (after CALL_ANSWERED). */
    fun makeOffer() = createOffer()

    // ---- Media ----
    private fun createLocalMedia() {
        val audioSource = factory.createAudioSource(MediaConstraints())
        audioTrack = factory.createAudioTrack("audio0", audioSource)

        if (isVideo) {
            // If the camera can't be opened, keep the call as audio-only rather than crash.
            runCatching {
                val enumerator = Camera2Enumerator(appContext)
                val capturer = createCameraCapturer(enumerator, front = true) ?: return@runCatching
                videoCapturer = capturer
                val source = factory.createVideoSource(false)
                videoSource = source
                surfaceHelper = SurfaceTextureHelper.create("CaptureThread", eglBase.eglBaseContext)
                capturer.initialize(surfaceHelper, appContext, source.capturerObserver)
                capturer.startCapture(1280, 720, 30)
                val track = factory.createVideoTrack("video0", source)
                videoTrack = track
                localVideoTrack.value = track
            }
        }
    }

    private fun createCameraCapturer(enumerator: Camera2Enumerator, front: Boolean): VideoCapturer? {
        val names = enumerator.deviceNames
        names.firstOrNull { enumerator.isFrontFacing(it) == front }?.let { return enumerator.createCapturer(it, null) }
        return names.firstOrNull()?.let { enumerator.createCapturer(it, null) }
    }

    // ---- PeerConnection ----
    private fun createPeer(turn: TurnCredentials?, onFailed: () -> Unit) {
        val iceServers = buildIceServers(turn)
        val config = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        }

        peer = factory.createPeerConnection(config, object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate) {
                diag("local candidate: ${candType(candidate.sdp)}")
                val json = JSONObject()
                    .put("candidate", candidate.sdp)
                    .put("sdpMid", candidate.sdpMid)
                    .put("sdpMLineIndex", candidate.sdpMLineIndex)
                signaling.sendIce(callId, json)
            }

            override fun onTrack(transceiver: RtpTransceiver) {
                diag("remote track: ${transceiver.receiver.track()?.kind()}")
                (transceiver.receiver.track() as? VideoTrack)?.let { remoteVideoTrack.value = it }
            }

            override fun onConnectionChange(newState: PeerConnection.PeerConnectionState) {
                diag("connection: $newState")
                when (newState) {
                    PeerConnection.PeerConnectionState.CONNECTED -> {
                        disconnectJob?.cancel() // recovered — cancel any pending hang-up
                        connected.value = true
                    }
                    // FAILED is terminal (ICE gave up) → end now.
                    PeerConnection.PeerConnectionState.FAILED,
                    PeerConnection.PeerConnectionState.CLOSED -> onFailed()
                    // DISCONNECTED is TRANSIENT — WebRTC usually recovers. Don't drop the
                    // call immediately; only end if it stays down past a grace period.
                    PeerConnection.PeerConnectionState.DISCONNECTED -> {
                        disconnectJob?.cancel()
                        disconnectJob = scope.launch {
                            delay(15_000)
                            onFailed()
                        }
                    }
                    else -> {}
                }
            }

            override fun onSignalingChange(p0: PeerConnection.SignalingState?) {}
            override fun onIceConnectionChange(p0: PeerConnection.IceConnectionState?) { diag("ice: $p0") }
            override fun onIceConnectionReceivingChange(p0: Boolean) {}
            override fun onIceGatheringChange(p0: PeerConnection.IceGatheringState?) {}
            override fun onIceCandidatesRemoved(p0: Array<out IceCandidate>?) {}
            override fun onAddStream(p0: MediaStream?) {}
            override fun onRemoveStream(p0: MediaStream?) {}
            override fun onDataChannel(p0: DataChannel?) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(p0: RtpReceiver?, p1: Array<out MediaStream>?) {}
        })

        val streamIds = listOf("stream0")
        audioTrack?.let { peer?.addTrack(it, streamIds) }
        videoTrack?.let { peer?.addTrack(it, streamIds) }
    }

    private fun buildIceServers(turn: TurnCredentials?): List<PeerConnection.IceServer> {
        val servers = mutableListOf<PeerConnection.IceServer>()
        if (turn != null) {
            val stun = turn.urls.filter { it.startsWith("stun:") }
            val turnUrls = turn.urls.filter { it.startsWith("turn:") }
            if (stun.isNotEmpty()) servers += PeerConnection.IceServer.builder(stun).createIceServer()
            if (turnUrls.isNotEmpty()) {
                servers += PeerConnection.IceServer.builder(turnUrls)
                    .setUsername(turn.username).setPassword(turn.credential).createIceServer()
            }
        }
        if (servers.isEmpty()) {
            servers += PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer()
        }
        return servers
    }

    // ---- SDP ----
    private fun createOffer() {
        peer?.createOffer(object : SdpObserverAdapter() {
            override fun onCreateSuccess(desc: SessionDescription) {
                peer?.setLocalDescription(SdpObserverAdapter(), desc)
                signaling.sendOffer(callId, desc.description)
            }
        }, mediaConstraints())
    }

    private fun createAnswer() {
        peer?.createAnswer(object : SdpObserverAdapter() {
            override fun onCreateSuccess(desc: SessionDescription) {
                peer?.setLocalDescription(SdpObserverAdapter(), desc)
                signaling.sendAnswer(callId, desc.description)
            }
        }, mediaConstraints())
    }

    private fun observeSignals() {
        scope.launch {
            signaling.signals.collect { event ->
                if (event.callId != callId) return@collect
                diag("recv ${event::class.simpleName}")
                when (event) {
                    is SignalEvent.Offer -> {
                        peer?.setRemoteDescription(object : SdpObserverAdapter() {
                            override fun onSetSuccess() {
                                remoteSet = true
                                drainIce()
                                createAnswer()
                            }
                        }, SessionDescription(SessionDescription.Type.OFFER, event.sdp))
                    }
                    is SignalEvent.Answer -> {
                        peer?.setRemoteDescription(object : SdpObserverAdapter() {
                            override fun onSetSuccess() {
                                remoteSet = true
                                drainIce()
                            }
                        }, SessionDescription(SessionDescription.Type.ANSWER, event.sdp))
                    }
                    is SignalEvent.Ice -> {
                        val c = JSONObject(event.candidate)
                        val ice = IceCandidate(c.optString("sdpMid"), c.optInt("sdpMLineIndex"), c.optString("candidate"))
                        if (remoteSet) peer?.addIceCandidate(ice) else pendingIce.add(ice)
                    }
                }
            }
        }
    }

    private fun drainIce() {
        pendingIce.forEach { peer?.addIceCandidate(it) }
        pendingIce.clear()
    }

    // ---- Controls ----
    fun setMicEnabled(enabled: Boolean) { audioTrack?.setEnabled(enabled) }
    fun setCameraEnabled(enabled: Boolean) { videoTrack?.setEnabled(enabled) }

    fun switchCamera() {
        (videoCapturer as? CameraVideoCapturer)?.switchCamera(object : CameraVideoCapturer.CameraSwitchHandler {
            override fun onCameraSwitchDone(isFront: Boolean) { usingFront = isFront }
            override fun onCameraSwitchError(error: String?) {}
        })
    }

    fun dispose() {
        diag("dispose")
        disconnectJob?.cancel()
        try { videoCapturer?.stopCapture() } catch (_: Exception) {}
        videoCapturer?.dispose()
        videoSource?.dispose()
        surfaceHelper?.dispose()
        localVideoTrack.value = null
        remoteVideoTrack.value = null
        peer?.close()
        peer = null
    }

    /** The ICE candidate type ("host" / "srflx" / "relay") from a candidate line. */
    private fun candType(sdp: String): String {
        val i = sdp.indexOf("typ ")
        return if (i >= 0) sdp.substring(i + 4).substringBefore(' ') else "?"
    }

    /**
     * Append a timestamped call event to <app files>/call-log.txt (and logcat).
     * Lets us see exactly how a call negotiated — which candidates were gathered
     * and where ICE reached CONNECTED or FAILED — without a USB/logcat connection.
     */
    private fun diag(msg: String) {
        android.util.Log.i("NexaCall", "[$callId] $msg")
        diagLines.add(msg)
        runCatching {
            val dir = appContext.getExternalFilesDir(null) ?: appContext.filesDir
            java.io.FileWriter(java.io.File(dir, "call-log.txt"), true).use {
                it.write("${System.currentTimeMillis()} ${callId.take(8)} $msg\n")
            }
        }
    }

    private fun mediaConstraints() = MediaConstraints().apply {
        mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
        mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", if (isVideo) "true" else "false"))
    }
}

/** No-op SdpObserver base so callers override only what they need. */
open class SdpObserverAdapter : SdpObserver {
    override fun onCreateSuccess(p0: SessionDescription) {}
    override fun onSetSuccess() {}
    override fun onCreateFailure(p0: String?) {}
    override fun onSetFailure(p0: String?) {}
}

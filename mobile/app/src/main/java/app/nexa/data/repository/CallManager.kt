package app.nexa.data.repository

import android.content.Context
import android.media.AudioManager
import app.nexa.data.protocol.TurnCredentials
import app.nexa.data.realtime.CallEvent
import app.nexa.data.realtime.SocketManager
import app.nexa.data.remote.ApiService
import app.nexa.data.signaling.SignalingChannel
import app.nexa.data.webrtc.WebRtcSession
import app.nexa.service.CallForegroundService
import app.nexa.service.RingtonePlayer
import app.nexa.domain.model.CallDirection
import app.nexa.domain.model.CallStatus
import app.nexa.domain.model.CallType
import app.nexa.domain.model.CallUiState
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import org.webrtc.EglBase
import org.webrtc.PeerConnectionFactory
import org.webrtc.VideoTrack
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Orchestrates the call lifecycle: reacts to Socket.IO call events, creates the
 * WebRtcSession, fetches short-lived TURN credentials, and exposes UI state.
 * Signaling goes through CloudSignaling; the media is peer-to-peer.
 */
@Singleton
class CallManager @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val factory: PeerConnectionFactory,
    private val eglBase: EglBase,
    private val socket: SocketManager,
    private val signaling: SignalingChannel,
    private val api: ApiService,
    private val ringtone: RingtonePlayer,
    private val scope: CoroutineScope,
) {
    private val _state = MutableStateFlow(CallUiState())
    val state: StateFlow<CallUiState> = _state

    val eglBaseContext: EglBase.Context get() = eglBase.eglBaseContext
    private var session: WebRtcSession? = null
    private val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    // Stable flows the UI renders; updated whenever a session's tracks change.
    val localVideo = MutableStateFlow<VideoTrack?>(null)
    val remoteVideo = MutableStateFlow<VideoTrack?>(null)

    init {
        scope.launch {
            socket.callEvents.collect { event ->
                when (event) {
                    is CallEvent.Incoming -> onIncoming(event)
                    is CallEvent.Answered -> onAnswered()
                    is CallEvent.Rejected -> endLocal(CallStatus.ENDED)
                    is CallEvent.Cancelled -> endLocal(CallStatus.ENDED)
                    is CallEvent.Ended -> endLocal(CallStatus.ENDED)
                }
            }
        }
    }

    fun startCall(peerId: String, peerName: String, type: CallType) {
        if (_state.value.active) return
        val callId = UUID.randomUUID().toString()
        _state.value = CallUiState(
            active = true, callId = callId, peerId = peerId, peerName = peerName, type = type,
            direction = CallDirection.OUTGOING, status = CallStatus.RINGING,
        )
        CallForegroundService.start(appContext, peerName, video = type == CallType.VIDEO)
        setupAudio(type)
        scope.launch {
            val turn = fetchTurn()
            session = newSession(callId, type).also { it.start(turn, ::onSessionFailed) }
            observeConnected()
            socket.callInvite(callId, peerId, type.wire())
        }
    }

    private fun onIncoming(event: CallEvent.Incoming) {
        if (_state.value.active) {
            socket.callReject(event.callId, "busy")
            return
        }
        val callerName = event.callerName?.takeIf { it.isNotBlank() } ?: "Incoming call"
        _state.value = CallUiState(
            active = true, callId = event.callId, peerId = event.callerId, peerName = callerName,
            type = CallType.fromWire(event.type), direction = CallDirection.INCOMING, status = CallStatus.INCOMING,
        )
        // Full-screen alert so the phone rings even if the app is backgrounded/locked.
        CallForegroundService.showIncoming(appContext, callerName)
        ringtone.startRinging() // play the user's selected ringtone + vibrate
    }

    fun accept() {
        val s = _state.value
        val callId = s.callId ?: return
        ringtone.stop()
        _state.value = s.copy(status = CallStatus.CONNECTING)
        CallForegroundService.cancelIncoming(appContext)
        CallForegroundService.start(appContext, s.peerName ?: "Call", video = s.type == CallType.VIDEO) // ongoing (mic/camera)
        setupAudio(s.type)
        scope.launch {
            val turn = fetchTurn()
            session = newSession(callId, s.type).also { it.start(turn, ::onSessionFailed) }
            observeConnected()
            socket.callAnswer(callId) // caller will then send the offer
        }
    }

    private fun onAnswered() {
        _state.value = _state.value.copy(status = CallStatus.CONNECTING)
        session?.makeOffer()
    }

    fun reject() {
        _state.value.callId?.let { socket.callReject(it) }
        endLocal(CallStatus.ENDED)
    }

    fun hangup() {
        _state.value.callId?.let { socket.callEnd(it) }
        endLocal(CallStatus.ENDED)
    }

    fun toggleMute() {
        val muted = !_state.value.muted
        session?.setMicEnabled(!muted)
        _state.value = _state.value.copy(muted = muted)
    }

    fun toggleCamera() {
        val off = !_state.value.cameraOff
        session?.setCameraEnabled(!off)
        _state.value = _state.value.copy(cameraOff = off)
    }

    fun switchCamera() = session?.switchCamera()

    /** Toggle earpiece ↔ speakerphone. */
    fun toggleSpeaker() {
        val on = !_state.value.speakerOn
        runCatching { audioManager.isSpeakerphoneOn = on }
        _state.value = _state.value.copy(speakerOn = on)
    }

    // ---- internals ----
    private fun setupAudio(type: CallType) {
        runCatching {
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
            val speaker = type == CallType.VIDEO // video defaults to loudspeaker
            audioManager.isSpeakerphoneOn = speaker
            _state.value = _state.value.copy(speakerOn = speaker)
        }
    }

    private fun resetAudio() {
        runCatching {
            audioManager.isSpeakerphoneOn = false
            audioManager.mode = AudioManager.MODE_NORMAL
        }
    }

    private fun newSession(callId: String, type: CallType) = WebRtcSession(
        appContext, factory, eglBase, signaling, scope, callId, isVideo = type == CallType.VIDEO,
    )

    private fun observeConnected() {
        val s = session ?: return
        scope.launch {
            s.connected.collect { if (it) _state.value = _state.value.copy(status = CallStatus.CONNECTED, startedAt = System.currentTimeMillis()) }
        }
        scope.launch { s.localVideoTrack.collect { localVideo.value = it } }
        scope.launch { s.remoteVideoTrack.collect { remoteVideo.value = it } }
    }

    private fun onSessionFailed() = endLocal(CallStatus.ENDED)

    private fun endLocal(status: CallStatus) {
        ringtone.stop()
        session?.dispose()
        session = null
        CallForegroundService.cancelIncoming(appContext)
        CallForegroundService.stop(appContext)
        resetAudio()
        localVideo.value = null
        remoteVideo.value = null
        _state.value = _state.value.copy(status = status)
        scope.launch {
            kotlinx.coroutines.delay(1200)
            _state.value = CallUiState()
        }
    }

    private suspend fun fetchTurn(): TurnCredentials? = runCatching { api.turnCredentials() }.getOrNull()
}

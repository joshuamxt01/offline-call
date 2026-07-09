package app.nexa.ui.call

import androidx.lifecycle.ViewModel
import app.nexa.data.repository.CallManager
import dagger.hilt.android.lifecycle.HiltViewModel
import org.webrtc.EglBase
import javax.inject.Inject

@HiltViewModel
class CallViewModel @Inject constructor(
    private val callManager: CallManager,
) : ViewModel() {
    val state = callManager.state
    val localVideo = callManager.localVideo
    val remoteVideo = callManager.remoteVideo
    val eglBaseContext: EglBase.Context get() = callManager.eglBaseContext

    fun accept() = callManager.accept()
    fun reject() = callManager.reject()
    fun hangup() = callManager.hangup()
    fun toggleMute() = callManager.toggleMute()
    fun toggleCamera() = callManager.toggleCamera()
    fun switchCamera() = callManager.switchCamera()
    fun toggleSpeaker() = callManager.toggleSpeaker()
}

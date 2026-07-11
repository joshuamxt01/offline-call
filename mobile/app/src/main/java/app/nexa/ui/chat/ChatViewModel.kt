package app.nexa.ui.chat

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.nexa.data.protocol.MediaEnvelope
import app.nexa.data.realtime.SocketManager
import app.nexa.data.recorder.AudioRecorder
import app.nexa.data.repository.CallManager
import app.nexa.data.repository.ChatRepository
import app.nexa.domain.model.CallType
import app.nexa.domain.model.ChatMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

@HiltViewModel
class ChatViewModel @Inject constructor(
    savedState: SavedStateHandle,
    private val chat: ChatRepository,
    private val callManager: CallManager,
    private val audioRecorder: AudioRecorder,
    socket: SocketManager,
) : ViewModel() {

    val conversationId: String = checkNotNull(savedState["convId"])
    val peerId: String = savedState["peerId"] ?: ""
    val peerName: String = savedState["peerName"] ?: "Conversation"

    val messages: StateFlow<List<ChatMessage>> =
        chat.observeMessages(conversationId).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val peerTyping = MutableStateFlow(false)

    init {
        viewModelScope.launch { if (peerId.isNotEmpty()) chat.loadHistory(conversationId, peerId) }
        viewModelScope.launch {
            socket.typingEvents.collect { if (it.conversationId == conversationId) peerTyping.value = it.active }
        }
        viewModelScope.launch {
            messages.collect { list ->
                list.lastOrNull { !it.mine }?.let { chat.markRead(conversationId, it.id) }
            }
        }
    }

    fun send(text: String) = viewModelScope.launch { chat.send(conversationId, peerId, text) }
    fun notifyTyping() = chat.typing(conversationId, true)
    fun stopTyping() = chat.typing(conversationId, false)

    fun call(type: CallType) {
        if (peerId.isNotEmpty()) callManager.startCall(peerId, peerName, type)
    }

    // ---- Voice notes ----
    val recording = MutableStateFlow(false)
    val recordElapsed = MutableStateFlow(0)
    private var recordStart = 0L
    private var recordJob: Job? = null

    fun startVoice() {
        if (recording.value || !audioRecorder.start()) return
        recording.value = true
        recordStart = System.currentTimeMillis()
        recordJob = viewModelScope.launch {
            while (recording.value) {
                recordElapsed.value = ((System.currentTimeMillis() - recordStart) / 1000).toInt()
                delay(300)
            }
        }
    }

    fun cancelVoice() {
        audioRecorder.cancel()
        recording.value = false
        recordJob?.cancel()
    }

    fun stopAndSendVoice() {
        val rec = audioRecorder.stop()
        recording.value = false
        recordJob?.cancel()
        if (rec != null && rec.durationMs > 400 && peerId.isNotEmpty()) {
            viewModelScope.launch {
                chat.sendMedia(conversationId, peerId, "voice", rec.file.readBytes(), "audio/mp4", rec.durationMs, rec.file)
            }
        }
    }

    // ---- Video notes ----
    fun sendVideo(bytes: ByteArray, durationMs: Long, file: File?) {
        if (peerId.isEmpty()) return
        viewModelScope.launch {
            chat.sendMedia(conversationId, peerId, "video", bytes, "video/mp4", durationMs, file)
        }
    }

    // ---- Photos ----
    fun sendImage(bytes: ByteArray, mimeType: String, file: File?) {
        if (peerId.isEmpty()) return
        viewModelScope.launch {
            chat.sendMedia(conversationId, peerId, "image", bytes, mimeType, 0, file)
        }
    }

    /** Download + decrypt a media message to a playable file (for players). */
    suspend fun mediaFile(env: MediaEnvelope): File? = runCatching { chat.resolveMedia(env) }.getOrNull()
}

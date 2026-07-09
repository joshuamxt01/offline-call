package app.nexa.domain.model

/** UI-facing domain models (decoupled from wire DTOs / Room entities). */

data class UiContact(
    val userId: String,
    val contactId: String,
    val username: String,
    val displayName: String,
    val online: Boolean,
    val lastSeen: Long?,
    val state: String,
    val incoming: Boolean = false,
    val favorite: Boolean = false,
    val presence: String = "offline",
)

data class UiConversation(
    val id: String,
    val peerId: String,
    val peerName: String,
    val lastText: String,
    val lastAt: Long,
    val unread: Int,
)

data class ChatMessage(
    val id: String,
    val mine: Boolean,
    val type: String, // text | voice | video
    val text: String,
    val media: app.nexa.data.protocol.MediaEnvelope?,
    val time: Long,
    val status: String, // queued | sent | delivered | read
)

enum class CallType {
    VOICE, VIDEO;

    fun wire(): String = if (this == VIDEO) "video" else "voice"

    companion object {
        fun fromWire(w: String): CallType = if (w == "video") VIDEO else VOICE
    }
}

enum class CallDirection { INCOMING, OUTGOING }
enum class CallStatus { IDLE, RINGING, INCOMING, CONNECTING, CONNECTED, ENDED }

data class CallUiState(
    val active: Boolean = false,
    val callId: String? = null,
    val peerId: String? = null,
    val peerName: String? = null,
    val type: CallType = CallType.VOICE,
    val direction: CallDirection? = null,
    val status: CallStatus = CallStatus.IDLE,
    val muted: Boolean = false,
    val cameraOff: Boolean = false,
    val speakerOn: Boolean = false,
    val startedAt: Long? = null,
)

data class UiCallHistory(
    val id: String,
    val type: String,
    val status: String,
    val transport: String?,
    val outgoing: Boolean,
    val startedAt: Long,
    val durationSeconds: Int?,
)

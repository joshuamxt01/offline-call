package app.nexa.data.protocol

import kotlinx.serialization.Serializable

/** REST + realtime DTOs — mirrors shared/src/dto.ts (Kotlin/serialization). */

@Serializable
data class UserDto(
    val id: String,
    val username: String,
    val displayName: String? = null,
    val avatarUrl: String? = null,
    val bio: String? = null,
    val email: String? = null,
    val role: String? = null,
    val status: String? = null,
    val privacy: String? = null,
    val statusKind: String? = null,
    val statusMessage: String? = null,
    val lastSeenAt: String? = null,
    val createdAt: String? = null,
)

@Serializable
data class DeviceDto(
    val id: String,
    val deviceName: String? = null,
    val platform: String,
    val verified: Boolean = false,
    val lastActiveAt: String? = null,
    val createdAt: String? = null,
)

@Serializable
data class AuthResponse(
    val user: UserDto,
    val device: DeviceDto,
    val accessToken: String,
    val refreshToken: String,
    val devVerifyCode: String? = null,
)

@Serializable
data class ContactDto(
    val id: String,
    val user: UserDto,
    val alias: String? = null,
    val state: String,
    val incoming: Boolean = false,
    val favorite: Boolean = false,
    val pinned: Boolean = false,
    val online: Boolean = false,
    val presence: String = "offline",
    val lastSeen: String? = null,
)

@Serializable
data class MessageDto(
    val id: String,
    val conversationId: String,
    val senderId: String,
    val type: String = "text",
    val ciphertext: String,
    val nonce: String,
    val mediaObjectId: String? = null,
    val clientCreatedAt: String,
    val serverCreatedAt: String,
    val status: String = "sent",
)

@Serializable
data class ConversationSummaryDto(
    val id: String,
    val participants: List<UserDto> = emptyList(),
    val lastMessage: MessageDto? = null,
    val unread: Int = 0,
)

@Serializable
data class CallDto(
    val id: String,
    val conversationId: String? = null,
    val callerId: String,
    val type: String,
    val transport: String? = null,
    val status: String,
    val startedAt: String,
    val answeredAt: String? = null,
    val endedAt: String? = null,
    val durationSeconds: Int? = null,
)

@Serializable
data class PublicKeyBundle(
    val userId: String,
    val deviceId: String,
    val identityPub: String,
    val signedPrekey: String = "",
    val signedPrekeySig: String = "",
    val oneTimePrekey: String? = null,
    val algo: String,
)

@Serializable
data class TurnCredentials(
    val urls: List<String>,
    val username: String,
    val credential: String,
    val ttl: Int,
)

// ---- Request bodies ----
@Serializable
data class RegisterRequest(
    val username: String,
    val email: String,
    val password: String,
    val platform: String = "android",
    val identityPub: String? = null,
    val deviceName: String? = null,
)

@Serializable
data class LoginRequest(
    val emailOrUsername: String,
    val password: String,
    val platform: String = "android",
    val identityPub: String? = null,
    val deviceName: String? = null,
)

@Serializable
data class RefreshRequest(val refreshToken: String)

@Serializable
data class RefreshResponse(val accessToken: String, val refreshToken: String)

@Serializable
data class CreateContactRequest(val contactUserId: String)

@Serializable
data class UpdateContactRequest(
    val state: String? = null,
    val alias: String? = null,
    val favorite: Boolean? = null,
    val pinned: Boolean? = null,
)

@Serializable
data class RespondContactRequest(val accept: Boolean)

@Serializable
data class BlockUserRequest(val userId: String)

@Serializable
data class UpdateProfileRequest(
    val displayName: String? = null,
    val bio: String? = null,
    val privacy: String? = null,
    val statusKind: String? = null,
    val statusMessage: String? = null,
)

@Serializable
data class CreateConversationRequest(val participantId: String)

@Serializable
data class IdResponse(val id: String)

@Serializable
data class SendMessageRequest(
    val id: String,
    val type: String = "text",
    val ciphertext: String,
    val nonce: String,
    val mediaObjectId: String? = null,
    val clientCreatedAt: String,
)

@Serializable
data class ListResponse<T>(val data: List<T>)

@Serializable
data class MeResponse(val user: UserDto, val device: DeviceDto)

// ---- Media (Backblaze B2) ----
@Serializable
data class MediaUploadUrlRequest(
    val kind: String,
    val contentType: String,
    val sizeBytes: Long,
    val durationMs: Long? = null,
)

@Serializable
data class MediaUploadUrlResponse(
    val objectId: String,
    val uploadUrl: String,
    val method: String = "PUT",
    val headers: Map<String, String> = emptyMap(),
)

@Serializable
data class CommitResponse(val objectId: String, val committed: Boolean)

@Serializable
data class MediaDownloadUrlResponse(val url: String, val contentType: String? = null, val expiresIn: Int)

/**
 * The self-contained descriptor a recipient needs to fetch + decrypt + play a
 * media message. Wire-compatible with the web client: it is serialized to JSON
 * and placed inside the E2E-encrypted message body.
 */
@Serializable
data class MediaEnvelope(
    val v: Int = 1,
    val mediaObjectId: String,
    val key: String,      // base64 secretbox key
    val nonce: String,    // base64
    val mimeType: String,
    val durationMs: Long,
    val kind: String,     // "voice" | "video"
)

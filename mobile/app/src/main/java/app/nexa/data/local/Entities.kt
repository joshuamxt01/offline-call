package app.nexa.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/** Locally-stored message. `plaintext` is the decrypted body cached for display;
 *  ciphertext/nonce are kept so queued messages can be (re)sent when online. */
@Entity(tableName = "messages")
data class MessageEntity(
    @PrimaryKey val id: String,               // ULID
    val conversationId: String,
    val senderId: String,
    val mine: Boolean,
    val type: String,
    val plaintext: String,
    val ciphertext: String,
    val nonce: String,
    val clientCreatedAt: Long,
    val serverCreatedAt: Long,
    val status: String,                        // queued | sent | delivered | read
)

@Entity(tableName = "conversations")
data class ConversationEntity(
    @PrimaryKey val id: String,
    val peerId: String,
    val peerName: String,
    val lastText: String,
    val lastAt: Long,
    val unread: Int,
)

@Entity(tableName = "contacts")
data class ContactEntity(
    @PrimaryKey val userId: String,
    val contactId: String,                     // the contact row id (for updates)
    val username: String,
    val displayName: String?,
    val alias: String?,
    val state: String,
    val incoming: Boolean = false,             // pending request sent TO me (I accept/reject)
    val favorite: Boolean = false,
    val presence: String = "offline",          // online | local | busy | in_call | away | offline
    val online: Boolean,
    val lastSeen: Long?,
    val publicKey: String?,                    // cached identity key for offline E2EE/trust
)

package app.nexa.data.repository

import app.nexa.core.TimeUtil
import app.nexa.core.Ulid
import app.nexa.data.crypto.CryptoBox
import app.nexa.data.local.ConversationDao
import app.nexa.data.local.ConversationEntity
import app.nexa.data.local.MessageDao
import app.nexa.data.local.MessageEntity
import app.nexa.data.local.SecureStore
import app.nexa.data.protocol.MediaEnvelope
import app.nexa.data.protocol.MessageDto
import app.nexa.data.protocol.SendMessageRequest
import app.nexa.data.realtime.SocketManager
import app.nexa.data.remote.ApiService
import app.nexa.domain.model.ChatMessage
import app.nexa.domain.model.UiConversation
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Messaging core: E2EE via CryptoBox, Room as the offline queue + cache, and
 * SocketManager for realtime delivery. Falls back to REST when the socket is
 * down and flushes queued messages + pulls missed ones on reconnect.
 */
@Singleton
class ChatRepository @Inject constructor(
    private val api: ApiService,
    private val messageDao: MessageDao,
    private val conversationDao: ConversationDao,
    private val contacts: ContactsRepository,
    private val crypto: CryptoBox,
    private val store: SecureStore,
    private val socket: SocketManager,
    private val media: MediaRepository,
    private val json: Json,
    private val scope: CoroutineScope,
) {
    init {
        scope.launch { socket.messageEvents.collect { onIncoming(it) } }
        scope.launch { socket.receiptEvents.collect { onReceipt(it) } }
        scope.launch {
            socket.connected.collect { up -> if (up) { flushQueue(); pullMissed() } }
        }
    }

    fun observeConversations(): Flow<List<UiConversation>> =
        conversationDao.observeAll().map { list ->
            list.map { UiConversation(it.id, it.peerId, it.peerName, it.lastText, it.lastAt, it.unread) }
        }

    fun observeMessages(conversationId: String): Flow<List<ChatMessage>> =
        messageDao.observe(conversationId).map { list ->
            list.map { e ->
                val env = if (e.type != "text") {
                    runCatching { json.decodeFromString(MediaEnvelope.serializer(), e.plaintext) }.getOrNull()
                } else null
                ChatMessage(
                    id = e.id, mine = e.mine, type = e.type,
                    text = if (e.type == "text") e.plaintext else "",
                    media = env, time = e.clientCreatedAt, status = e.status,
                )
            }
        }

    /** Download + decrypt a media message to a playable local file (cached). */
    suspend fun resolveMedia(env: MediaEnvelope): File = media.download(env)

    /** Find or create the 1:1 conversation with a peer; returns its id. */
    suspend fun getOrCreateConversation(peerId: String, peerName: String): String? {
        val id = runCatching { api.createConversation(app.nexa.data.protocol.CreateConversationRequest(peerId)).id }
            .getOrNull() ?: return null
        if (conversationDao.byId(id) == null) {
            conversationDao.upsert(ConversationEntity(id, peerId, peerName, "Say hello 👋", System.currentTimeMillis(), 0))
        }
        return id
    }

    suspend fun refreshConversations() {
        val remote = runCatching { api.conversations().data }.getOrNull() ?: return
        remote.forEach { c ->
            val peer = c.participants.firstOrNull()
            conversationDao.upsert(
                ConversationEntity(
                    id = c.id,
                    peerId = peer?.id ?: "",
                    peerName = peer?.displayName ?: peer?.username ?: "Conversation",
                    lastText = if (c.lastMessage != null) "🔒 message" else "Say hello 👋",
                    lastAt = c.lastMessage?.let { TimeUtil.parseIso(it.serverCreatedAt) } ?: 0L,
                    unread = c.unread,
                ),
            )
        }
    }

    suspend fun loadHistory(conversationId: String, peerId: String) {
        val history = runCatching { api.history(conversationId).data }.getOrNull() ?: return
        history.forEach { store(it, peerId) }
        history.lastOrNull { it.senderId != store.userId }?.let { markRead(conversationId, it.id) }
    }

    suspend fun send(conversationId: String, peerId: String, text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        val myPriv = store.identity().privateKey
        val peerPub = contacts.publicKeyOf(peerId) ?: return
        val sealed = crypto.encrypt(peerPub, myPriv, trimmed)
        val id = Ulid.generate()
        val now = System.currentTimeMillis()
        val iso = TimeUtil.nowIso()

        val entity = MessageEntity(
            id = id, conversationId = conversationId, senderId = store.userId ?: "", mine = true,
            type = "text", plaintext = trimmed, ciphertext = sealed.ciphertext, nonce = sealed.nonce,
            clientCreatedAt = now, serverCreatedAt = now,
            status = if (socket.connected.value) "sent" else "queued",
        )
        messageDao.insert(entity)
        touchConversation(conversationId, peerId, trimmed, now, incUnread = false)

        if (socket.connected.value) {
            socket.sendMessage(conversationId, id, sealed.ciphertext, sealed.nonce, iso)
        } else {
            runCatching {
                api.sendMessageFallback(conversationId, SendMessageRequest(id, "text", sealed.ciphertext, sealed.nonce, null, iso))
                messageDao.updateStatus(id, "sent")
            }
        }
    }

    /** Record → encrypt → upload to B2 → send a voice/video message. */
    suspend fun sendMedia(
        conversationId: String,
        peerId: String,
        kind: String, // "voice" | "video"
        bytes: ByteArray,
        mimeType: String,
        durationMs: Long,
        sourceFile: File?,
    ) {
        val myPriv = store.identity().privateKey
        val peerPub = contacts.publicKeyOf(peerId) ?: return
        val env = media.upload(bytes, kind, mimeType, durationMs)
        sourceFile?.let { media.cacheLocal(env, it) }

        val envelopeJson = json.encodeToString(MediaEnvelope.serializer(), env)
        val sealed = crypto.encrypt(peerPub, myPriv, envelopeJson)
        val id = Ulid.generate()
        val now = System.currentTimeMillis()
        val iso = TimeUtil.nowIso()

        messageDao.insert(
            MessageEntity(
                id = id, conversationId = conversationId, senderId = store.userId ?: "", mine = true,
                type = kind, plaintext = envelopeJson, ciphertext = sealed.ciphertext, nonce = sealed.nonce,
                clientCreatedAt = now, serverCreatedAt = now,
                status = if (socket.connected.value) "sent" else "queued",
            ),
        )
        touchConversation(conversationId, peerId, if (kind == "voice") "🎤 Voice message" else "📹 Video message", now, incUnread = false)

        if (socket.connected.value) {
            socket.sendMediaMessage(conversationId, id, kind, sealed.ciphertext, sealed.nonce, env.mediaObjectId, iso)
        } else {
            runCatching {
                api.sendMessageFallback(conversationId, SendMessageRequest(id, kind, sealed.ciphertext, sealed.nonce, env.mediaObjectId, iso))
                messageDao.updateStatus(id, "sent")
            }
        }
    }

    fun typing(conversationId: String, active: Boolean) = socket.typing(conversationId, active)

    fun markRead(conversationId: String, upToMessageId: String) {
        socket.markRead(conversationId, upToMessageId)
        scope.launch {
            conversationDao.byId(conversationId)?.let { conversationDao.upsert(it.copy(unread = 0)) }
        }
    }

    // ---- Realtime handlers ----
    private suspend fun onIncoming(dto: MessageDto) {
        if (messageDao.byId(dto.id) != null) return
        val mine = dto.senderId == store.userId
        val conv = conversationDao.byId(dto.conversationId)
        val peerId = if (mine) conv?.peerId ?: return else dto.senderId
        store(dto, peerId)
        val preview = when (dto.type) {
            "voice" -> "🎤 Voice message"
            "video" -> "📹 Video message"
            else -> "🔒 message"
        }
        touchConversation(dto.conversationId, peerId, preview, TimeUtil.parseIso(dto.serverCreatedAt), incUnread = !mine)
        if (!mine) {
            socket.markDelivered(dto.id)
            socket.markRead(dto.conversationId, dto.id)
        }
    }

    private suspend fun onReceipt(receipt: app.nexa.data.realtime.ReceiptEvent) {
        receipt.messageId?.let { id ->
            val status = if (receipt.readAt != null) "read" else "delivered"
            messageDao.updateStatus(id, status)
        }
        if (receipt.upToMessageId != null && receipt.conversationId != null) {
            messageDao.markMineReadUpTo(receipt.conversationId, receipt.upToMessageId)
        }
    }

    private suspend fun store(dto: MessageDto, peerId: String) {
        val mine = dto.senderId == store.userId
        val myPriv = store.identity().privateKey
        val peerPub = contacts.publicKeyOf(peerId)
        val text = if (peerPub != null) {
            crypto.decrypt(peerPub, myPriv, dto.ciphertext, dto.nonce) ?: "🔒 Unable to decrypt"
        } else "🔒 Encrypted"
        messageDao.upsert(
            MessageEntity(
                id = dto.id, conversationId = dto.conversationId, senderId = dto.senderId, mine = mine,
                type = dto.type, plaintext = text, ciphertext = dto.ciphertext, nonce = dto.nonce,
                clientCreatedAt = TimeUtil.parseIso(dto.clientCreatedAt),
                serverCreatedAt = TimeUtil.parseIso(dto.serverCreatedAt),
                status = dto.status,
            ),
        )
    }

    private suspend fun touchConversation(convId: String, peerId: String, lastText: String, at: Long, incUnread: Boolean) {
        val existing = conversationDao.byId(convId)
        if (existing == null) {
            refreshConversations()
            conversationDao.byId(convId)?.let {
                conversationDao.upsert(it.copy(lastText = lastText, lastAt = at, unread = if (incUnread) it.unread + 1 else it.unread))
            }
            return
        }
        conversationDao.upsert(
            existing.copy(lastText = lastText, lastAt = at, unread = if (incUnread) existing.unread + 1 else existing.unread),
        )
    }

    private suspend fun flushQueue() {
        messageDao.queued().forEach { m ->
            socket.sendMessage(m.conversationId, m.id, m.ciphertext, m.nonce, TimeUtil.nowIso())
            messageDao.updateStatus(m.id, "sent")
        }
    }

    private suspend fun pullMissed() {
        val missed = runCatching { api.syncPull().data }.getOrNull() ?: return
        missed.forEach { dto ->
            val conv = conversationDao.byId(dto.conversationId)
            val peerId = if (dto.senderId == store.userId) conv?.peerId ?: return@forEach else dto.senderId
            store(dto, peerId)
        }
    }
}

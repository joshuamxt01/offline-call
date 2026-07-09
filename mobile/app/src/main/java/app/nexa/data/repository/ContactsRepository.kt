package app.nexa.data.repository

import app.nexa.core.ApiResult
import app.nexa.core.TimeUtil
import app.nexa.data.local.ContactDao
import app.nexa.data.local.ContactEntity
import app.nexa.data.protocol.BlockUserRequest
import app.nexa.data.protocol.CreateContactRequest
import app.nexa.data.protocol.RespondContactRequest
import app.nexa.data.protocol.UpdateContactRequest
import app.nexa.data.protocol.UserDto
import app.nexa.data.remote.ApiService
import app.nexa.domain.model.UiContact
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ContactsRepository @Inject constructor(
    private val api: ApiService,
    private val contactDao: ContactDao,
) {
    fun observe(): Flow<List<UiContact>> = contactDao.observeAll().map { list ->
        list.map {
            UiContact(
                userId = it.userId,
                contactId = it.contactId,
                username = it.username,
                displayName = it.displayName ?: it.username,
                online = it.online,
                lastSeen = it.lastSeen,
                state = it.state,
                incoming = it.incoming,
                favorite = it.favorite,
                presence = it.presence,
            )
        }
    }

    /** Fetch contacts from the server and cache them (incl. public keys for offline). */
    suspend fun refresh() {
        val remote = api.contacts().data
        val entities = remote.map { c ->
            val pub = runCatching { api.keyBundle(c.user.id).identityPub }.getOrNull()
            ContactEntity(
                userId = c.user.id,
                contactId = c.id,
                username = c.user.username,
                displayName = c.user.displayName,
                alias = c.alias,
                state = c.state,
                incoming = c.incoming,
                favorite = c.favorite,
                presence = c.presence,
                online = c.online,
                lastSeen = c.lastSeen?.let { TimeUtil.parseIso(it) },
                publicKey = pub,
            )
        }
        contactDao.upsertAll(entities)
    }

    suspend fun search(query: String): ApiResult<List<UserDto>> = try {
        ApiResult.Success(api.searchUsers(query).data)
    } catch (e: Exception) {
        ApiResult.Error("NETWORK", e.message ?: "Search failed")
    }

    suspend fun add(userId: String): ApiResult<Unit> = mutate { api.addContact(CreateContactRequest(userId)) }
    suspend fun accept(contactId: String): ApiResult<Unit> =
        mutate { api.respondContact(contactId, RespondContactRequest(accept = true)) }
    suspend fun reject(contactId: String): ApiResult<Unit> =
        mutate { api.respondContact(contactId, RespondContactRequest(accept = false)) }
    suspend fun cancel(contactId: String): ApiResult<Unit> = mutate { api.cancelContact(contactId) }
    suspend fun setFavorite(contactId: String, favorite: Boolean): ApiResult<Unit> =
        mutate { api.updateContact(contactId, UpdateContactRequest(favorite = favorite)) }
    suspend fun blockUser(userId: String): ApiResult<Unit> = mutate { api.blockUser(BlockUserRequest(userId)) }
    suspend fun unblockUser(userId: String): ApiResult<Unit> = mutate { api.unblockUser(BlockUserRequest(userId)) }
    suspend fun remove(contactId: String): ApiResult<Unit> = mutate { api.removeContact(contactId) }

    suspend fun publicKeyOf(userId: String): String? =
        contactDao.publicKeyOf(userId) ?: runCatching { api.keyBundle(userId).identityPub }.getOrNull()

    fun updatePresence(userId: String, online: Boolean) {
        // Presence is refreshed via refresh(); realtime updates trigger a re-fetch in the VM.
    }

    private inline fun mutate(block: () -> Unit): ApiResult<Unit> = try {
        block(); ApiResult.Success(Unit)
    } catch (e: Exception) {
        ApiResult.Error("NETWORK", e.message ?: "Request failed")
    }
}

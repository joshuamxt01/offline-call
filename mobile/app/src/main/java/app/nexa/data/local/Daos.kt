package app.nexa.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface MessageDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(message: MessageEntity)

    @Upsert
    suspend fun upsert(message: MessageEntity)

    @Query("SELECT * FROM messages WHERE conversationId = :conversationId ORDER BY clientCreatedAt ASC, id ASC")
    fun observe(conversationId: String): Flow<List<MessageEntity>>

    @Query("UPDATE messages SET status = :status WHERE id = :id")
    suspend fun updateStatus(id: String, status: String)

    @Query("UPDATE messages SET status = 'read' WHERE conversationId = :conversationId AND mine = 1 AND id <= :upToId")
    suspend fun markMineReadUpTo(conversationId: String, upToId: String)

    @Query("SELECT * FROM messages WHERE status = 'queued' ORDER BY clientCreatedAt ASC")
    suspend fun queued(): List<MessageEntity>

    @Query("SELECT * FROM messages WHERE id = :id LIMIT 1")
    suspend fun byId(id: String): MessageEntity?
}

@Dao
interface ConversationDao {
    @Upsert
    suspend fun upsert(conversation: ConversationEntity)

    @Query("SELECT * FROM conversations ORDER BY lastAt DESC")
    fun observeAll(): Flow<List<ConversationEntity>>

    @Query("SELECT * FROM conversations WHERE id = :id LIMIT 1")
    suspend fun byId(id: String): ConversationEntity?
}

@Dao
interface ContactDao {
    @Upsert
    suspend fun upsertAll(contacts: List<ContactEntity>)

    @Query("SELECT * FROM contacts ORDER BY online DESC, username ASC")
    fun observeAll(): Flow<List<ContactEntity>>

    @Query("SELECT publicKey FROM contacts WHERE userId = :userId LIMIT 1")
    suspend fun publicKeyOf(userId: String): String?

    @Query("UPDATE contacts SET publicKey = :key WHERE userId = :userId")
    suspend fun updatePublicKey(userId: String, key: String)

    @Query("DELETE FROM contacts")
    suspend fun clear()
}

package app.nexa.data.remote

import app.nexa.data.protocol.*
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.http.*

/** Nexa REST API — mirrors docs/03-API-REFERENCE.md. Base: {API}/api/v1/ */
interface ApiService {
    // ---- Auth ----
    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): AuthResponse

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): AuthResponse

    @POST("auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): RefreshResponse

    @POST("auth/logout")
    suspend fun logout(@Body body: RefreshRequest)

    @GET("auth/me")
    suspend fun me(): MeResponse

    // ---- Users ----
    @GET("users/search")
    suspend fun searchUsers(@Query("q") q: String): ListResponse<UserDto>

    @PATCH("users/me")
    suspend fun updateProfile(@Body body: UpdateProfileRequest): UserDto

    // ---- Contacts ----
    @GET("contacts")
    suspend fun contacts(): ListResponse<ContactDto>

    @POST("contacts")
    suspend fun addContact(@Body body: CreateContactRequest): ContactDto

    @PATCH("contacts/{id}")
    suspend fun updateContact(@Path("id") id: String, @Body body: UpdateContactRequest): ContactDto

    @POST("contacts/{id}/respond")
    suspend fun respondContact(@Path("id") id: String, @Body body: RespondContactRequest): ContactDto

    @POST("contacts/{id}/cancel")
    suspend fun cancelContact(@Path("id") id: String)

    @POST("contacts/block")
    suspend fun blockUser(@Body body: BlockUserRequest)

    @POST("contacts/unblock")
    suspend fun unblockUser(@Body body: BlockUserRequest)

    @DELETE("contacts/{id}")
    suspend fun removeContact(@Path("id") id: String)

    // ---- Devices ----
    @GET("devices")
    suspend fun devices(): ListResponse<DeviceDto>

    @DELETE("devices/{id}")
    suspend fun revokeDevice(@Path("id") id: String)

    // ---- Keys (E2EE) ----
    @GET("keys/{userId}")
    suspend fun keyBundle(@Path("userId") userId: String): PublicKeyBundle

    // ---- Conversations & messages ----
    @GET("conversations")
    suspend fun conversations(): ListResponse<ConversationSummaryDto>

    @POST("conversations")
    suspend fun createConversation(@Body body: CreateConversationRequest): IdResponse

    @GET("conversations/{id}/messages")
    suspend fun history(
        @Path("id") id: String,
        @Query("before") before: String? = null,
        @Query("limit") limit: Int = 50,
    ): ListResponse<MessageDto>

    @POST("conversations/{id}/messages")
    suspend fun sendMessageFallback(@Path("id") id: String, @Body body: SendMessageRequest): MessageDto

    @GET("messages/sync")
    suspend fun syncPull(@Query("since") since: String? = null): ListResponse<MessageDto>

    // ---- Media (Backblaze B2 via presigned URLs) ----
    @POST("media/upload-url")
    suspend fun mediaUploadUrl(@Body body: MediaUploadUrlRequest): MediaUploadUrlResponse

    @POST("media/{id}/commit")
    suspend fun mediaCommit(@Path("id") id: String): CommitResponse

    @GET("media/{id}/download-url")
    suspend fun mediaDownloadUrl(@Path("id") id: String): MediaDownloadUrlResponse

    /** Raw upload of encrypted bytes to a B2 presigned PUT URL (absolute @Url). */
    @PUT
    suspend fun uploadToPresigned(
        @Url url: String,
        @Header("Content-Type") contentType: String,
        @Body body: RequestBody,
    )

    /** Raw download of encrypted bytes from a B2 presigned GET URL. */
    @GET
    @Streaming
    suspend fun downloadFromPresigned(@Url url: String): ResponseBody

    // ---- Calls ----
    @GET("calls")
    suspend fun calls(): ListResponse<CallDto>

    @GET("turn/credentials")
    suspend fun turnCredentials(): TurnCredentials
}

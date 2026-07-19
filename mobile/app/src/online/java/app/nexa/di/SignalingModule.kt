package app.nexa.di

import app.nexa.data.signaling.CloudSignaling
import app.nexa.data.signaling.SignalingChannel
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * ONLINE flavor wiring. Call SDP/ICE travels over the cloud (Socket.IO backend),
 * so the transport-agnostic [SignalingChannel] resolves to [CloudSignaling].
 * The offline flavor provides its own binding (LanSignaling) in its source set.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class SignalingModule {
    @Binds
    @Singleton
    abstract fun bindSignalingChannel(impl: CloudSignaling): SignalingChannel
}

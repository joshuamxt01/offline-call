package app.nexa.di

import app.nexa.data.signaling.LanSignaling
import app.nexa.data.signaling.SignalingChannel
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * OFFLINE flavor wiring. Call SDP/ICE travels over a direct LAN socket (no
 * server, host ICE candidates only), so the transport-agnostic
 * [SignalingChannel] resolves to [LanSignaling]. The online flavor provides its
 * own binding (CloudSignaling) in its source set.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class SignalingModule {
    @Binds
    @Singleton
    abstract fun bindSignalingChannel(impl: LanSignaling): SignalingChannel
}

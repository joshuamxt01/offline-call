package app.nexa.offline

import androidx.lifecycle.ViewModel
import app.nexa.data.discovery.LanPeer
import app.nexa.data.discovery.NsdDiscovery
import app.nexa.data.local.SecureStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID
import javax.inject.Inject

/**
 * Drives the offline (LAN) home: gives this device a local identity (no cloud
 * account needed), advertises it on the local network, and lists nearby Nexa
 * devices discovered over mDNS. Placing a LAN call comes in the next increment.
 */
@HiltViewModel
class OfflineHomeViewModel @Inject constructor(
    private val nsd: NsdDiscovery,
    private val store: SecureStore,
) : ViewModel() {

    private val _myName = MutableStateFlow("")
    val myName: StateFlow<String> = _myName.asStateFlow()

    /** Nearby devices discovered on the LAN (from the discovery engine). */
    val peers: StateFlow<List<LanPeer>> = nsd.peers

    init {
        ensureLocalIdentity()
        broadcast()
    }

    /** Offline has no server/accounts — mint a stable local identity on first run. */
    private fun ensureLocalIdentity() {
        if (store.deviceId.isNullOrBlank()) {
            val id = UUID.randomUUID().toString()
            store.deviceId = id
            store.userId = id // on the LAN, this device IS the identity
        }
        if (store.username.isNullOrBlank()) {
            store.username = "Device-" + (store.deviceId?.take(4) ?: "0000")
        }
        store.identity() // ensure the E2EE keypair exists
        _myName.value = store.username ?: ""
    }

    private fun broadcast() {
        runCatching {
            nsd.advertise(LAN_PORT)
            nsd.startDiscovery()
        }
    }

    fun setName(name: String) {
        val clean = name.trim()
        if (clean.isBlank()) return
        store.username = clean
        _myName.value = clean
        // Re-announce under the new name.
        runCatching {
            nsd.stop()
            nsd.advertise(LAN_PORT)
            nsd.startDiscovery()
        }
    }

    override fun onCleared() {
        runCatching { nsd.stop() }
        super.onCleared()
    }

    companion object {
        /** Port this device will host LAN calls on (used when calling is wired). */
        const val LAN_PORT = 8765
    }
}

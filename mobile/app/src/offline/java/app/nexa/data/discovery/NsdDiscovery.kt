package app.nexa.data.discovery

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import app.nexa.data.local.SecureStore
import app.nexa.data.protocol.LanProtocol
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject
import javax.inject.Singleton

/** A peer discovered on the local network (offline mode). */
data class LanPeer(
    val userId: String,
    val deviceId: String,
    val name: String,
    val host: String,
    val port: Int,
    val publicKey: String?,
)

/**
 * mDNS / DNS-SD discovery of nearby Nexa devices via Android NsdManager.
 * Advertises this device's identity (in TXT records) and resolves peers so the
 * app can place calls/messages over the LAN with no internet.
 * See docs/06-OFFLINE-HYBRID.md.
 */
@Singleton
class NsdDiscovery @Inject constructor(
    @ApplicationContext private val context: Context,
    private val store: SecureStore,
) {
    private val nsd: NsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager

    private val _peers = MutableStateFlow<List<LanPeer>>(emptyList())
    val peers: StateFlow<List<LanPeer>> = _peers

    private var registrationListener: NsdManager.RegistrationListener? = null
    private var discoveryListener: NsdManager.DiscoveryListener? = null

    /** Advertise this device on the LAN so peers can find us. */
    fun advertise(localPort: Int) {
        val identity = store.identity()
        val info = NsdServiceInfo().apply {
            serviceName = "nexa-${store.deviceId?.take(8) ?: "device"}"
            serviceType = LanProtocol.SERVICE_TYPE
            port = localPort
            setAttribute("uid", store.userId ?: "")
            setAttribute("did", store.deviceId ?: "")
            setAttribute("name", store.username ?: "")
            setAttribute("ipk", identity.publicKey)
            setAttribute("ver", LanProtocol.VERSION.toString())
        }
        val listener = object : NsdManager.RegistrationListener {
            override fun onServiceRegistered(p0: NsdServiceInfo?) {}
            override fun onRegistrationFailed(p0: NsdServiceInfo?, p1: Int) {}
            override fun onServiceUnregistered(p0: NsdServiceInfo?) {}
            override fun onUnregistrationFailed(p0: NsdServiceInfo?, p1: Int) {}
        }
        registrationListener = listener
        nsd.registerService(info, NsdManager.PROTOCOL_DNS_SD, listener)
    }

    /** Start discovering peers; resolved peers appear in [peers]. */
    fun startDiscovery() {
        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(p0: String?) {}
            override fun onServiceFound(info: NsdServiceInfo) {
                if (info.serviceType.contains("nexa")) resolve(info)
            }
            override fun onServiceLost(info: NsdServiceInfo) {
                _peers.value = _peers.value.filterNot { it.name == info.serviceName }
            }
            override fun onDiscoveryStopped(p0: String?) {}
            override fun onStartDiscoveryFailed(p0: String?, p1: Int) {}
            override fun onStopDiscoveryFailed(p0: String?, p1: Int) {}
        }
        discoveryListener = listener
        nsd.discoverServices(LanProtocol.SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
    }

    private fun resolve(info: NsdServiceInfo) {
        nsd.resolveService(info, object : NsdManager.ResolveListener {
            override fun onResolveFailed(p0: NsdServiceInfo?, p1: Int) {}
            override fun onServiceResolved(resolved: NsdServiceInfo) {
                val attrs = resolved.attributes
                fun attr(k: String) = attrs[k]?.toString(Charsets.UTF_8)
                val uid = attr("uid") ?: return
                if (uid == store.userId) return // don't list ourselves
                val peer = LanPeer(
                    userId = uid,
                    deviceId = attr("did") ?: "",
                    name = attr("name") ?: resolved.serviceName,
                    host = resolved.host?.hostAddress ?: return,
                    port = resolved.port,
                    publicKey = attr("ipk"),
                )
                _peers.value = (_peers.value.filterNot { it.deviceId == peer.deviceId } + peer)
            }
        })
    }

    fun stop() {
        registrationListener?.let { runCatching { nsd.unregisterService(it) } }
        discoveryListener?.let { runCatching { nsd.stopServiceDiscovery(it) } }
        registrationListener = null
        discoveryListener = null
        _peers.value = emptyList()
    }
}

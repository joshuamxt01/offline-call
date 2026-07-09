package app.nexa.data

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Tracks whether the device is on ANY network (Wi-Fi / cellular / ethernet),
 * regardless of internet reachability — so we can tell "Local Mode" (on a LAN
 * but backend unreachable) apart from "Offline" (no network at all).
 */
@Singleton
class NetworkMonitor @Inject constructor(@ApplicationContext context: Context) {
    private val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val _hasNetwork = MutableStateFlow(currentlyConnected())
    val hasNetwork: StateFlow<Boolean> = _hasNetwork

    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) { _hasNetwork.value = true }
        override fun onLost(network: Network) { _hasNetwork.value = currentlyConnected() }
        override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
            _hasNetwork.value = true
        }
    }

    init {
        runCatching { cm.registerDefaultNetworkCallback(callback) }
    }

    private fun currentlyConnected(): Boolean {
        val active = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(active) ?: return false
        return caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
    }
}

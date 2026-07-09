package app.nexa.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.nexa.data.NetworkMonitor
import app.nexa.data.realtime.SocketManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

/** Communication mode shown in the top strip — mirrors the web badge. */
enum class AppMode(val label: String, val color: Color) {
    ONLINE("Online Mode", Color(0xFF2FA84F)),
    LOCAL("Local Mode", Color(0xFF3B82F6)),
    OFFLINE("Offline", Color(0xFFE24141)),
}

@HiltViewModel
class ModeViewModel @Inject constructor(
    socket: SocketManager,
    network: NetworkMonitor,
) : ViewModel() {
    /** online = backend reachable; local = on a network but backend unreachable; offline = no network. */
    val mode: StateFlow<AppMode> =
        combine(socket.connected, network.hasNetwork) { connected, hasNet ->
            when {
                connected -> AppMode.ONLINE
                hasNet -> AppMode.LOCAL
                else -> AppMode.OFFLINE
            }
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AppMode.LOCAL)
}

@Composable
fun ModeBadge(vm: ModeViewModel = hiltViewModel()) {
    val mode by vm.mode.collectAsStateWithLifecycle()
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(mode.color.copy(alpha = 0.12f))
            .padding(horizontal = 10.dp, vertical = 5.dp),
    ) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(mode.color))
        Spacer(Modifier.width(6.dp))
        Text(mode.label, color = mode.color, style = MaterialTheme.typography.labelSmall)
    }
}

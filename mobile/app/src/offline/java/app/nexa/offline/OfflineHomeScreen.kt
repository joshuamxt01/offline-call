package app.nexa.offline

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.nexa.data.discovery.LanPeer

/**
 * Offline home: your local identity + the Nexa devices found on this network.
 * No internet, no account — everything here is local to the Wi-Fi/LAN.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OfflineHomeScreen(vm: OfflineHomeViewModel = hiltViewModel()) {
    val myName by vm.myName.collectAsStateWithLifecycle()
    val peers by vm.peers.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Nexa · Offline", style = MaterialTheme.typography.titleLarge)
                        Text(
                            "Local network • no internet",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
            )
        },
    ) { pad ->
        Column(
            Modifier.padding(pad).fillMaxSize().padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            IdentityCard(name = myName, onRename = vm::setName)

            Text(
                "Nearby devices",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(top = 8.dp),
            )

            if (peers.isEmpty()) {
                EmptyState()
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(peers, key = { it.deviceId }) { peer -> PeerRow(peer) }
                }
            }
        }
    }
}

@Composable
private fun IdentityCard(name: String, onRename: (String) -> Unit) {
    var editing by remember { mutableStateOf(false) }
    var draft by remember(name) { mutableStateOf(name) }

    Card(shape = RoundedCornerShape(18.dp)) {
        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Box(
                Modifier.size(48.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center,
            ) { Text(name.take(1).uppercase().ifBlank { "?" }, style = MaterialTheme.typography.titleLarge) }

            if (editing) {
                OutlinedTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    singleLine = true,
                    label = { Text("Your name on this network") },
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = { onRename(draft); editing = false }) {
                    Icon(Icons.Default.Check, "Save")
                }
            } else {
                Column(Modifier.weight(1f)) {
                    Text("You", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(name.ifBlank { "Unnamed device" }, style = MaterialTheme.typography.titleMedium)
                }
                IconButton(onClick = { draft = name; editing = true }) {
                    Icon(Icons.Default.Edit, "Rename")
                }
            }
        }
    }
}

@Composable
private fun PeerRow(peer: LanPeer) {
    Card(shape = RoundedCornerShape(16.dp)) {
        Row(
            Modifier.fillMaxWidth().padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Box(
                Modifier.size(44.dp).clip(CircleShape).background(MaterialTheme.colorScheme.secondaryContainer),
                contentAlignment = Alignment.Center,
            ) { Text(peer.name.take(1).uppercase().ifBlank { "?" }, style = MaterialTheme.typography.titleMedium) }

            Column(Modifier.weight(1f)) {
                Text(peer.name, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    "${peer.host}:${peer.port}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            // Calling is wired in the next increment.
            AssistChip(onClick = {}, enabled = false, label = { Text("Call soon") })
        }
    }
}

@Composable
private fun EmptyState() {
    Column(
        Modifier.fillMaxWidth().padding(top = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(Icons.Default.Wifi, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(40.dp))
        Text("Searching the local network…", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            "Open Nexa · Offline on another phone on the same Wi-Fi and it'll appear here.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

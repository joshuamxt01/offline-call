package app.nexa.ui.contacts

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.nexa.domain.model.CallType
import app.nexa.domain.model.UiContact
import app.nexa.ui.common.Avatar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContactsScreen(
    onOpenChat: (convId: String, peerId: String, name: String) -> Unit,
    vm: ContactsViewModel = hiltViewModel(),
) {
    val contacts by vm.contactList.collectAsStateWithLifecycle()
    val accepted = contacts.filter { it.state == "accepted" }
    val incoming = contacts.filter { it.state == "pending" && it.incoming }
    val sent = contacts.filter { it.state == "pending" && !it.incoming }
    val favorites = accepted.filter { it.favorite }

    Column(Modifier.fillMaxSize()) {
        Text("Contacts", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(16.dp))
        OutlinedTextField(
            value = vm.query,
            onValueChange = vm::onQueryChange,
            placeholder = { Text("Search people by username…") },
            leadingIcon = { Icon(Icons.Default.Search, null) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        )
        Spacer(Modifier.height(8.dp))

        LazyColumn(Modifier.fillMaxSize()) {
            if (vm.searchResults.isNotEmpty()) {
                item { SectionHeader("Search results") }
                items(vm.searchResults) { u ->
                    ContactRow(name = u.displayName ?: u.username, sub = "@${u.username}") {
                        IconButton(onClick = { vm.add(u.id) }) { Icon(Icons.Default.PersonAdd, "Add") }
                    }
                }
            }
            if (incoming.isNotEmpty()) {
                item { SectionHeader("Requests (${incoming.size})") }
                items(incoming) { c ->
                    ContactRow(name = c.displayName, sub = "@${c.username} · wants to connect") {
                        IconButton(onClick = { vm.accept(c.contactId) }) { Icon(Icons.Default.Check, "Accept", tint = MaterialTheme.colorScheme.primary) }
                        IconButton(onClick = { vm.reject(c.contactId) }) { Icon(Icons.Default.Close, "Reject", tint = MaterialTheme.colorScheme.error) }
                    }
                }
            }
            if (sent.isNotEmpty()) {
                item { SectionHeader("Sent") }
                items(sent) { c ->
                    ContactRow(name = c.displayName, sub = "@${c.username} · pending") {
                        TextButton(onClick = { vm.cancel(c.contactId) }) { Text("Cancel") }
                    }
                }
            }
            if (favorites.isNotEmpty()) {
                item { SectionHeader("Favorites") }
                items(favorites) { c -> AcceptedRow(c, vm, onOpenChat) }
            }
            item { SectionHeader("My contacts") }
            if (accepted.isEmpty()) {
                item {
                    Text(
                        "No contacts yet. Search above to add people.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(16.dp),
                    )
                }
            }
            items(accepted) { c -> AcceptedRow(c, vm, onOpenChat) }
        }
    }
}

private fun presenceLabel(c: UiContact): String = when (c.presence) {
    "online" -> "Online"
    "busy" -> "Busy"
    "away" -> "Away"
    "in_call" -> "In a call"
    "local" -> "Local Network"
    else -> if (c.online) "Online" else "Offline"
}

@Composable
private fun AcceptedRow(
    c: UiContact,
    vm: ContactsViewModel,
    onOpenChat: (convId: String, peerId: String, name: String) -> Unit,
) {
    var menu by remember { mutableStateOf(false) }
    ContactRow(name = c.displayName, sub = presenceLabel(c), online = c.online) {
        IconButton(onClick = { vm.openChat(c, onOpenChat) }) { Icon(Icons.Default.Chat, "Message") }
        IconButton(onClick = { vm.startCall(c, CallType.VOICE) }) { Icon(Icons.Default.Call, "Voice call") }
        IconButton(onClick = { vm.startCall(c, CallType.VIDEO) }) { Icon(Icons.Default.Videocam, "Video call") }
        Box {
            IconButton(onClick = { menu = true }) { Icon(Icons.Default.MoreVert, "More") }
            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                DropdownMenuItem(
                    text = { Text(if (c.favorite) "Unfavorite" else "Favorite") },
                    onClick = { menu = false; vm.toggleFavorite(c) },
                )
                DropdownMenuItem(text = { Text("Block") }, onClick = { menu = false; vm.block(c) })
                DropdownMenuItem(text = { Text("Remove") }, onClick = { menu = false; vm.remove(c) })
            }
        }
    }
}

@Composable
private fun SectionHeader(text: String) {
    Text(
        text.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(start = 16.dp, top = 12.dp, bottom = 4.dp),
    )
}

@Composable
private fun ContactRow(name: String, sub: String, online: Boolean? = null, actions: @Composable RowScope.() -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(name = name, online = online)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(name, fontWeight = FontWeight.Medium)
            Text(sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        actions()
    }
}

package app.nexa.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import app.nexa.ui.calls.CallsScreen
import app.nexa.ui.chat.ChatListScreen
import app.nexa.ui.contacts.ContactsScreen
import app.nexa.ui.settings.SettingsScreen

private data class Tab(val label: String, val icon: ImageVector)

@Composable
fun HomeScreen(
    onOpenChat: (convId: String, peerId: String, name: String) -> Unit,
    onLoggedOut: () -> Unit,
) {
    val tabs = listOf(
        Tab("Chats", Icons.AutoMirrored.Filled.Chat),
        Tab("Contacts", Icons.Default.People),
        Tab("Calls", Icons.Default.Call),
        Tab("Settings", Icons.Default.Settings),
    )
    var selected by remember { mutableIntStateOf(0) }

    Scaffold(
        bottomBar = {
            NavigationBar {
                tabs.forEachIndexed { index, tab ->
                    NavigationBarItem(
                        selected = selected == index,
                        onClick = { selected = index },
                        icon = { Icon(tab.icon, tab.label) },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            // Top strip: auto-updating communication mode badge (Online/Local/Offline).
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.End,
            ) {
                ModeBadge()
            }
            androidx.compose.foundation.layout.Box(Modifier.weight(1f)) {
                when (selected) {
                    0 -> ChatListScreen(onOpenChat = onOpenChat)
                    1 -> ContactsScreen(onOpenChat = onOpenChat)
                    2 -> CallsScreen()
                    3 -> SettingsScreen(onLoggedOut = onLoggedOut)
                }
            }
        }
    }
}

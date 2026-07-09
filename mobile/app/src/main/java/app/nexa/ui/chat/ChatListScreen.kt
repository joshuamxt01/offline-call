package app.nexa.ui.chat

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.nexa.core.TimeUtil
import app.nexa.ui.common.Avatar
import app.nexa.ui.common.clickableNoRipple

@Composable
fun ChatListScreen(
    onOpenChat: (convId: String, peerId: String, name: String) -> Unit,
    vm: ChatListViewModel = hiltViewModel(),
) {
    val conversations by vm.conversations.collectAsStateWithLifecycle()

    Column(Modifier.fillMaxSize()) {
        Text("Chats", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(16.dp))
        if (conversations.isEmpty()) {
            Column(
                Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Icon(Icons.AutoMirrored.Filled.Chat, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(8.dp))
                Text("No conversations yet", fontWeight = FontWeight.SemiBold)
                Text("Start a chat from your contacts.", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
        } else {
            LazyColumn {
                items(conversations) { c ->
                    Row(
                        Modifier.fillMaxWidth()
                            .clickableNoRipple { onOpenChat(c.id, c.peerId, c.peerName) }
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Avatar(name = c.peerName, size = 50.dp)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(c.peerName, fontWeight = FontWeight.Medium)
                            Text(
                                c.lastText, maxLines = 1, overflow = TextOverflow.Ellipsis,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            if (c.lastAt > 0) {
                                Text(TimeUtil.formatTime(c.lastAt), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            if (c.unread > 0) {
                                Spacer(Modifier.height(4.dp))
                                Badge { Text(c.unread.toString()) }
                            }
                        }
                    }
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))
                }
            }
        }
    }
}

package app.nexa.ui.calls

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.CallMade
import androidx.compose.material.icons.automirrored.filled.CallMissed
import androidx.compose.material.icons.automirrored.filled.CallReceived
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.nexa.core.TimeUtil
import app.nexa.domain.model.UiCallHistory
import app.nexa.ui.theme.Success
import app.nexa.ui.theme.Teal

@Composable
fun CallsScreen(vm: CallsViewModel = hiltViewModel()) {
    val calls by vm.calls.collectAsStateWithLifecycle()

    Column(Modifier.fillMaxSize()) {
        Text("Calls", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(16.dp))
        if (calls.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No calls yet.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            LazyColumn { items(calls) { CallRow(it) } }
        }
    }
}

@Composable
private fun CallRow(call: UiCallHistory) {
    val missed = call.status == "missed" || call.status == "rejected"
    val icon = when {
        missed -> Icons.AutoMirrored.Filled.CallMissed
        call.outgoing -> Icons.AutoMirrored.Filled.CallMade
        else -> Icons.AutoMirrored.Filled.CallReceived
    }
    val tint = when {
        missed -> MaterialTheme.colorScheme.error
        call.outgoing -> Teal
        else -> Success
    }
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(40.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center,
        ) { Icon(icon, null, tint = tint, modifier = Modifier.size(20.dp)) }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (call.type == "video") { Icon(Icons.Default.Videocam, null, Modifier.size(15.dp)); Spacer(Modifier.width(4.dp)) }
                Text("${if (call.outgoing) "Outgoing" else "Incoming"} ${call.type} call", fontWeight = FontWeight.Medium)
                call.transport?.let {
                    Spacer(Modifier.width(6.dp))
                    AssistChip(onClick = {}, label = { Text(it, style = MaterialTheme.typography.labelSmall) })
                }
            }
            Text(
                "${TimeUtil.formatTime(call.startedAt)}" + (call.durationSeconds?.let { " · ${TimeUtil.formatDuration(it)}" } ?: ""),
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

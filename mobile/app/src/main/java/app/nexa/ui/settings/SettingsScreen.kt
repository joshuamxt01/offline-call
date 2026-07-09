package app.nexa.ui.settings

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.nexa.ui.common.Avatar

@Composable
fun SettingsScreen(
    onLoggedOut: () -> Unit,
    vm: SettingsViewModel = hiltViewModel(),
) {
    val devices by vm.devices.collectAsStateWithLifecycle()
    val privacy by vm.privacy.collectAsStateWithLifecycle()
    val ringtone by vm.ringtone.collectAsStateWithLifecycle()
    val customRingtoneName by vm.customRingtoneName.collectAsStateWithLifecycle()

    val context = LocalContext.current
    val pickAudio = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            vm.setCustomRingtone(uri.toString(), queryDisplayName(context, uri))
        }
    }
    // Stop any running preview when leaving Settings.
    DisposableEffect(Unit) { onDispose { vm.stopPreview() } }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
        Text("Settings", style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(16.dp))

        // Profile
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(name = vm.username, size = 64.dp)
            Spacer(Modifier.width(16.dp))
            Column {
                Text(vm.username, style = MaterialTheme.typography.titleMedium)
                Text("@${vm.username}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
        }
        Spacer(Modifier.height(20.dp))

        // Security
        ElevatedCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Lock, null, tint = MaterialTheme.colorScheme.secondary)
                    Spacer(Modifier.width(8.dp))
                    Text("Security", fontWeight = FontWeight.SemiBold)
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    "Messages are end-to-end encrypted with a key that never leaves this device.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(10.dp))
                Text("Identity key fingerprint", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(vm.fingerprint, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall)
            }
        }
        Spacer(Modifier.height(16.dp))

        // Privacy
        ElevatedCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text("Privacy", fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(4.dp))
                Text(
                    "Who can find and contact you.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("public" to "Public", "contacts_only" to "Contacts", "private" to "Private").forEach { (value, label) ->
                        FilterChip(
                            selected = privacy == value,
                            onClick = { vm.setPrivacy(value) },
                            label = { Text(label) },
                        )
                    }
                }
                Spacer(Modifier.height(10.dp))
                Button(onClick = { vm.savePrivacy() }) { Text("Save privacy") }
            }
        }
        Spacer(Modifier.height(16.dp))

        // Ringtone
        ElevatedCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Notifications, null, tint = MaterialTheme.colorScheme.secondary)
                    Spacer(Modifier.width(8.dp))
                    Text("Ringtone", fontWeight = FontWeight.SemiBold)
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    "Plays when someone calls you. Tap one to hear a preview.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(6.dp))
                vm.ringtoneOptions.forEach { (id, label) ->
                    RingtoneRow(label = label, selected = ringtone == id) { vm.selectRingtone(id) }
                }
                customRingtoneName?.let { name ->
                    RingtoneRow(label = name, selected = ringtone == "custom") { vm.selectRingtone("custom") }
                }
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = { pickAudio.launch(arrayOf("audio/*")) }) {
                    Icon(Icons.Default.Add, null)
                    Spacer(Modifier.width(6.dp))
                    Text("Pick from device")
                }
            }
        }
        Spacer(Modifier.height(16.dp))

        // Devices
        Text("Connected devices", fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(8.dp))
        devices.forEach { d ->
            ListItem(
                leadingContent = { Icon(Icons.Default.PhoneAndroid, null) },
                headlineContent = { Text(d.deviceName ?: "Device") },
                supportingContent = {
                    Row {
                        AssistChip(onClick = {}, label = { Text(d.platform) })
                        if (d.id == vm.deviceId) { Spacer(Modifier.width(6.dp)); AssistChip(onClick = {}, label = { Text("This device") }) }
                    }
                },
                trailingContent = {
                    if (d.id != vm.deviceId) {
                        IconButton(onClick = { vm.revoke(d.id) }) { Icon(Icons.Default.Delete, "Revoke", tint = MaterialTheme.colorScheme.error) }
                    }
                },
            )
        }

        Spacer(Modifier.height(24.dp))
        Button(
            onClick = { vm.logout(onLoggedOut) },
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Icon(Icons.AutoMirrored.Filled.Logout, null)
            Spacer(Modifier.width(8.dp))
            Text("Log out")
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun RingtoneRow(label: String, selected: Boolean, onSelect: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onSelect).padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RadioButton(selected = selected, onClick = onSelect)
        Spacer(Modifier.width(4.dp))
        Text(label, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        Icon(Icons.Default.PlayArrow, contentDescription = "Preview", tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** Reads the human-readable file name of a picked content Uri (for the custom ringtone label). */
private fun queryDisplayName(context: Context, uri: Uri): String? = runCatching {
    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
        if (c.moveToFirst()) c.getString(0) else null
    }
}.getOrNull()

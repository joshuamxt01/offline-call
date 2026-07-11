package app.nexa.ui.update

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.nexa.data.update.UpdateManager
import app.nexa.data.update.UpdateManager.Phase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class UpdateViewModel @Inject constructor(
    private val updates: UpdateManager,
) : ViewModel() {
    val available = updates.available
    val progress = updates.progress

    fun check() = viewModelScope.launch { updates.check() }
    fun download() = updates.downloadAndInstall()
    fun install() = updates.installDownloaded()
    fun dismiss() { updates.dismiss(); updates.resetProgress() }
}

/**
 * Silently checks for an update when shown; if one is available, prompts the user
 * to download & install it in place, showing live progress (downloading, the
 * "allow installs" permission step, and errors). Rendered once at the app root.
 */
@Composable
fun UpdateGate(vm: UpdateViewModel = hiltViewModel()) {
    val info by vm.available.collectAsStateWithLifecycle()
    val progress by vm.progress.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.check() }

    val update = info ?: return
    val busy = progress.phase == Phase.DOWNLOADING || progress.phase == Phase.INSTALLING

    AlertDialog(
        onDismissRequest = { if (!busy) vm.dismiss() },
        title = { Text(if (progress.phase == Phase.FAILED) "Update failed" else "Update available") },
        text = {
            when (progress.phase) {
                Phase.DOWNLOADING, Phase.INSTALLING -> Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(strokeWidth = 2.dp)
                    Spacer(Modifier.width(12.dp))
                    Text(progress.message ?: "Working…")
                }
                Phase.NEEDS_PERMISSION -> Text(
                    progress.message
                        ?: "Allow Nexa to install apps, then come back and tap Install.",
                )
                Phase.FAILED -> Text(
                    progress.message ?: "Something went wrong. Please try again.",
                )
                Phase.IDLE -> Text(
                    buildString {
                        append("A new version of Nexa")
                        if (update.versionName.isNotBlank()) append(" (${update.versionName})")
                        append(" is ready.")
                        if (update.notes.isNotBlank()) append("\n\n${update.notes}")
                        append("\n\nDownload and install it now? Your data stays — it updates in place.")
                    },
                )
            }
        },
        confirmButton = {
            when (progress.phase) {
                Phase.IDLE -> TextButton(onClick = { vm.download() }) { Text("Update now") }
                Phase.NEEDS_PERMISSION -> TextButton(onClick = { vm.install() }) { Text("Install") }
                Phase.FAILED -> TextButton(onClick = { vm.download() }) { Text("Try again") }
                Phase.DOWNLOADING, Phase.INSTALLING -> {} // no action while busy
            }
        },
        dismissButton = {
            if (!busy) TextButton(onClick = { vm.dismiss() }) {
                Text(if (progress.phase == Phase.IDLE) "Later" else "Close")
            }
        },
    )
}

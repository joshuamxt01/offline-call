package app.nexa.ui.update

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.nexa.data.update.UpdateManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class UpdateViewModel @Inject constructor(
    private val updates: UpdateManager,
) : ViewModel() {
    val available = updates.available

    fun check() = viewModelScope.launch { updates.check() }
    fun install() = updates.downloadAndInstall()
    fun dismiss() = updates.dismiss()
}

/**
 * Silently checks for an update when shown; if one is available, prompts the user
 * to download & install it in place. Rendered once at the app root.
 */
@Composable
fun UpdateGate(vm: UpdateViewModel = hiltViewModel()) {
    val info by vm.available.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.check() }

    val update = info ?: return
    AlertDialog(
        onDismissRequest = { vm.dismiss() },
        title = { Text("Update available") },
        text = {
            Text(
                buildString {
                    append("A new version of Nexa")
                    if (update.versionName.isNotBlank()) append(" (${update.versionName})")
                    append(" is ready.")
                    if (update.notes.isNotBlank()) append("\n\n${update.notes}")
                    append("\n\nDownload and install it now? Your data stays — it updates in place.")
                },
            )
        },
        confirmButton = {
            TextButton(onClick = { vm.install(); vm.dismiss() }) { Text("Update now") }
        },
        dismissButton = {
            TextButton(onClick = { vm.dismiss() }) { Text("Later") }
        },
    )
}

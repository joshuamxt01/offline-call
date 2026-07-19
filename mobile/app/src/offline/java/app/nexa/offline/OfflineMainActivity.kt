package app.nexa.offline

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.LaunchedEffect
import app.nexa.ui.theme.NexaTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * Launcher for the OFFLINE app (app.nexa.offline). No login, no cloud — it opens
 * straight into LAN discovery. Kept entirely separate from the online app's
 * MainActivity so the two builds don't share entry-point logic.
 */
@AndroidEntryPoint
class OfflineMainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            NexaTheme {
                // NSD peer discovery needs nearby-devices (Android 13+) or location.
                val launcher = rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestMultiplePermissions(),
                ) { /* discovery still runs with whatever is granted */ }
                LaunchedEffect(Unit) { launcher.launch(requiredPermissions()) }

                OfflineHomeScreen()
            }
        }
    }

    private fun requiredPermissions(): Array<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(Manifest.permission.NEARBY_WIFI_DEVICES)
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }
}

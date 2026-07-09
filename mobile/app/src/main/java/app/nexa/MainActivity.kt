package app.nexa

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.navigation.compose.rememberNavController
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.nexa.data.repository.AuthRepository
import app.nexa.data.repository.CallManager
import app.nexa.service.CallForegroundService
import app.nexa.ui.navigation.NexaNavHost
import app.nexa.ui.theme.NexaTheme
import app.nexa.ui.update.UpdateGate
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var authRepository: AuthRepository
    @Inject lateinit var callManager: CallManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Allow the incoming-call full-screen intent to show over the lock screen.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }

        // Reconnect realtime if a session already exists.
        authRepository.bootstrapSocket()
        handleCallAction(intent)

        setContent {
            NexaTheme {
                val loggedIn by authRepository.loggedIn.collectAsStateWithLifecycle()
                val navController = rememberNavController()

                val permissionLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestMultiplePermissions(),
                ) { /* results handled per-feature at call/record time */ }

                LaunchedEffect(Unit) { permissionLauncher.launch(requiredPermissions()) }

                NexaNavHost(navController = navController, startLoggedIn = loggedIn)
                if (loggedIn) UpdateGate() // prompts if the server advertises a newer version
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleCallAction(intent)
    }

    /** "Answer" tapped on the incoming-call notification -> accept the call. */
    private fun handleCallAction(intent: Intent?) {
        if (intent?.action == CallForegroundService.ACTION_ANSWER) {
            callManager.accept()
        }
    }

    private fun requiredPermissions(): Array<String> {
        val perms = mutableListOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms += Manifest.permission.POST_NOTIFICATIONS
            perms += Manifest.permission.NEARBY_WIFI_DEVICES
        } else {
            perms += Manifest.permission.ACCESS_FINE_LOCATION
        }
        return perms.toTypedArray()
    }
}

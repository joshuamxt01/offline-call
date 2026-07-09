package app.nexa.ui.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import app.nexa.ui.common.clickableNoRipple

@Composable
fun LoginScreen(
    onLoggedIn: () -> Unit,
    onGoToRegister: () -> Unit,
    vm: AuthViewModel = hiltViewModel(),
) {
    var id by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val state = vm.state

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Welcome back", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(4.dp))
        Text("Log in to continue to Nexa.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(24.dp))

        OutlinedTextField(
            value = id, onValueChange = { id = it },
            label = { Text("Email or username") },
            singleLine = true, modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = password, onValueChange = { password = it },
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth(),
        )

        state.error?.let {
            Spacer(Modifier.height(8.dp))
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        Spacer(Modifier.height(20.dp))
        Button(
            onClick = { vm.login(id.trim(), password) { onLoggedIn() } },
            enabled = !state.loading && id.isNotBlank() && password.isNotBlank(),
            modifier = Modifier.fillMaxWidth().height(50.dp),
        ) {
            if (state.loading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
            else Text("Log in")
        }

        Spacer(Modifier.height(16.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            Text("New here? ", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("Create an account", color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.clickableNoRipple(onGoToRegister))
        }

        // Server address — set once so the app knows where your backend is.
        var showServer by remember { mutableStateOf(false) }
        // Auto-open server settings when a connection error happens — that's almost
        // always a wrong/unreachable server address (the #1 login problem).
        LaunchedEffect(state.error) {
            val e = state.error?.lowercase().orEmpty()
            if (e.contains("connect") || e.contains("timeout") || e.contains("reach") ||
                e.contains("failed to") || e.contains("timed out") || e.contains("network")
            ) {
                showServer = true
            }
        }
        Spacer(Modifier.height(20.dp))
        Text(
            if (showServer) "Hide server settings" else "Server settings",
            color = MaterialTheme.colorScheme.primary,
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.align(Alignment.CenterHorizontally).clickableNoRipple { showServer = !showServer },
        )
        if (showServer) {
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = vm.serverUrl,
                onValueChange = { vm.onServerUrlChange(it) },
                label = { Text("Server address") },
                placeholder = { Text("https://your-tunnel.trycloudflare.com  or  http://192.168.x.x:4000") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(4.dp))
            Text(
                "Where your backend is reachable:\n" +
                    "• Over the internet: the https tunnel address (works on mobile data).\n" +
                    "• Same Wi-Fi as the server PC: http://<PC-IP>:4000 (offline mode).\n" +
                    "Paste the address, then tap Log in again.",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(Modifier.height(20.dp))
    }
}

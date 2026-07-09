package app.nexa.ui.navigation

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import app.nexa.ui.auth.LoginScreen
import app.nexa.ui.auth.RegisterScreen
import app.nexa.ui.call.CallOverlay
import app.nexa.ui.chat.ChatScreen
import app.nexa.ui.home.HomeScreen

object Routes {
    const val LOGIN = "login"
    const val REGISTER = "register"
    const val HOME = "home"
    const val CHAT = "chat/{convId}?peerId={peerId}&peerName={peerName}"
    fun chat(convId: String, peerId: String, peerName: String) =
        "chat/$convId?peerId=$peerId&peerName=$peerName"
}

@Composable
fun NexaNavHost(navController: NavHostController, startLoggedIn: Boolean) {
    Box(Modifier.fillMaxSize()) {
        NavHost(
            navController = navController,
            startDestination = if (startLoggedIn) Routes.HOME else Routes.LOGIN,
        ) {
            composable(Routes.LOGIN) {
                LoginScreen(
                    onLoggedIn = { navController.navigate(Routes.HOME) { popUpTo(Routes.LOGIN) { inclusive = true } } },
                    onGoToRegister = { navController.navigate(Routes.REGISTER) },
                )
            }
            composable(Routes.REGISTER) {
                RegisterScreen(
                    onRegistered = { navController.navigate(Routes.HOME) { popUpTo(Routes.LOGIN) { inclusive = true } } },
                    onGoToLogin = { navController.popBackStack() },
                )
            }
            composable(Routes.HOME) {
                HomeScreen(
                    onOpenChat = { convId, peerId, name -> navController.navigate(Routes.chat(convId, peerId, name)) },
                    onLoggedOut = { navController.navigate(Routes.LOGIN) { popUpTo(0) } },
                )
            }
            composable(
                Routes.CHAT,
                arguments = listOf(
                    navArgument("convId") { type = NavType.StringType },
                    navArgument("peerId") { type = NavType.StringType; defaultValue = "" },
                    navArgument("peerName") { type = NavType.StringType; defaultValue = "Conversation" },
                ),
            ) {
                ChatScreen(onBack = { navController.popBackStack() })
            }
        }

        // Full-screen call UI overlays everything when a call is active.
        CallOverlay()
    }
}

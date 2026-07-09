package app.nexa.ui.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.nexa.core.ApiResult
import app.nexa.data.local.SecureStore
import app.nexa.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val loading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val repo: AuthRepository,
    private val store: SecureStore,
) : ViewModel() {

    var state by mutableStateOf(AuthUiState())
        private set

    /** Backend address — editable so one APK works on any network. */
    var serverUrl by mutableStateOf(store.serverUrl)
        private set

    fun onServerUrlChange(v: String) {
        serverUrl = v
        store.serverUrl = v
    }

    fun login(emailOrUsername: String, password: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            state = AuthUiState(loading = true)
            when (val r = repo.login(emailOrUsername, password)) {
                is ApiResult.Success -> { state = AuthUiState(); onSuccess() }
                is ApiResult.Error -> state = AuthUiState(error = r.message)
            }
        }
    }

    fun register(username: String, email: String, password: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            state = AuthUiState(loading = true)
            when (val r = repo.register(username, email, password)) {
                is ApiResult.Success -> { state = AuthUiState(); onSuccess() }
                is ApiResult.Error -> state = AuthUiState(error = r.message)
            }
        }
    }
}

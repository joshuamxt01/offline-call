package app.nexa.ui.calls

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.nexa.core.TimeUtil
import app.nexa.data.local.SecureStore
import app.nexa.data.remote.ApiService
import app.nexa.domain.model.UiCallHistory
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class CallsViewModel @Inject constructor(
    private val api: ApiService,
    private val store: SecureStore,
) : ViewModel() {
    private val _calls = MutableStateFlow<List<UiCallHistory>>(emptyList())
    val calls: StateFlow<List<UiCallHistory>> = _calls

    init { refresh() }

    fun refresh() = viewModelScope.launch {
        val me = store.userId
        val remote = runCatching { api.calls().data }.getOrNull() ?: return@launch
        _calls.value = remote.map {
            UiCallHistory(
                id = it.id, type = it.type, status = it.status, transport = it.transport,
                outgoing = it.callerId == me,
                startedAt = TimeUtil.parseIso(it.startedAt), durationSeconds = it.durationSeconds,
            )
        }
    }
}

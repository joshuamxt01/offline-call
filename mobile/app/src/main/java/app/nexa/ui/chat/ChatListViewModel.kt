package app.nexa.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.nexa.data.repository.ChatRepository
import app.nexa.domain.model.UiConversation
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ChatListViewModel @Inject constructor(
    private val chat: ChatRepository,
) : ViewModel() {
    val conversations: StateFlow<List<UiConversation>> =
        chat.observeConversations().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        viewModelScope.launch { chat.refreshConversations() }
    }
}

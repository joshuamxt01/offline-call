package app.nexa.ui.contacts

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.nexa.core.ApiResult
import app.nexa.data.protocol.UserDto
import app.nexa.data.realtime.SocketManager
import app.nexa.data.repository.CallManager
import app.nexa.data.repository.ChatRepository
import app.nexa.data.repository.ContactsRepository
import app.nexa.domain.model.CallType
import app.nexa.domain.model.UiContact
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ContactsViewModel @Inject constructor(
    private val contacts: ContactsRepository,
    private val chat: ChatRepository,
    private val callManager: CallManager,
    socket: SocketManager,
) : ViewModel() {

    val contactList: StateFlow<List<UiContact>> =
        contacts.observe().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    var query by mutableStateOf("")
        private set
    var searchResults by mutableStateOf<List<UserDto>>(emptyList())
        private set

    init {
        viewModelScope.launch { contacts.refresh() }
        viewModelScope.launch { socket.presenceEvents.collect { contacts.refresh() } }
    }

    fun onQueryChange(q: String) {
        query = q
        if (q.trim().length >= 2) {
            viewModelScope.launch {
                when (val r = contacts.search(q.trim())) {
                    is ApiResult.Success -> searchResults = r.data
                    is ApiResult.Error -> searchResults = emptyList()
                }
            }
        } else searchResults = emptyList()
    }

    fun add(userId: String) = viewModelScope.launch {
        contacts.add(userId); contacts.refresh(); query = ""; searchResults = emptyList()
    }

    fun accept(contactId: String) = viewModelScope.launch { contacts.accept(contactId); contacts.refresh() }
    fun reject(contactId: String) = viewModelScope.launch { contacts.reject(contactId); contacts.refresh() }
    fun cancel(contactId: String) = viewModelScope.launch { contacts.cancel(contactId); contacts.refresh() }
    fun toggleFavorite(c: UiContact) = viewModelScope.launch { contacts.setFavorite(c.contactId, !c.favorite); contacts.refresh() }
    fun block(c: UiContact) = viewModelScope.launch { contacts.blockUser(c.userId); contacts.refresh() }
    fun remove(c: UiContact) = viewModelScope.launch { contacts.remove(c.contactId); contacts.refresh() }

    fun startCall(contact: UiContact, type: CallType) =
        callManager.startCall(contact.userId, contact.displayName, type)

    fun openChat(contact: UiContact, onReady: (convId: String, peerId: String, name: String) -> Unit) {
        viewModelScope.launch {
            val id = chat.getOrCreateConversation(contact.userId, contact.displayName)
            if (id != null) onReady(id, contact.userId, contact.displayName)
        }
    }
}

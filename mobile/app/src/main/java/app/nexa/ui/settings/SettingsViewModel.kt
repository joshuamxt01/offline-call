package app.nexa.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.nexa.data.local.SecureStore
import app.nexa.data.protocol.DeviceDto
import app.nexa.data.protocol.UpdateProfileRequest
import app.nexa.data.remote.ApiService
import app.nexa.data.repository.AuthRepository
import app.nexa.service.RingtonePlayer
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val auth: AuthRepository,
    private val api: ApiService,
    private val store: SecureStore,
    private val ringtonePlayer: RingtonePlayer,
) : ViewModel() {

    val username: String get() = store.username ?: "you"
    val deviceId: String? get() = store.deviceId
    val fingerprint: String get() = store.identity().publicKey.take(32)

    private val _devices = MutableStateFlow<List<DeviceDto>>(emptyList())
    val devices: StateFlow<List<DeviceDto>> = _devices

    private val _privacy = MutableStateFlow("public")
    val privacy: StateFlow<String> = _privacy

    val ringtoneOptions: List<Pair<String, String>> = RingtonePlayer.BUILTIN
    private val _ringtone = MutableStateFlow(store.ringtoneId)
    val ringtone: StateFlow<String> = _ringtone
    private val _customRingtoneName = MutableStateFlow(displayNameFor(store.customRingtoneUri))
    val customRingtoneName: StateFlow<String?> = _customRingtoneName

    /** Select a bundled tone and play a short preview. */
    fun selectRingtone(id: String) {
        store.ringtoneId = id
        _ringtone.value = id
        ringtonePlayer.previewTone(id, store.customRingtoneUri)
    }

    /** A file was picked from device storage — use it as the ringtone. */
    fun setCustomRingtone(uri: String, name: String?) {
        store.customRingtoneUri = uri
        store.ringtoneId = RingtonePlayer.CUSTOM
        _ringtone.value = RingtonePlayer.CUSTOM
        _customRingtoneName.value = name ?: "Custom sound"
        ringtonePlayer.previewTone(RingtonePlayer.CUSTOM, uri)
    }

    fun stopPreview() = ringtonePlayer.stopPreview()

    private fun displayNameFor(uri: String?): String? = if (uri.isNullOrBlank()) null else "Custom sound"

    init {
        refreshDevices()
        viewModelScope.launch {
            runCatching { api.me().user.privacy }.getOrNull()?.let { _privacy.value = it }
        }
    }

    fun setPrivacy(p: String) { _privacy.value = p }

    fun savePrivacy() = viewModelScope.launch {
        runCatching { api.updateProfile(UpdateProfileRequest(privacy = _privacy.value)) }
    }

    fun refreshDevices() = viewModelScope.launch {
        _devices.value = runCatching { api.devices().data }.getOrNull() ?: emptyList()
    }

    fun revoke(id: String) = viewModelScope.launch {
        runCatching { api.revokeDevice(id) }
        refreshDevices()
    }

    fun logout(onDone: () -> Unit) = viewModelScope.launch {
        auth.logout()
        onDone()
    }
}

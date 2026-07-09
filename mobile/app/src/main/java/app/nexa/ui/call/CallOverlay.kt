package app.nexa.ui.call

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.nexa.core.TimeUtil
import app.nexa.domain.model.CallStatus
import app.nexa.domain.model.CallType
import app.nexa.ui.common.Avatar
import org.webrtc.EglBase
import org.webrtc.RendererCommon
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoTrack

@Composable
fun CallOverlay(vm: CallViewModel = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    val local by vm.localVideo.collectAsStateWithLifecycle()
    val remote by vm.remoteVideo.collectAsStateWithLifecycle()
    if (!state.active) return

    val isVideo = state.type == CallType.VIDEO
    val showVideo = isVideo && state.status == CallStatus.CONNECTED

    var elapsed by remember { mutableStateOf(0) }
    LaunchedEffect(state.status, state.startedAt) {
        if (state.status == CallStatus.CONNECTED && state.startedAt != null) {
            while (true) {
                elapsed = ((System.currentTimeMillis() - state.startedAt!!) / 1000).toInt()
                kotlinx.coroutines.delay(1000)
            }
        }
    }

    Box(Modifier.fillMaxSize().background(Color(0xFF0A0E17))) {
        if (showVideo && remote != null) {
            VideoRenderer(track = remote!!, eglContext = vm.eglBaseContext, mirror = false, modifier = Modifier.fillMaxSize())
            if (local != null) {
                VideoRenderer(
                    track = local!!, eglContext = vm.eglBaseContext, mirror = true,
                    modifier = Modifier.align(Alignment.TopEnd).padding(16.dp).size(width = 110.dp, height = 160.dp).clip(RoundedCornerShape(16.dp)),
                )
            }
        } else {
            Column(
                Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Avatar(name = state.peerName ?: "Contact", size = 130.dp)
                Text(state.peerName ?: "Nexa contact", color = Color.White, style = MaterialTheme.typography.headlineMedium)
                Text(statusLabel(state.status, isVideo, elapsed), color = Color.White.copy(alpha = 0.75f))
            }
        }

        // Controls
        Row(
            Modifier.align(Alignment.BottomCenter).padding(bottom = 44.dp).fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
        ) {
            if (state.status == CallStatus.INCOMING) {
                CallButton(Icons.Default.CallEnd, Color(0xFFE24141), "Decline", onClick = vm::reject)
                Spacer(Modifier.width(56.dp))
                CallButton(Icons.Default.Call, Color(0xFF2FA84F), "Accept", onClick = vm::accept)
            } else {
                CallButton(if (state.muted) Icons.Default.MicOff else Icons.Default.Mic, Color.White.copy(0.16f), "Mute", onClick = vm::toggleMute)
                if (!isVideo) {
                    Spacer(Modifier.width(16.dp))
                    CallButton(if (state.speakerOn) Icons.Default.VolumeUp else Icons.Default.VolumeDown, Color.White.copy(0.16f), "Speaker", onClick = vm::toggleSpeaker)
                }
                if (isVideo) {
                    Spacer(Modifier.width(16.dp))
                    CallButton(if (state.cameraOff) Icons.Default.VideocamOff else Icons.Default.Videocam, Color.White.copy(0.16f), "Camera", onClick = vm::toggleCamera)
                    Spacer(Modifier.width(16.dp))
                    CallButton(Icons.Default.Cameraswitch, Color.White.copy(0.16f), "Flip", onClick = vm::switchCamera)
                }
                Spacer(Modifier.width(16.dp))
                CallButton(Icons.Default.CallEnd, Color(0xFFE24141), "End", onClick = vm::hangup)
            }
        }
    }
}

@Composable
private fun CallButton(icon: ImageVector, bg: Color, label: String, onClick: () -> Unit) {
    Box(
        Modifier.size(64.dp).clip(CircleShape).background(bg)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Icon(icon, label, tint = Color.White) }
}

@Composable
private fun VideoRenderer(track: VideoTrack, eglContext: EglBase.Context, mirror: Boolean, modifier: Modifier) {
    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            SurfaceViewRenderer(ctx).apply {
                init(eglContext, null)
                setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FILL)
                setMirror(mirror)
                setEnableHardwareScaler(true)
            }
        },
        update = { view -> track.addSink(view) },
        onRelease = { view -> track.removeSink(view); view.release() },
    )
}

private fun statusLabel(status: CallStatus, isVideo: Boolean, elapsed: Int): String = when (status) {
    CallStatus.CONNECTED -> TimeUtil.formatDuration(elapsed)
    CallStatus.CONNECTING -> "Connecting…"
    CallStatus.INCOMING -> "Incoming ${if (isVideo) "video" else "voice"} call…"
    CallStatus.RINGING -> "Ringing…"
    CallStatus.ENDED -> "Call ended"
    else -> ""
}

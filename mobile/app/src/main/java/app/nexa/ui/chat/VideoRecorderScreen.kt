package app.nexa.ui.chat

import android.Manifest
import android.content.Context
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cameraswitch
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FiberManualRecord
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import app.nexa.core.TimeUtil
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.rememberMultiplePermissionsState
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.File
import kotlin.coroutines.resume

private const val MAX_SECONDS = 60

/**
 * Full-screen in-app video-note recorder built on CameraX. Live preview, a
 * record/stop button, a front/back flip button (usable before recording), a
 * timer with a 60s cap, and its own runtime permission request. Calls
 * [onRecorded] with the finished .mp4, or [onCancel] if dismissed.
 */
@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun VideoRecorderScreen(onCancel: () -> Unit, onRecorded: (File) -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    val perms = rememberMultiplePermissionsState(
        listOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO),
    )
    LaunchedEffect(Unit) { if (!perms.allPermissionsGranted) perms.launchMultiplePermissionRequest() }

    if (!perms.allPermissionsGranted) {
        PermissionPrompt(onCancel) { perms.launchMultiplePermissionRequest() }
        return
    }

    val previewView = remember { PreviewView(context).apply { scaleType = PreviewView.ScaleType.FILL_CENTER } }
    val recorder = remember {
        Recorder.Builder()
            .setQualitySelector(QualitySelector.fromOrderedList(listOf(Quality.HD, Quality.SD, Quality.LOWEST)))
            .build()
    }
    val videoCapture = remember { VideoCapture.withOutput(recorder) }

    var lensFacing by remember { mutableIntStateOf(CameraSelector.LENS_FACING_BACK) }
    var isRecording by remember { mutableStateOf(false) }
    var elapsed by remember { mutableIntStateOf(0) }
    var activeRecording by remember { mutableStateOf<Recording?>(null) }
    var cancelled by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    // (Re)bind the camera whenever the chosen lens changes.
    LaunchedEffect(lensFacing) {
        runCatching {
            val provider = context.cameraProvider()
            val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
            val selector = CameraSelector.Builder().requireLensFacing(lensFacing).build()
            provider.unbindAll()
            provider.bindToLifecycle(lifecycleOwner, selector, preview, videoCapture)
        }.onFailure { error = "Couldn't open the camera." }
    }

    // Elapsed timer + auto-stop at the cap.
    LaunchedEffect(isRecording) {
        if (isRecording) {
            val startAt = System.currentTimeMillis()
            while (isRecording) {
                elapsed = ((System.currentTimeMillis() - startAt) / 1000).toInt()
                if (elapsed >= MAX_SECONDS) { activeRecording?.stop(); break }
                delay(250)
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose { runCatching { activeRecording?.stop() } }
    }

    fun startRecording() {
        val file = File(context.cacheDir, "vid_${System.currentTimeMillis()}.mp4")
        val pending = videoCapture.output
            .prepareRecording(context, FileOutputOptions.Builder(file).build())
            .withAudioEnabled()
        activeRecording = pending.start(ContextCompat.getMainExecutor(context)) { event ->
            when (event) {
                is VideoRecordEvent.Start -> { isRecording = true; elapsed = 0 }
                is VideoRecordEvent.Finalize -> {
                    isRecording = false
                    activeRecording = null
                    when {
                        cancelled -> runCatching { file.delete() }
                        !event.hasError() && file.length() > 0 -> onRecorded(file)
                        else -> {
                            runCatching { file.delete() }
                            error = "Recording failed. Please try again."
                        }
                    }
                }
                else -> {}
            }
        }
    }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        AndroidView(factory = { previewView }, modifier = Modifier.fillMaxSize())

        // Top bar: close + timer
        Row(
            Modifier.fillMaxWidth().padding(16.dp).align(Alignment.TopCenter),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = { cancelled = true; runCatching { activeRecording?.stop() }; onCancel() }) {
                Icon(Icons.Default.Close, "Cancel", tint = Color.White)
            }
            if (isRecording) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(10.dp).clip(CircleShape).background(Color.Red))
                    Spacer(Modifier.size(6.dp))
                    Text(TimeUtil.formatDuration(elapsed), color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.size(48.dp))
        }

        error?.let {
            Text(
                it,
                color = Color.White,
                modifier = Modifier.align(Alignment.Center)
                    .background(Color(0xCC000000), RoundedCornerShape(8.dp)).padding(12.dp),
            )
        }

        // Bottom controls: flip (left) · record/stop (center) · hint (right)
        Row(
            Modifier.fillMaxWidth().padding(bottom = 40.dp).align(Alignment.BottomCenter),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(
                onClick = {
                    if (!isRecording) {
                        lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK) {
                            CameraSelector.LENS_FACING_FRONT
                        } else {
                            CameraSelector.LENS_FACING_BACK
                        }
                    }
                },
                enabled = !isRecording,
                modifier = Modifier.size(56.dp).clip(CircleShape).background(Color(0x55FFFFFF)),
            ) {
                Icon(
                    Icons.Default.Cameraswitch, "Flip camera",
                    tint = if (isRecording) Color.Gray else Color.White,
                    modifier = Modifier.size(28.dp),
                )
            }

            IconButton(
                onClick = { if (isRecording) activeRecording?.stop() else startRecording() },
                modifier = Modifier.size(76.dp).clip(CircleShape).background(Color.White),
            ) {
                Icon(
                    if (isRecording) Icons.Default.Stop else Icons.Default.FiberManualRecord,
                    if (isRecording) "Stop" else "Record",
                    tint = Color.Red,
                    modifier = Modifier.size(if (isRecording) 40.dp else 56.dp),
                )
            }

            Spacer(Modifier.size(56.dp))
        }
    }
}

@Composable
private fun PermissionPrompt(onCancel: () -> Unit, onGrant: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
            Text(
                "Camera and microphone access is needed to record a video message.",
                color = Color.White,
                style = MaterialTheme.typography.bodyLarge,
            )
            Spacer(Modifier.height(16.dp))
            Button(onClick = onGrant) { Text("Allow") }
            Spacer(Modifier.height(8.dp))
            IconButton(onClick = onCancel) { Icon(Icons.Default.Close, "Cancel", tint = Color.White) }
        }
    }
}

/** Await CameraX's ProcessCameraProvider (wraps its ListenableFuture). */
private suspend fun Context.cameraProvider(): ProcessCameraProvider = suspendCancellableCoroutine { cont ->
    val future = ProcessCameraProvider.getInstance(this)
    future.addListener({ cont.resume(future.get()) }, ContextCompat.getMainExecutor(this))
}

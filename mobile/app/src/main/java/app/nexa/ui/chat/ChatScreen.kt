package app.nexa.ui.chat

import android.Manifest
import android.media.MediaMetadataRetriever
import android.media.MediaPlayer
import android.widget.MediaController
import android.widget.Toast
import android.widget.VideoView
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.nexa.core.TimeUtil
import app.nexa.data.protocol.MediaEnvelope
import app.nexa.domain.model.CallType
import app.nexa.domain.model.ChatMessage
import app.nexa.ui.common.Avatar
import coil.compose.AsyncImage
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

@OptIn(ExperimentalMaterial3Api::class, ExperimentalPermissionsApi::class)
@Composable
fun ChatScreen(
    onBack: () -> Unit,
    vm: ChatViewModel = hiltViewModel(),
) {
    val messages by vm.messages.collectAsStateWithLifecycle()
    val typing by vm.peerTyping.collectAsStateWithLifecycle()
    val recording by vm.recording.collectAsStateWithLifecycle()
    val recordElapsed by vm.recordElapsed.collectAsStateWithLifecycle()
    val sendFailed by vm.sendFailed.collectAsStateWithLifecycle()
    val ctx = LocalContext.current
    LaunchedEffect(sendFailed) {
        if (sendFailed) {
            Toast.makeText(ctx, "Couldn't send. Check your connection and try again.", Toast.LENGTH_LONG).show()
            vm.clearSendFailed()
        }
    }
    var input by remember { mutableStateOf("") }
    var showEmoji by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()

    LaunchedEffect(messages.size, typing) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size)
    }

    // In-app CameraX video-note recorder (with front/back flip).
    var showRecorder by remember { mutableStateOf(false) }
    if (showRecorder) {
        VideoRecorderScreen(
            onCancel = { showRecorder = false },
            onRecorded = { f ->
                val duration = runCatching {
                    val r = MediaMetadataRetriever()
                    r.setDataSource(f.absolutePath)
                    val d = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
                    r.release(); d
                }.getOrDefault(0L)
                vm.sendVideo(f.readBytes(), duration, f)
                showRecorder = false
            },
        )
        return
    }

    // Photo sharing — the modern photo picker needs no runtime permission.
    val context = LocalContext.current
    val pickImage = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            val bytes = runCatching { context.contentResolver.openInputStream(uri)?.use { it.readBytes() } }.getOrNull()
            val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
            if (bytes != null && bytes.isNotEmpty()) vm.sendImage(bytes, mime, null)
        }
    }

    // Voice notes need the mic permission — request on demand, then start recording.
    val micPermission = rememberPermissionState(Manifest.permission.RECORD_AUDIO)
    var pendingVoiceStart by remember { mutableStateOf(false) }
    LaunchedEffect(micPermission.status) {
        if (pendingVoiceStart && micPermission.status.isGranted) {
            pendingVoiceStart = false
            vm.startVoice()
        }
    }
    fun requestVoice() {
        if (micPermission.status.isGranted) vm.startVoice()
        else { pendingVoiceStart = true; micPermission.launchPermissionRequest() }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Avatar(name = vm.peerName, size = 38.dp, userId = vm.peerId.takeIf { it.isNotEmpty() })
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text(vm.peerName, style = MaterialTheme.typography.titleMedium)
                            if (typing) Text("typing…", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.secondary)
                            else Text("End-to-end encrypted", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                },
                actions = {
                    IconButton(onClick = { vm.call(CallType.VOICE) }) { Icon(Icons.Default.Call, "Voice call") }
                    IconButton(onClick = { vm.call(CallType.VIDEO) }) { Icon(Icons.Default.Videocam, "Video call") }
                },
            )
        },
        bottomBar = {
            if (recording) {
                Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(12.dp).clip(RoundedCornerShape(50)).background(MaterialTheme.colorScheme.error))
                    Spacer(Modifier.width(10.dp))
                    Text("Recording… ${TimeUtil.formatDuration(recordElapsed)}", Modifier.weight(1f), color = MaterialTheme.colorScheme.onSurfaceVariant)
                    IconButton(onClick = vm::cancelVoice) { Icon(Icons.Default.Close, "Cancel") }
                    FilledIconButton(onClick = vm::stopAndSendVoice) { Icon(Icons.AutoMirrored.Filled.Send, "Send voice") }
                }
            } else {
                Column {
                    if (showEmoji) EmojiPanel(onPick = { input += it })
                    Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.Bottom) {
                        IconButton(onClick = { showEmoji = !showEmoji }) {
                            Icon(
                                Icons.Default.EmojiEmotions, "Emoji",
                                tint = if (showEmoji) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        OutlinedTextField(
                            value = input,
                            onValueChange = { input = it; vm.notifyTyping() },
                            placeholder = { Text("Message…") },
                            modifier = Modifier.weight(1f),
                            maxLines = 4,
                        )
                        Spacer(Modifier.width(6.dp))
                        if (input.isNotBlank()) {
                            FilledIconButton(onClick = { vm.send(input); input = ""; vm.stopTyping(); showEmoji = false }) {
                                Icon(Icons.AutoMirrored.Filled.Send, "Send")
                            }
                        } else {
                            IconButton(onClick = {
                                pickImage.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                            }) { Icon(Icons.Default.Image, "Send photo") }
                            IconButton(onClick = { showRecorder = true }) { Icon(Icons.Default.Videocam, "Record video message") }
                            FilledIconButton(onClick = { requestVoice() }) { Icon(Icons.Default.Mic, "Record voice message") }
                        }
                    }
                }
            }
        },
    ) { padding ->
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            contentPadding = PaddingValues(vertical = 8.dp),
        ) {
            items(messages, key = { it.id }) { MessageBubble(it, vm::mediaFile) }
        }
    }
}

@Composable
private fun MessageBubble(message: ChatMessage, resolve: suspend (MediaEnvelope) -> File?) {
    val mine = message.mine
    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start) {
        Column(
            Modifier.widthIn(max = 300.dp).clip(RoundedCornerShape(16.dp))
                .background(if (mine) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant)
                .padding(horizontal = 10.dp, vertical = 7.dp),
        ) {
            when {
                message.type == "voice" && message.media != null -> VoiceNote(message.media, mine, resolve)
                message.type == "video" && message.media != null -> VideoNote(message.media, resolve)
                message.type == "image" && message.media != null -> ImageMessage(message.media, resolve)
                else -> Text(message.text, color = if (mine) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface)
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.align(Alignment.End)) {
                Text(
                    TimeUtil.formatTime(message.time),
                    style = MaterialTheme.typography.labelSmall,
                    color = if (mine) MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f) else MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (mine) {
                    Spacer(Modifier.width(4.dp))
                    Text(statusMark(message.status), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f), fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun VoiceNote(env: MediaEnvelope, mine: Boolean, resolve: suspend (MediaEnvelope) -> File?) {
    val scope = rememberCoroutineScope()
    val player = remember { MediaPlayer() }
    var playing by remember { mutableStateOf(false) }
    var prepared by remember { mutableStateOf(false) }
    var progress by remember { mutableFloatStateOf(0f) } // 0..1
    DisposableEffect(Unit) { onDispose { runCatching { player.release() } } }

    // Advance the waveform fill while playing.
    LaunchedEffect(playing) {
        while (playing) {
            val dur = player.duration.takeIf { it > 0 } ?: 1
            progress = (player.currentPosition.toFloat() / dur).coerceIn(0f, 1f)
            delay(80)
        }
    }

    suspend fun ensurePrepared(): Boolean {
        if (prepared) return true
        val f = resolve(env) ?: return false
        withContext(Dispatchers.IO) { player.setDataSource(f.absolutePath); player.prepare() }
        prepared = true
        player.setOnCompletionListener { playing = false; progress = 0f }
        return true
    }

    fun toggle() {
        if (playing) { player.pause(); playing = false; return }
        scope.launch { if (ensurePrepared()) { player.start(); playing = true } }
    }

    fun seekTo(fraction: Float) = scope.launch {
        if (ensurePrepared()) {
            player.seekTo((player.duration * fraction).toInt())
            progress = fraction
            if (!playing) { player.start(); playing = true }
        }
    }

    val fg = if (mine) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface
    val bars = remember(env.mediaObjectId) { waveformBars(env.mediaObjectId) }
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.widthIn(min = 200.dp).padding(vertical = 2.dp)) {
        IconButton(onClick = ::toggle) {
            Icon(if (playing) Icons.Default.Pause else Icons.Default.PlayArrow, "Play", tint = fg)
        }
        Canvas(
            Modifier.weight(1f).height(28.dp)
                .pointerInput(Unit) {
                    detectTapGestures { o -> seekTo((o.x / size.width).coerceIn(0f, 1f)) }
                },
        ) {
            val n = bars.size
            val gap = 3.dp.toPx()
            val barW = ((size.width - gap * (n - 1)) / n).coerceAtLeast(1f)
            val playedX = size.width * progress
            bars.forEachIndexed { i, h ->
                val x = i * (barW + gap)
                val barH = (size.height * h).coerceAtLeast(2f)
                val y = (size.height - barH) / 2f
                drawRoundRect(
                    color = if (x <= playedX) fg else fg.copy(alpha = 0.35f),
                    topLeft = Offset(x, y),
                    size = Size(barW, barH),
                    cornerRadius = CornerRadius(barW / 2f, barW / 2f),
                )
            }
        }
        Spacer(Modifier.width(8.dp))
        Text(TimeUtil.formatDuration((env.durationMs / 1000).toInt()), color = fg, style = MaterialTheme.typography.labelSmall)
    }
}

/** Deterministic pseudo-waveform (bar heights 0.3..1.0) seeded by the media id,
 *  so a given voice note always renders the same shape. */
private fun waveformBars(seed: String): List<Float> {
    var h = seed.hashCode()
    return List(28) {
        h = h * 1103515245 + 12345
        0.3f + (((h ushr 16) and 0x7fff) / 32767f) * 0.7f
    }
}

@Composable
private fun ImageMessage(env: MediaEnvelope, resolve: suspend (MediaEnvelope) -> File?) {
    var file by remember(env.mediaObjectId) { mutableStateOf<File?>(null) }
    LaunchedEffect(env.mediaObjectId) { file = resolve(env) }
    val f = file
    if (f != null) {
        AsyncImage(
            model = f,
            contentDescription = "Photo",
            modifier = Modifier.size(width = 220.dp, height = 260.dp).clip(RoundedCornerShape(12.dp)),
            contentScale = ContentScale.Crop,
        )
    } else {
        Box(
            Modifier.size(width = 220.dp, height = 260.dp).clip(RoundedCornerShape(12.dp)).background(Color.Black.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center,
        ) { CircularProgressIndicator() }
    }
}

@Composable
private fun VideoNote(env: MediaEnvelope, resolve: suspend (MediaEnvelope) -> File?) {
    val scope = rememberCoroutineScope()
    var file by remember { mutableStateOf<File?>(null) }
    var loading by remember { mutableStateOf(false) }

    val f = file
    if (f != null) {
        AndroidView(
            modifier = Modifier.size(width = 240.dp, height = 160.dp).clip(RoundedCornerShape(12.dp)),
            factory = { ctx ->
                VideoView(ctx).apply {
                    setVideoPath(f.absolutePath)
                    val controller = MediaController(ctx)
                    controller.setAnchorView(this)
                    setMediaController(controller)
                    setOnPreparedListener { start() }
                }
            },
        )
    } else {
        Box(
            Modifier.size(width = 240.dp, height = 160.dp).clip(RoundedCornerShape(12.dp))
                .background(Color.Black)
                .clickable {
                    loading = true
                    scope.launch { file = resolve(env); loading = false }
                },
            contentAlignment = Alignment.Center,
        ) {
            if (loading) CircularProgressIndicator(color = Color.White)
            else Icon(Icons.Default.PlayCircle, "Play video", tint = Color.White, modifier = Modifier.size(48.dp))
        }
    }
}

private fun statusMark(status: String) = when (status) {
    "queued" -> "🕘"; "sent" -> "✓"; "delivered" -> "✓✓"; "read" -> "✓✓"; else -> ""
}

private val EMOJIS = listOf(
    "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎", "🤩", "🥳",
    "😉", "🙂", "🙃", "😇", "🥰", "😗", "☺️", "🤗", "🤔", "🤨",
    "😐", "🙄", "😏", "😴", "😌", "😔", "😢", "😭", "😤", "😠",
    "😡", "🤯", "😳", "🥺", "😨", "😅", "😆", "😜", "😝", "🤪",
    "😋", "🤤", "🥴", "🤒", "🤕", "👍", "👎", "👏", "🙏", "💪",
    "👌", "✌️", "🤞", "🤝", "🙌", "👋", "🤙", "👀", "❤️", "🧡",
    "💛", "💚", "💙", "💜", "🖤", "💔", "💯", "🔥", "🎉", "🎊",
    "✨", "⭐", "🌟", "💫", "🙈", "😬", "😑", "🤗", "🤠", "🥶",
)

@Composable
private fun EmojiPanel(onPick: (String) -> Unit) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(8),
        modifier = Modifier.fillMaxWidth().height(216.dp)
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
            .padding(horizontal = 6.dp),
    ) {
        items(EMOJIS) { e ->
            Text(
                e,
                fontSize = 24.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.clickable { onPick(e) }.padding(vertical = 8.dp),
            )
        }
    }
}

package app.nexa.data.update

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import app.nexa.BuildConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import javax.inject.Inject
import javax.inject.Singleton

/**
 * In-app updates. Checks the server's version.json; if it advertises a newer
 * versionCode than this build, it exposes an [available] update. The user can
 * then download the new APK and Android installs it in place (same signing key,
 * so no uninstall/reinstall). Not a Play Store; a self-hosted sideload updater.
 */
@Singleton
class UpdateManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    data class UpdateInfo(val versionCode: Int, val versionName: String, val notes: String)

    /** Where we are in the download → install flow, surfaced to the UI for feedback. */
    enum class Phase { IDLE, DOWNLOADING, NEEDS_PERMISSION, INSTALLING, FAILED }
    data class Progress(val phase: Phase, val message: String? = null)

    private val _available = MutableStateFlow<UpdateInfo?>(null)
    val available: StateFlow<UpdateInfo?> = _available

    private val _progress = MutableStateFlow(Progress(Phase.IDLE))
    val progress: StateFlow<Progress> = _progress

    /** The APK we already downloaded, so "Install" can retry without re-downloading. */
    private var downloadedFile: File? = null

    /** Fetch version.json from the public website and compare with this build. */
    suspend fun check() {
        val info = runCatching {
            val text = fetch(VERSION_URL)
            val o = JSONObject(text)
            UpdateInfo(
                versionCode = o.getInt("versionCode"),
                versionName = o.optString("versionName", ""),
                notes = o.optString("notes", ""),
            )
        }.getOrNull() ?: return
        _available.value = if (info.versionCode > BuildConfig.VERSION_CODE) info else null
    }

    fun dismiss() { _available.value = null }
    fun resetProgress() { _progress.value = Progress(Phase.IDLE) }

    private suspend fun fetch(url: String): String = withContext(Dispatchers.IO) {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.instanceFollowRedirects = true
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        try {
            conn.inputStream.bufferedReader().use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }

    /** Download the latest APK from GitHub Releases, then launch the system installer. */
    fun downloadAndInstall() {
        _progress.value = Progress(Phase.DOWNLOADING, "Downloading the update…")
        val dest = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_NAME)
        runCatching { if (dest.exists()) dest.delete() }

        val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val req = DownloadManager.Request(Uri.parse(APK_URL))
            .setTitle("Nexa update")
            .setDescription("Downloading the latest version…")
            .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, APK_NAME)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        val downloadId = runCatching { dm.enqueue(req) }.getOrElse {
            _progress.value = Progress(Phase.FAILED, "Couldn't start the download. Check your connection and try again.")
            return
        }

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) {
                val done = i.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
                if (done != downloadId) return
                runCatching { c.unregisterReceiver(this) }
                if (downloadStatus(dm, downloadId) != DownloadManager.STATUS_SUCCESSFUL) {
                    _progress.value = Progress(Phase.FAILED, "Download failed. Check your connection and try again.")
                    return
                }
                downloadedFile = dest
                installDownloaded()
            }
        }
        ContextCompat.registerReceiver(
            context, receiver,
            IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
            ContextCompat.RECEIVER_EXPORTED, // DOWNLOAD_COMPLETE is a system broadcast
        )
    }

    /**
     * Install the already-downloaded APK. On Android 8+ the user must first allow
     * "install unknown apps" for Nexa; if they haven't, we send them to that settings
     * screen and wait for them to come back and tap Install (retrying this method).
     */
    fun installDownloaded() {
        val file = downloadedFile
        if (file == null || !file.exists() || file.length() == 0L) {
            _progress.value = Progress(Phase.FAILED, "The update file is missing. Please try downloading again.")
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
            _progress.value = Progress(
                Phase.NEEDS_PERMISSION,
                "Android needs your permission to install updates. Turn on \"Allow from this source\", then come back and tap Install.",
            )
            runCatching {
                context.startActivity(
                    Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
            }
            return
        }
        launchInstaller(file)
    }

    private fun launchInstaller(file: File) {
        val result = runCatching {
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }
            context.startActivity(intent)
        }
        _progress.value = if (result.isSuccess) {
            Progress(Phase.INSTALLING, "Opening the installer…")
        } else {
            Progress(Phase.FAILED, "Couldn't open the installer. Try downloading from the website instead.")
        }
    }

    private fun downloadStatus(dm: DownloadManager, id: Long): Int = runCatching {
        dm.query(DownloadManager.Query().setFilterById(id)).use { c ->
            if (c.moveToFirst()) c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) else -1
        }
    }.getOrDefault(-1)

    private companion object {
        const val APK_NAME = "nexa-update.apk"
        // Fixed public locations (independent of the user's backend server address):
        //   - version manifest served by the website
        //   - APK served by GitHub Releases (always the newest release)
        const val VERSION_URL = "https://offline-call.vercel.app/version.json"
        const val APK_URL = "https://github.com/joshuamxt01/offline-call/releases/latest/download/nexa.apk"
    }
}

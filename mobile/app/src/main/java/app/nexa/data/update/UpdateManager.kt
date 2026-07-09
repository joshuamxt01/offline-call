package app.nexa.data.update

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Environment
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import app.nexa.BuildConfig
import app.nexa.data.local.SecureStore
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
    private val store: SecureStore,
) {
    data class UpdateInfo(val versionCode: Int, val versionName: String, val notes: String)

    private val _available = MutableStateFlow<UpdateInfo?>(null)
    val available: StateFlow<UpdateInfo?> = _available

    /** Fetch version.json from the configured server and compare with this build. */
    suspend fun check() {
        val base = store.serverUrl.trimEnd('/')
        val info = runCatching {
            val text = fetch("$base/version.json")
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

    private suspend fun fetch(url: String): String = withContext(Dispatchers.IO) {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        try {
            conn.inputStream.bufferedReader().use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }

    /** Download the latest APK from the server, then launch the system installer. */
    fun downloadAndInstall() {
        val base = store.serverUrl.trimEnd('/')
        val dest = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_NAME)
        runCatching { if (dest.exists()) dest.delete() }

        val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val req = DownloadManager.Request(Uri.parse("$base/nexa.apk"))
            .setTitle("Nexa update")
            .setDescription("Downloading the latest version…")
            .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, APK_NAME)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        val downloadId = dm.enqueue(req)

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) {
                val done = i.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
                if (done == downloadId) {
                    runCatching { c.unregisterReceiver(this) }
                    installApk(dest)
                }
            }
        }
        ContextCompat.registerReceiver(
            context, receiver,
            IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
            ContextCompat.RECEIVER_EXPORTED, // DOWNLOAD_COMPLETE is a system broadcast
        )
    }

    private fun installApk(file: File) {
        runCatching {
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }
            context.startActivity(intent)
        }
    }

    private companion object {
        const val APK_NAME = "nexa-update.apk"
    }
}

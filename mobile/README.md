# Nexa — Android client (Kotlin)

The **primary** Nexa communication client: native Android, Jetpack Compose, WebRTC,
Socket.IO, Room, and an offline/LAN engine. Clean architecture (`data` / `domain` / `ui`)
with Hilt DI.

> Built as a complete, reviewed codebase. It targets the same backend the web app uses.
> Open in Android Studio to build/run (this repo was authored without a local Android SDK).

## Build & run
1. Open the `mobile/` folder in **Android Studio** (Giraffe+). It will generate the Gradle
   wrapper on first sync (or run `gradle wrapper`).
2. Point the app at your backend. Default is `http://10.0.2.2:4000` (emulator → host).
   Override in `mobile/local.properties` or `gradle.properties`:
   ```
   API_BASE_URL=http://192.168.1.50:4000
   ```
3. Run on an emulator or device. Log in with a seeded account (`alice@nexa.local` /
   `Password123!`) or register a new one.

## What's implemented
| Area | Detail |
|---|---|
| **Auth** | Register/login, X25519 identity keypair in Android Keystore (`EncryptedSharedPreferences`), JWT + refresh rotation via an OkHttp `Authenticator` |
| **Contacts** | Search, add, accept, presence dots (live via Socket.IO) |
| **Chat** | End-to-end encrypted (libsodium `crypto_box`), Room-backed **offline queue**, delivery/read receipts, typing, sync on reconnect |
| **Voice & video messages** | Record voice notes (MediaRecorder) + video notes (system camera via FileProvider), encrypt each blob with a secretbox key, upload ciphertext to B2, play with MediaPlayer/VideoView |
| **Voice calls** | WebRTC audio — incoming/outgoing/in-call, mute, speaker, call timer, foreground service |
| **Video calls** | Camera capture, front/back switch, enable/disable, full-screen, PiP self-view |
| **Offline / LAN** | mDNS discovery (`NsdDiscovery`), direct-socket LAN signaling (`LanSignaling`) implementing the same `SignalingChannel` as the cloud — media stays on the LAN |
| **Foreground service** | Keeps mic/camera capture alive during calls with an ongoing notification |

## Architecture
```
data/
  protocol/    event names + DTOs mirroring @nexa/shared
  crypto/      CryptoBox (libsodium E2EE)
  local/       SecureStore (Keystore), Room (messages/conversations/contacts)
  remote/      Retrofit ApiService + auth interceptor + refresh authenticator
  realtime/    SocketManager (typed flows over Socket.IO)
  webrtc/      WebRtcSession (PeerConnection engine)
  signaling/   SignalingChannel + CloudSignaling + LanSignaling  ← the hybrid core
  discovery/   NsdDiscovery (mDNS) for offline peers
  repository/  Auth / Contacts / Chat / CallManager
domain/model/  UI models (Contact, Message, Call…)
service/       CallForegroundService, ConnectivityObserver
ui/            theme, navigation, auth, home, contacts, chat, calls, call, settings
di/            Hilt modules (Network, Database, WebRtc, App)
```

## The hybrid transport (why calls work offline)
`WebRtcSession` drives one `PeerConnection` using an injected `SignalingChannel`.
`CloudSignaling` carries SDP/ICE over Socket.IO (online); `LanSignaling` carries the
**same** messages over a direct LAN socket after `NsdDiscovery` finds the peer. The media
never touches the server in either case. See `../docs/06-OFFLINE-HYBRID.md`.

## Key dependencies
Compose · Hilt · Retrofit/OkHttp + kotlinx.serialization · Room · `io.getstream:stream-webrtc-android` ·
`io.socket:socket.io-client` · `com.goterl:lazysodium-android` · DataStore/security-crypto.

## Notes
- The WebRTC distribution is Stream's maintained `org.webrtc` build (the old
  `org.webrtc:google-webrtc` is no longer published).
- E2EE is single-key-per-user for the MVP (Double Ratchet is the Phase-2 upgrade).
- Offline first-contact trust uses cached keys + QR pairing (see the security doc).

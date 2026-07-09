# 06 — Offline / LAN Hybrid (deep dive)

The defining feature: full voice/video/chat with **no internet**, media staying on the LAN.
The cloud is used only when reachable, and only for signaling — never media.

## 1. Transport selection

Every call/message asks the `TransportSelector`:

```
1. Is the target a known contact discovered on the current LAN? ── yes ─▶ LAN transport
2. Is the cloud reachable AND target online?                     ── yes ─▶ CLOUD transport
3. Neither?                                                        ─▶ queue (chat) / missed (call)
```

Both transports feed the **same** WebRTC `PeerConnection`; only the signaling channel differs.

```
        ┌────────────── one CallEngine / PeerConnection ──────────────┐
        │                                                             │
 SDP/ICE│  CloudSignaling (Socket.IO)   ◄── online                    │
 in/out │  LanSignaling  (mDNS + socket) ◄── offline                  │
        └─────────────────────────────────────────────────────────────┘
```

## 2. Local discovery

### 2a. mDNS / DNS-SD (primary — devices share a Wi-Fi AP)
- Android `NsdManager` registers service type `_nexa._tcp` on a chosen port.
- **TXT records** carry identity so peers recognize each other offline:
  ```
  uid   = <userId>
  did   = <deviceId>
  name  = <displayName>
  ipk   = <base64 identity public key>
  ver   = <protocol version>
  nonce = <random, signed below>
  sig   = <Ed25519 signature over uid|did|nonce with identity key>
  ```
- A resolving peer verifies `sig` against `ipk`, then checks `ipk` against its **cached
  contact keys** (from the last online sync). Match ⇒ trusted peer, show as "nearby".
- Discovery runs while the app is foregrounded or a discovery foreground-service is active.

### 2b. Wi-Fi Direct (fallback — no shared AP / no router)
- `WifiP2pManager` forms a group (one device becomes group owner ≈ soft-AP).
- Peers exchange the same identity TXT payload via Wi-Fi P2P service discovery.
- Once the P2P group has IPs, LAN signaling proceeds identically.

### 2c. Web note
Browsers can't do mDNS. Web offline mode options (Phase 4):
- If a same-LAN device runs the app, a tiny **local relay helper** (or the Android device
  acting as a local Socket.IO signaling host on the LAN) bridges web ↔ LAN.
- Otherwise web falls back to cloud. Native Android is the full offline client.

## 3. LAN signaling wire format

Once a peer is discovered and its `ip:port` known, open a direct TCP socket (length-prefixed
JSON frames) or local UDP. Messages mirror the cloud `signal:*` shapes:

```json
{ "t": "offer",  "callId": "…", "from": "deviceId", "sdp": "…" }
{ "t": "answer", "callId": "…", "from": "deviceId", "sdp": "…" }
{ "t": "ice",    "callId": "…", "from": "deviceId", "candidate": {…} }
{ "t": "invite", "callId": "…", "from": "deviceId", "type": "voice|video" }
{ "t": "bye",    "callId": "…", "from": "deviceId" }
{ "t": "msg",    "id": "ULID", "convId":"…", "ciphertext":"…", "nonce":"…" }  // offline chat
```

Frames are **E2E-encrypted** with the pairwise session key (same crypto as cloud messages),
so even on a hostile LAN the payload is private. ICE uses **host candidates only** (same
subnet) — no STUN, no TURN, no internet.

## 4. Offline identity & trust

Problem: the cloud (source of identity) is unreachable. Solution: **trust established while
online, used while offline.**

- On every successful online sync, the client caches each contact's `device_keys.identity_pub`.
- Offline, a peer proves possession of the matching private key via the signed TXT `nonce`
  (challenge-response), giving cryptographic assurance it's the same contact.
- **First contact offline (never synced):** QR-code pairing — device A shows a QR of its
  identity key + fingerprint; device B scans and pins it (TOFU). Optional short numeric
  safety code both users compare aloud.
- Revocation can't propagate offline; revocations reconcile on next online sync (documented
  trade-off).

## 5. Offline messaging (store-and-forward)

- Messages composed offline are written to Room with `status = queued` and a ULID id
  (monotonic, sortable — preserves order without a server clock).
- If the recipient is on the LAN → deliver directly via the `msg` frame; mark `delivered`.
- If not reachable at all → stay queued; on reconnect (cloud or LAN), flush via
  `POST /messages/sync`, and pull missed messages via `GET /messages/sync?since=`.
- De-duplication by client `id` (idempotent) so LAN + cloud double-delivery collapses to one.

## 6. Reconnection & reconciliation

```
online again ─▶ authenticate ─▶ push queued (dedupe by id) ─▶ pull missed (since cursor)
             ─▶ refresh contact keys/presence ─▶ apply any revocations ─▶ steady state
```

Postgres is authoritative for history; the client merges by `id` and orders by
`(client_created_at, id)` so offline-authored messages slot in correctly.

## 7. Call flow comparison

| Step | Online (cloud) | Offline (LAN) |
|---|---|---|
| Find peer | Redis presence via server | mDNS/Wi-Fi Direct TXT |
| Ring | `call:incoming` via Socket.IO | `invite` frame via LAN socket |
| SDP/ICE | relayed by server | direct LAN socket |
| ICE candidates | host + STUN + TURN fallback | host only |
| Media | WebRTC P2P (or TURN if P2P fails) | WebRTC over Wi-Fi |
| History | written server-side immediately | written locally, synced later |
| Cloud sees media? | **No** | **No** |

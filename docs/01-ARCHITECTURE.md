# 01 — System Architecture

## 1. Product overview

| | |
|---|---|
| **Name** | Nexa (working codename — rename freely) |
| **One-liner** | Private voice/video/chat platform that works online via the cloud and offline over local Wi‑Fi. |
| **Target users** | Privacy-conscious individuals, small teams, field/enterprise crews operating on isolated LANs (sites, ships, campuses, warehouses), and anyone needing comms when the internet is down. |
| **Core problem** | Mainstream comms apps die without internet and route media through corporate servers. Nexa keeps working on a bare LAN and keeps media peer-to-peer. |
| **Value proposition** | "Your calls and messages, online or off — and the server never sees your media." |

## 2. Assumptions & constraints

- **Platforms:** Native Android (primary client), responsive web PWA (secondary client + dashboards). iOS out of scope for v1.
- **Scale target (v1):** thousands of users, hundreds of concurrent calls. Architecture must not block a path to 100k+.
- **Budget posture:** serverless-first, generous free tiers (Neon, Upstash, Render, Backblaze B2). The expensive line item is TURN bandwidth — mitigated by preferring P2P/LAN.
- **AI usage:** none required for v1 (optional later: transcription, spam detection).
- **Media transport:** WebRTC only. Cloud is signaling + control, never a media SFU/relay except optional TURN fallback when direct P2P fails online.
- **Security posture:** WebRTC media encrypted by default (DTLS-SRTP); messages end-to-end encrypted; passwords Argon2id; JWT with refresh rotation.

## 3. Feature breakdown

### Core (MVP)
| Feature | Why it's MVP |
|---|---|
| Register / login / device verification | Identity is the root of everything |
| Contact system (add, search, presence) | You can't call who you can't find |
| 1:1 voice call (WebRTC) | The product's headline capability |
| 1:1 video call (WebRTC) | Second headline capability |
| 1:1 text chat with delivery/read + offline queue + sync | Baseline messaging |
| Cloud signaling (Socket.IO) | Enables online calls & message delivery |
| **LAN discovery + offline call/chat** | The differentiator; must ship in v1 |
| Call history | Expected of any calling app |

### Secondary
Voice messages, video messages/recording, group calls, profile pictures, admin dashboard analytics, message search, push notifications (FCM), block/report, multi-device message fan-out.

### Out of scope (v1)
iOS, PSTN/phone-number calling, SFU-based large group video (>4), federation across servers, payments, bots/API platform.

## 4. End-to-end user flow

```
Install app ─▶ Register (username/email/password) ─▶ Device generates keypair,
registers device, verifies ─▶ Home (contacts + presence)
   │
   ├─▶ Add contact (search by username) ─▶ contact appears with presence dot
   │
   ├─▶ Tap contact ─▶ Chat thread (send text / voice note / video note)
   │        └─ online: delivered via Socket.IO; offline: queued locally, synced on reconnect
   │
   ├─▶ Tap call ─▶ ONLINE path:  invite via Socket.IO ─▶ callee rings ─▶ answer ─▶
   │                             SDP/ICE exchanged via server ─▶ WebRTC P2P media
   │        └─────▶ OFFLINE path: peer found via LAN discovery ─▶ SDP/ICE exchanged over
   │                             LAN socket ─▶ WebRTC media over Wi-Fi, zero internet
   │
   └─▶ Call ends ─▶ record written to Calls table (or local, synced later)
```

**Hybrid decision point (client-side "transport picker"):**
1. Is the target device reachable on the local network (discovered via mDNS/Wi-Fi Direct)? → use **LAN signaling**, host ICE candidates only.
2. Else is the cloud reachable and peer online? → use **Cloud signaling**, STUN first, TURN fallback.
3. Else → queue message / mark call as missed.

## 5. High-level system architecture

```
┌──────────────┐        ┌──────────────┐
│  Android app │        │   Web app    │   ← clients (WebRTC engines + local stores)
│  (Kotlin)    │        │ (Next.js PWA)│
└──────┬───────┘        └──────┬───────┘
       │  HTTPS REST + WSS (Socket.IO)  │
       └───────────────┬───────────────┘
                       ▼
        ┌─────────────────────────────────┐
        │   Backend control plane (Render) │
        │   Express REST  +  Socket.IO     │
        │   ┌───────────┬──────────────┐   │
        │   │ Auth svc  │ Signaling svc│   │
        │   │ User svc  │ Presence svc │   │
        │   │ Msg svc   │ Media svc    │   │
        │   └───────────┴──────────────┘   │
        └───┬─────────┬─────────┬──────────┘
            ▼         ▼         ▼
     ┌──────────┐ ┌────────┐ ┌──────────────┐
     │ Neon PG  │ │Upstash │ │ Backblaze B2 │
     │(durable) │ │ Redis  │ │(media blobs) │
     └──────────┘ │(ephem.)│ └──────────────┘
                  └────────┘
            ▲
            │ short-lived HMAC creds
     ┌──────┴───────┐
     │ coturn TURN  │  ← used ONLY when online P2P fails; never for LAN
     └──────────────┘

        DATA PLANE (bypasses everything above):
        Device A ⇄ Device B  WebRTC media, P2P / LAN / TURN
```

### Responsibility split

| Concern | Where | Why |
|---|---|---|
| Identity, auth, device registry, contacts, permissions | Neon PostgreSQL | Durable, relational, ACID |
| Presence, heartbeats, active-call state, signaling rooms, rate-limit counters, typing | Upstash Redis | High-churn ephemeral data, TTLs, atomic ops |
| Media blobs (voice notes, video notes, avatars) | Backblaze B2 (S3-compatible) | Cheap object storage, presigned upload/download |
| Real-time events (presence, signaling, delivery) | Socket.IO over WSS | Bidirectional, room-based fan-out |
| Live media | WebRTC (P2P / LAN / TURN) | Low latency, encrypted, off the server |

## 6. Tech stack (opinionated)

| Layer | Choice | Justification |
|---|---|---|
| Android UI | Kotlin + Jetpack Compose | Modern declarative native UI, matches web component model |
| Android WebRTC | `org.webrtc` (Google WebRTC) | Native peer connections, camera/mic capture |
| Android async | Coroutines + Flow | Structured concurrency for signaling/streams |
| Android local DB | Room (SQLite) | Offline message queue + cache |
| Android discovery | NSD (mDNS) + Wi-Fi Direct | Peer discovery with/without an access point |
| Web framework | Next.js (App Router) + TypeScript | SSR dashboards + PWA client, one language cloud-to-edge |
| Web styling | Tailwind CSS | Mobile-first utility system, dark/light theming |
| Web animation | Framer Motion | Smooth call/transition animations |
| Web state | Zustand + TanStack Query | Local UI state + server cache; light and fast |
| Web realtime/media | `socket.io-client` + browser WebRTC | Same protocol as mobile |
| Backend | Node.js + Express | Mature, matches Socket.IO, easy on Render |
| Realtime | Socket.IO | Rooms, reconnection, ack semantics out of the box |
| API style | REST (control) + event protocol (realtime) | REST for CRUD, events for signaling/presence |
| Validation | Zod | Shared schema-first validation |
| ORM | Drizzle ORM | Type-safe SQL, first-class Neon/Postgres, lightweight migrations |
| Durable DB | Neon PostgreSQL (serverless) | Autoscaling Postgres, branching for staging |
| Ephemeral store | Upstash Redis (serverless) | Pay-per-request, global, TLS |
| Object storage | Backblaze B2 (S3 API) | Cheap egress, presigned URLs |
| TURN/STUN | coturn | Self-hosted NAT traversal; short-lived creds |
| Auth | Custom JWT (access+refresh) + Argon2id | Full control, device-bound sessions |
| E2E crypto | libsodium (X25519 + XChaCha20-Poly1305) | Audited, cross-platform (JVM + JS) |

## 7. Component architecture (summary)

- **Backend** is layered: `routes → controllers → services → repositories → db`. Socket.IO handlers live in `realtime/` and reuse the same services. Cross-cutting concerns (auth, validation, rate-limit, error) are middleware. See [04-FOLDER-STRUCTURE.md](04-FOLDER-STRUCTURE.md).
- **Web** separates route segments (`app/`) from reusable `components/`, server access in `lib/api/`, realtime in `lib/realtime/`, WebRTC in `lib/webrtc/`. Dashboards (`/admin`, `/dashboard`) are route groups guarded by role.
- **Mobile** is clean-architecture: `data` (Room, retrofit, webrtc, discovery) / `domain` (use-cases, models) / `ui` (Compose screens + viewmodels). A `SignalingChannel` interface has `CloudSignaling` and `LanSignaling` implementations feeding one `CallEngine`.

## 8. Hybrid transport engine (the heart of the system)

Both clients implement the same abstraction so calls/messages are transport-agnostic:

```
interface SignalingChannel {
    connect()
    sendOffer(sdp); sendAnswer(sdp); sendIce(candidate)
    onOffer; onAnswer; onIce; onHangup
}

CloudSignaling  → Socket.IO to backend  (online)
LanSignaling    → mDNS discovery + direct TCP/UDP socket on LAN (offline)

TransportSelector picks the channel per call:
   discovered-on-LAN? → LanSignaling (host candidates only, no cloud, no TURN)
   else online?        → CloudSignaling (STUN → TURN fallback)
   else                → offline queue / missed
```

The `PeerConnection` (WebRTC) is identical in both cases — only where the SDP/ICE
messages travel differs. This is what makes "cloud never carries local media" true by
construction. Full detail in [06-OFFLINE-HYBRID.md](06-OFFLINE-HYBRID.md).

## 9. Security & performance (summary)

Argon2id passwords · JWT access (15m) + rotating refresh (30d, reuse-detected) ·
device-bound sessions · Zod validation on every input · Redis token-bucket rate limiting ·
Helmet + strict CORS allowlist · RBAC (user/admin) · E2E-encrypted messages ·
DTLS-SRTP media · short-lived HMAC TURN credentials · presigned B2 URLs · audit log.
Full model in [07-SECURITY.md](07-SECURITY.md).

## 10. Deployment (summary)

| Component | Host |
|---|---|
| Backend API + Socket.IO | Render (Web Service, WebSocket-enabled) |
| PostgreSQL | Neon (prod + staging branch) |
| Redis | Upstash |
| Object storage | Backblaze B2 |
| TURN | coturn on a small VM (Fly.io/Hetzner/Render private) |
| Web | Vercel or Render static/SSR |
| Android | Play Store / signed APK |

CI/CD via GitHub Actions per package. Environments: `dev` (local), `staging` (Neon branch), `prod`. Secrets via host env vars only — never committed.

## 11. Scaling strategy

- **First bottleneck:** Socket.IO on a single Render instance. Fix: run multiple instances behind Render with the **Socket.IO Redis adapter** (Upstash) so presence/signaling fan-out works cross-instance.
- **DB:** Neon autoscales; add read replicas / connection pooler (PgBouncer) for read-heavy dashboards. Message table partitioned by month.
- **TURN:** the real cost center — scale horizontally, prefer P2P/LAN aggressively, meter bandwidth.
- **Media storage:** B2 scales independently; lifecycle-expire old recordings.
- **Presence writes:** already in Redis with TTL; batch heartbeats (client every 20–30s).

## 12. Risks & trade-offs

| Risk / decision | Trade-off | Rationale |
|---|---|---|
| Offline peer trust without a server | TOFU + cached keys can't do fresh revocation offline | Acceptable: sync revocations when online; QR pairing for first trust |
| Custom JWT vs. managed auth (Auth0/Clerk) | More code to secure | Requirement + full control over device-bound offline sessions |
| WebRTC on native Android | Steep API, large lib | Only mature way to get encrypted low-latency P2P + LAN media |
| Full Double Ratchet deferred to Phase 2 | v1 E2EE lacks per-message forward secrecy | X25519+AEAD sealed messages ship faster; ratchet is additive |
| coturn self-hosted | Ops burden + bandwidth cost | Managed TURN is pricey; we minimize usage via P2P/LAN preference |
| Socket.IO vs. raw WS | Slight overhead | Rooms, acks, reconnection, Redis adapter are worth it |
| mDNS reliability across OEM Wi-Fi | Some routers block multicast | Wi-Fi Direct fallback + manual pairing code |

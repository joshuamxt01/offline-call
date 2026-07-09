# 05 — Build Roadmap

Ordered so that each phase produces something runnable and each later phase depends only
on earlier ones. The backend control plane is the foundation — everything else talks to it.

## Phase 0 — Foundations (repo + contracts)
- [ ] Monorepo + workspaces + `/shared` (event names, DTOs, zod schemas, error codes)
- [ ] `database/schema.sql` + Drizzle schema + first migration + seed (admin/demo)
- [ ] `docker-compose.dev.yml` (local Postgres + Redis) for offline development
- [ ] `.env.example` for each package

## Phase 1 — Backend control plane (the foundation)
- [ ] Express app skeleton, config (env/db/redis/storage), central error + logger
- [ ] Auth module: register, login (Argon2id), JWT access + refresh rotation, `/auth/me`
- [ ] Device registration + verification + device keys endpoints
- [ ] Middleware: auth, rbac, zod validate, Redis rate-limit
- [ ] Users + contacts modules (search, request, accept, block)
- [ ] Socket.IO server + Redis adapter + handshake auth + presence/heartbeat
- [ ] Messaging: `message:send/new/delivered/read`, REST fallback + sync endpoints
- [ ] Signaling: `call:*` + `signal:*` + Redis call-state machine
- [ ] Media: B2 presigned upload/download + commit
- [ ] TURN credentials endpoint (HMAC)
- [ ] Admin module + audit log

## Phase 2 — Web client (mobile-first PWA + dashboards)
- [ ] Design system (Tailwind tokens, dark/light, motion) matching mobile
- [ ] Auth screens + session/token handling
- [ ] Realtime provider (socket) + presence
- [ ] Contacts + chat thread (text, delivery/read, typing, offline queue)
- [x] WebRTC engine + transport selector; voice call UI; video call UI
- [x] Voice notes + video notes (record/preview/send/play) via B2 — E2E-encrypted
- [ ] User dashboard (profile, devices, call/message history, recordings, security)
- [ ] Admin dashboard (users, devices, networks, stats, permissions, call log)
- [ ] PWA manifest + service worker (installable, offline shell)

## Phase 3 — Android client (primary)
- [ ] Project scaffold: Compose, Hilt, Retrofit, Socket.IO, WebRTC, Room, lazysodium
- [ ] Theme matching web; navigation
- [ ] Auth (register/login/verify) + secure token storage (EncryptedSharedPrefs/Keystore)
- [ ] Contacts + presence
- [ ] Chat + Room-backed offline queue + sync on reconnect
- [ ] CallEngine + CloudSignaling; voice call (incoming/outgoing/in-call, mute, speaker, timer)
- [x] Video call (camera, front/back switch, preview, enable/disable, fullscreen)
- [x] Voice + video recording/messages (MediaRecorder + system camera, E2E-encrypted)
- [ ] Foreground call service + FCM push for incoming calls

## Phase 4 — Offline / LAN hybrid (the differentiator)
- [ ] NSD (mDNS) advertise/discover `_nexa._tcp` with identity TXT records
- [ ] LanSignaling channel (direct socket SDP/ICE exchange)
- [ ] Wi-Fi Direct fallback when no shared AP
- [ ] Offline auth: cached keys, QR pairing, TOFU trust
- [ ] TransportSelector wiring (LAN-first, cloud fallback) on both call + chat
- [ ] Offline message store-and-forward; reconcile on reconnect
- [ ] Web LAN mode (mDNS not available in browser → local relay helper / same-LAN Socket.IO)

## Phase 5 — Hardening & polish
- [ ] E2EE upgrade to Double Ratchet; key rotation UX
- [ ] Multi-instance Socket.IO (Redis adapter) load test; TURN load test
- [ ] Push notifications, block/report, message search
- [ ] Observability (structured logs, metrics, health checks), backups, rate-limit tuning
- [ ] Play Store release + web deploy (Render/Vercel) + coturn provisioning

## Demo / portfolio angle
- Two phones on airplane-mode Wi-Fi hotspot calling each other with **no internet** — the
  standout demo. Show a network trace proving media never touches the cloud.
- Metrics to highlight: call setup latency (LAN vs. cloud), % calls kept P2P (no TURN),
  E2EE message throughput, reconnect/sync correctness.

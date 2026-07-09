# 04 — Folder Structure

## Root (monorepo)
```
nexa/
├── backend/
├── web/
├── mobile/
├── database/
├── shared/
├── infra/
├── docs/
├── package.json          # workspaces: backend, web, shared
└── README.md
```

## backend/ (Node + Express + Socket.IO)
```
backend/
├── src/
│   ├── index.ts                 # boot: express + http + socket.io + graceful shutdown
│   ├── app.ts                   # express app (middleware, routes mount)
│   ├── config/
│   │   ├── env.ts               # validated env (zod)
│   │   ├── db.ts                # Neon/Drizzle client
│   │   ├── redis.ts             # Upstash client
│   │   └── storage.ts           # Backblaze B2 (S3) client
│   ├── middleware/
│   │   ├── auth.ts              # JWT verify → req.user/req.device
│   │   ├── rbac.ts              # role guard
│   │   ├── validate.ts          # zod body/query/params
│   │   ├── rateLimit.ts         # Redis token bucket
│   │   └── error.ts             # central error → JSON
│   ├── modules/                 # feature-first (routes+controller+service+repo per module)
│   │   ├── auth/
│   │   ├── users/
│   │   ├── contacts/
│   │   ├── devices/
│   │   ├── keys/
│   │   ├── conversations/
│   │   ├── messages/
│   │   ├── calls/
│   │   ├── media/
│   │   ├── networks/
│   │   └── admin/
│   ├── realtime/
│   │   ├── io.ts                # socket.io server + Redis adapter
│   │   ├── auth.ts              # handshake auth
│   │   ├── presence.ts          # heartbeat/presence handlers
│   │   ├── messaging.ts         # message:* handlers
│   │   ├── signaling.ts         # call:* + signal:* handlers
│   │   └── callState.ts         # Redis-backed call state machine
│   ├── db/
│   │   ├── schema.ts            # Drizzle schema (mirrors /database)
│   │   └── repositories/        # data access reused by REST + realtime
│   ├── lib/                     # crypto, jwt, argon, turnCreds, ids(ulid), logger
│   └── types/
├── migrations/                  # drizzle SQL migrations
├── tests/
├── .env.example
├── Dockerfile
└── package.json
```

## web/ (Next.js App Router)
```
web/
├── src/
│   ├── app/
│   │   ├── (marketing)/         # landing
│   │   ├── (auth)/login, register
│   │   ├── (app)/
│   │   │   ├── chats/[id]/      # chat thread
│   │   │   ├── calls/           # call history + in-call UI
│   │   │   ├── contacts/
│   │   │   └── settings/
│   │   ├── dashboard/           # USER dashboard (profile, devices, history, recordings, security)
│   │   ├── admin/               # ADMIN dashboard (users, devices, networks, stats, permissions)
│   │   ├── layout.tsx           # theme provider, socket provider
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                  # buttons, inputs, sheets, dialogs (design system)
│   │   ├── call/                # CallScreen, IncomingCall, VideoTiles, controls
│   │   ├── chat/                # MessageList, Composer, VoiceNote, VideoNote
│   │   ├── contacts/, presence/
│   │   └── dashboard/, admin/
│   ├── lib/
│   │   ├── api/                 # typed REST client (from /shared)
│   │   ├── realtime/            # socket.io-client wrapper + hooks
│   │   ├── webrtc/              # PeerConnection engine, transport selector
│   │   ├── crypto/              # libsodium (wasm) E2EE
│   │   ├── store/               # zustand stores
│   │   └── theme/               # dark/light
│   ├── hooks/
│   └── types/
├── public/                      # PWA manifest, icons, service worker
├── .env.example
└── package.json
```

## mobile/ (Kotlin, Jetpack Compose, clean architecture)
```
mobile/
├── app/
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml   # perms: CAMERA, RECORD_AUDIO, INTERNET,
│       │                         # ACCESS_WIFI_STATE, CHANGE_WIFI_MULTICAST_STATE,
│       │                         # NEARBY_WIFI_DEVICES, FOREGROUND_SERVICE (call)
│       ├── java/app/nexa/
│       │   ├── NexaApp.kt
│       │   ├── di/               # Hilt modules
│       │   ├── data/
│       │   │   ├── local/        # Room: message queue, cache, keys
│       │   │   ├── remote/       # Retrofit REST client
│       │   │   ├── realtime/     # Socket.IO client
│       │   │   ├── webrtc/       # PeerConnectionFactory, CallEngine
│       │   │   ├── signaling/    # SignalingChannel, CloudSignaling, LanSignaling
│       │   │   ├── discovery/    # NsdDiscovery (mDNS) + WifiDirectDiscovery
│       │   │   ├── crypto/       # libsodium (lazysodium) E2EE + keystore
│       │   │   └── protocol/     # event names + DTOs mirroring /shared
│       │   ├── domain/
│       │   │   ├── model/
│       │   │   ├── repository/   # interfaces
│       │   │   └── usecase/      # StartCall, SendMessage, SyncMessages, DiscoverPeers...
│       │   ├── service/          # CallForegroundService, ConnectivityService
│       │   └── ui/
│       │       ├── theme/        # Material3 dark/light matching web
│       │       ├── auth/         # register, login, verify (screen + viewmodel)
│       │       ├── contacts/
│       │       ├── chat/
│       │       ├── call/         # IncomingCall, OutgoingCall, InCall (voice/video)
│       │       ├── recorder/     # voice + video recording
│       │       └── settings/
│       └── res/
├── build.gradle.kts
└── settings.gradle.kts
```

## database/
```
database/
├── schema.sql               # canonical DDL (readable reference)
├── migrations/              # ordered SQL migrations
├── seeds/                   # admin + demo data
└── README.md
```

## shared/
```
shared/
├── src/
│   ├── events.ts            # Socket.IO event name constants
│   ├── dto.ts               # request/response TS types
│   ├── schemas.ts           # zod schemas
│   └── errors.ts            # error codes
└── package.json
```

## infra/
```
infra/
├── coturn/                  # turnserver.conf, docker-compose
├── docker-compose.dev.yml   # local postgres+redis for offline dev
└── github-actions/          # CI workflows
```

# Nexa — Private Hybrid Communication Platform

> Voice, video, chat, and media messaging that works **online through the cloud** and
> **offline over local Wi‑Fi** — with the cloud handling identity and discovery, and the
> devices handling the actual media stream peer‑to‑peer.

Nexa is a private communication ecosystem (concept comparable to WhatsApp calling +
local‑network intercom + private enterprise comms). Media never routes through the cloud
when peers can reach each other directly; the cloud is a **control plane**, not a media relay.

---

## Monorepo layout

```
nexa/
├── backend/     Node.js + Express + Socket.IO control plane (REST API + signaling)
├── web/         Next.js (TypeScript + Tailwind) mobile-first web app + dashboards
├── mobile/      Native Android client (Kotlin, Jetpack Compose, WebRTC)
├── database/    Neon PostgreSQL schema, migrations, seeds
├── shared/      Shared protocol contracts (event names, DTO types, error codes)
├── infra/       TURN/STUN (coturn), Docker, deployment manifests
└── docs/        Architecture, API, schema, security, roadmap
```

## Documentation index

| Doc | Purpose |
|-----|---------|
| [docs/01-ARCHITECTURE.md](docs/01-ARCHITECTURE.md) | System design, hybrid control/data plane, tech stack, trade-offs |
| [docs/02-DATABASE-SCHEMA.md](docs/02-DATABASE-SCHEMA.md) | Conceptual + physical PostgreSQL schema, Redis keyspace |
| [docs/03-API-REFERENCE.md](docs/03-API-REFERENCE.md) | REST endpoints + Socket.IO realtime protocol |
| [docs/04-FOLDER-STRUCTURE.md](docs/04-FOLDER-STRUCTURE.md) | Per-app folder blueprint |
| [docs/05-ROADMAP.md](docs/05-ROADMAP.md) | Phased build order |
| [docs/06-OFFLINE-HYBRID.md](docs/06-OFFLINE-HYBRID.md) | Deep dive: local discovery, offline auth, LAN signaling |
| [docs/07-SECURITY.md](docs/07-SECURITY.md) | Threat model, crypto, auth, hardening |

## Core principle: control plane vs. data plane

```
                       ┌─────────────────────── CONTROL PLANE (cloud) ───────────────────────┐
                       │  Identity · Auth · Device registry · Discovery · Presence · Signaling │
                       │  Message sync · Permissions · Media metadata                          │
                       └──────────────────────────────────────────────────────────────────────┘
                                        ▲                              ▲
                                        │ REST + Socket.IO             │
                                        │ (signaling only)             │
                        ┌───────────────┴───────┐        ┌─────────────┴───────────┐
                        │      Device A          │        │       Device B          │
                        └───────────────┬───────┘        └─────────────┬───────────┘
                                        │                              │
                                        └──────── DATA PLANE ──────────┘
                                          WebRTC media (DTLS-SRTP)
                                   P2P direct · or LAN · or TURN fallback
                                   *** cloud never carries media ***
```

## Quickstart

See each package's README. High level:

```bash
# backend
cd backend && cp .env.example .env && npm install && npm run migrate && npm run dev

# web
cd web && cp .env.example .env.local && npm install && npm run dev

# mobile
# open mobile/ in Android Studio, set API_BASE_URL in local.properties, run
```

# @nexa/backend

Node.js + Express + Socket.IO control plane for Nexa. REST API (`/api/v1`) plus the
realtime protocol (`/rt` Socket.IO namespace) for presence, messaging, and WebRTC
call signaling. Runs via `tsx` (no build step).

## Run locally

```bash
# 1. Start Postgres + Redis (+ optional MinIO/coturn)
npm run infra:up            # from repo root

# 2. Configure + install
cp .env.example .env        # defaults already target the local docker stack
npm install                 # from repo root (workspaces) or here

# 3. Apply schema + seed demo users
npm run migrate
npm run seed                # admin@nexa.local / Password123!

# 4. Start
npm run dev                 # http://localhost:4000/health
```

## Layout
```
src/
  config/     env, db (Neon/Postgres), redis (Upstash), storage (B2/S3)
  lib/        jwt, password (argon2), ids, turn creds, presence, mappers, logger
  middleware/ auth, rbac, validate (zod), rateLimit (redis), error
  db/         Drizzle schema, migrate, seed
  modules/    auth users contacts devices keys conversations messages calls media networks admin
  realtime/   io, auth, presence, messaging, signaling, callState, emitter
  app.ts      express app
  index.ts    http server + socket.io + graceful shutdown
```

## Architecture notes
- **Control plane only.** The server relays SDP/ICE for online calls but never carries
  media — WebRTC keeps media peer-to-peer (or on the LAN offline). See `docs/06-OFFLINE-HYBRID.md`.
- **Durable vs ephemeral.** Postgres is the system of record; Redis holds presence, live
  call state, and rate-limit counters (all TTL'd). Losing Redis degrades presence only.
- **E2EE.** The server stores only message ciphertext + nonce; it cannot read message
  bodies. Media is encrypted client-side before upload.
- **Scaling.** Socket.IO uses the Redis adapter so presence/signaling fan out across
  multiple instances.

## Key env vars
See `.env.example`. Production swaps local URLs for Neon (`DATABASE_URL`), Upstash
(`REDIS_URL`), Backblaze B2 (`S3_*`), and a real `TURN_SECRET` matching coturn.

## API + protocol
Full reference: [`docs/03-API-REFERENCE.md`](../docs/03-API-REFERENCE.md).

# 03 — API Reference

Two surfaces:
- **REST** (`/api/v1/...`) for request/response CRUD, auth, media, history.
- **Socket.IO** realtime protocol for presence, signaling, live delivery, call events.

Auth: `Authorization: Bearer <accessJWT>` on REST; `auth` handshake payload on Socket.IO.
All request/response bodies validated with Zod (shared schemas in `/shared`).

---

## REST

### Conventions
- Base: `https://api.nexa.app/api/v1`
- Errors: `{ "error": { "code": "STRING_CODE", "message": "human", "details"?: {...} } }`
- Success: resource object or `{ "data": [...], "page": {...} }` for lists.
- Idempotency: mutating client-authored resources (messages) accept a client `id` (ULID).

### Auth
| Method | Path | Purpose | Request | Response |
|---|---|---|---|---|
| POST | `/auth/register` | Create account | `{username,email,password,deviceName,platform,identityPub}` | `{user, device, accessToken, refreshToken}` |
| POST | `/auth/login` | Password login + register device | `{emailOrUsername,password,deviceName,platform,identityPub}` | `{user, device, accessToken, refreshToken}` |
| POST | `/auth/refresh` | Rotate tokens | `{refreshToken}` | `{accessToken, refreshToken}` |
| POST | `/auth/logout` | Revoke current device session | `{refreshToken}` | `204` |
| POST | `/auth/devices/:id/verify` | Confirm a new device | `{code}` | `{device}` |
| GET | `/auth/me` | Current user + device | — | `{user, device}` |

### Users & contacts
| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/users/search?q=` | Find users by username | rate-limited |
| GET | `/users/:id` | Public profile | |
| PATCH | `/users/me` | Update profile | display name, bio, avatar |
| GET | `/contacts` | List contacts + presence snapshot | joins Redis presence |
| POST | `/contacts` | Send contact request | `{contactUserId}` → `pending` |
| PATCH | `/contacts/:id` | Accept / block | `{state:'accepted'|'blocked'}` |
| DELETE | `/contacts/:id` | Remove contact | |

### Devices & keys
| Method | Path | Purpose |
|---|---|---|
| GET | `/devices` | List my devices |
| DELETE | `/devices/:id` | Revoke a device (logs it out everywhere) |
| GET | `/keys/:userId` | Fetch a user's device public keys + a one-time prekey (E2EE session setup) |
| POST | `/keys/prekeys` | Replenish my one-time prekey pool |

### Conversations & messages (history / sync)
| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/conversations` | List threads w/ last message + unread | |
| POST | `/conversations` | Create/get direct conversation | `{participantId}` idempotent |
| GET | `/conversations/:id/messages?before=&limit=` | Paginated history | ciphertext returned |
| POST | `/conversations/:id/messages` | **Fallback** send (when socket down) | `{id,type,ciphertext,nonce,mediaObjectId?}` |
| POST | `/messages/sync` | Bulk push queued offline messages | `{messages:[...]}` → dedby id |
| GET | `/messages/sync?since=` | Pull messages missed while offline | cursor by `server_created_at` |

### Media (Backblaze B2)
| Method | Path | Purpose | Flow |
|---|---|---|---|
| POST | `/media/upload-url` | Get presigned upload | `{kind,contentType,sizeBytes,durationMs?}` → `{objectId, uploadUrl, method, headers}` |
| POST | `/media/:objectId/commit` | Mark upload complete | stores metadata row |
| GET | `/media/:objectId/download-url` | Presigned download | authz: must be conversation member/owner |

**Voice/video messages** use this flow: the client records → encrypts the blob with a
random secretbox key → `PUT`s the ciphertext to `uploadUrl` → `commit`s → sends a chat
message of `type: voice|video` whose (E2E-encrypted) body is a JSON envelope
`{mediaObjectId, key, nonce, mimeType, durationMs, kind}`. The recipient decrypts the
message, fetches `download-url`, downloads the ciphertext, and decrypts it with the key.
The server and B2 only ever hold ciphertext.

> **B2 CORS (web only):** browser `PUT`/`GET` to the presigned URLs require CORS rules on
> the bucket. Apply [`infra/b2-cors.json`](../../infra/b2-cors.json) (set your web origin)
> via the B2 console or `b2 update-bucket --corsRules`. Native Android has no CORS.

### Calls (history; live parts over Socket.IO)
| Method | Path | Purpose |
|---|---|---|
| GET | `/calls?before=&limit=` | Call history |
| GET | `/calls/:id` | Call detail + participants |
| GET | `/turn/credentials` | Short-lived HMAC TURN creds `{urls,username,credential,ttl}` |

### Networks (offline/LAN approval)
| Method | Path | Purpose |
|---|---|---|
| GET | `/networks` | My approved LANs |
| POST | `/networks` | Register/approve a LAN `{ssidHash,localIdentifier,label,permissions}` |
| PATCH | `/networks/:id` | Update permissions/approval |
| DELETE | `/networks/:id` | Remove |

### Admin (role=admin, RBAC-guarded)
| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/users?q=&status=` | Manage users |
| PATCH | `/admin/users/:id` | Suspend/activate/change role |
| GET | `/admin/devices` | All registered devices |
| GET | `/admin/networks` | All networks + approval queue |
| GET | `/admin/stats` | System status, active users, call stats |
| GET | `/admin/calls` | Global call log (metadata only) |
| GET | `/admin/audit` | Audit log |

---

## Socket.IO realtime protocol

Namespace `/rt`. Handshake: `{ auth: { accessToken } }` → server verifies JWT, binds
`deviceId`, joins personal room `user:{userId}` and `device:{deviceId}`, writes presence.

### Presence
| Direction | Event | Payload |
|---|---|---|
| C→S | `presence:heartbeat` | `{}` (every 20–30s) → refreshes Redis TTL |
| S→C | `presence:update` | `{userId, online, lastSeen}` (pushed to contacts) |
| C→S | `presence:subscribe` | `{userIds:[]}` subscribe to contacts' presence |

### Messaging (online realtime path)
| Direction | Event | Payload / ack |
|---|---|---|
| C→S | `message:send` | `{id,conversationId,type,ciphertext,nonce,mediaObjectId?}` → ack `{serverCreatedAt}` |
| S→C | `message:new` | full message to other members' devices |
| C→S | `message:delivered` | `{messageId}` (recipient device confirms receipt) |
| C→S | `message:read` | `{conversationId, upToMessageId}` |
| S→C | `message:receipt` | `{messageId,userId,delivered_at?,read_at?}` |
| C→S | `typing:start` / `typing:stop` | `{conversationId}` |
| S→C | `typing` | `{conversationId,userId,active}` |

### Call signaling (ONLINE path — cloud relays SDP/ICE only, never media)
| Direction | Event | Payload |
|---|---|---|
| C→S | `call:invite` | `{callId,calleeId,type:'voice'|'video'}` |
| S→C | `call:incoming` | `{callId,caller,type}` → all callee devices ring |
| C→S | `call:answer` | `{callId}` (first device to answer wins; others get cancel) |
| C→S | `call:reject` | `{callId,reason}` |
| S→C | `call:answered` / `call:rejected` / `call:cancelled` | `{callId,byDeviceId?}` |
| C→S | `signal:offer` | `{callId, sdp}` |
| C→S | `signal:answer` | `{callId, sdp}` |
| C→S | `signal:ice` | `{callId, candidate}` |
| S→C | `signal:offer` / `signal:answer` / `signal:ice` | forwarded to the peer device |
| C→S | `call:end` | `{callId}` |
| S→C | `call:ended` | `{callId, duration, reason}` |

**Call state machine (Redis `call:{callId}`):**
`ringing → answered → connected → ended` with side-exits `rejected | missed | failed`.
Ring timeout (`call:invite:{callId}` TTL 45s) auto-transitions to `missed`.

### Offline / LAN path (no server involved)
The **same** `signal:offer/answer/ice` message shapes are exchanged, but over the
`LanSignaling` channel (mDNS-discovered peer + direct socket). See
[06-OFFLINE-HYBRID.md](06-OFFLINE-HYBRID.md) for the LAN wire format and discovery TXT records.

### Errors & acks
- Every C→S event supports an ack callback: `(err, data)`.
- Auth failure → `error` event `{code:'UNAUTHENTICATED'}` then disconnect.
- Rate-limit exceeded → ack `{error:{code:'RATE_LIMITED', retryAfter}}`.

---

## Shared contracts (`/shared`)
Event names, DTO TypeScript types, Zod schemas, and error codes live in `/shared` and are
imported by both `backend` and `web`. The Android client mirrors them in
`mobile/.../data/protocol/` (kept in sync via the same doc). This guarantees the wire
protocol is defined once.

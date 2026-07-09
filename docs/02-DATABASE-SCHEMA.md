# 02 — Data Model

Two stores by design:
- **Neon PostgreSQL** — durable system of record (accounts, contacts, message ledger, call ledger, media metadata, networks).
- **Upstash Redis** — ephemeral, high-churn state with TTLs (presence, heartbeats, live call state, signaling rooms, rate limits). Never the source of truth.

---

## A. PostgreSQL (conceptual + physical)

### Entity relationships

```
users ──1:N── devices ──1:N── device_keys
  │              │
  │              └──1:N── refresh_tokens
  │
  ├──1:N── contacts (self-ref: owner_id → contact_user_id)
  │
  ├──N:M── conversations (via conversation_members)
  │             └──1:N── messages ──1:N── message_receipts
  │                          └──0:1── media_objects
  │
  ├──1:N── calls (caller) ──1:N── call_participants
  │
  ├──1:N── networks (approved LANs)
  │
  └──1:N── audit_log
```

### Tables

**users**
| column | type | notes |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| username | citext UNIQUE NOT NULL | case-insensitive handle |
| email | citext UNIQUE NOT NULL | |
| password_hash | text NOT NULL | Argon2id |
| display_name | text | |
| avatar_object_id | uuid FK→media_objects | nullable |
| bio | text | |
| status | text | `active` \| `suspended` \| `deleted` |
| role | text NOT NULL default `user` | `user` \| `admin` (RBAC) |
| last_seen_at | timestamptz | denormalized from presence for dashboards |
| created_at / updated_at | timestamptz | |

**devices** — a user may have many
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK→users ON DELETE CASCADE | |
| device_name | text | "Pixel 8", "Chrome on Mac" |
| platform | text | `android` \| `web` |
| push_token | text | FCM/web-push, nullable |
| verified | boolean default false | device verification gate |
| last_active_at | timestamptz | |
| last_network_id | uuid FK→networks | last LAN seen on, nullable |
| created_at | timestamptz | |
| Index | `(user_id)`, `(last_active_at)` | |

**device_keys** — public key material for E2EE (private keys never leave the device)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| device_id | uuid FK→devices ON DELETE CASCADE | |
| identity_pub | bytea | X25519/Ed25519 identity public key |
| signed_prekey | bytea | rotated signed prekey |
| signed_prekey_sig | bytea | signature over prekey |
| one_time_prekeys | jsonb | pool of one-time prekeys (X3DH-lite) |
| algo | text | e.g. `x25519-xchacha20poly1305` |
| created_at / rotated_at | timestamptz | |

**refresh_tokens** — rotation + reuse detection
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| device_id | uuid FK→devices ON DELETE CASCADE | |
| token_hash | text NOT NULL | store hash, never raw |
| family_id | uuid | rotation family; reuse of a used token revokes the family |
| used | boolean default false | |
| expires_at | timestamptz | |
| created_at | timestamptz | |
| Index | `(device_id)`, `(token_hash)` | |

**contacts** — directed relationship w/ request lifecycle
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid FK→users | who owns this contact row |
| contact_user_id | uuid FK→users | the other party |
| alias | text | owner's nickname for them |
| state | text | `pending` \| `accepted` \| `blocked` |
| created_at / updated_at | timestamptz | |
| Constraint | UNIQUE `(owner_id, contact_user_id)`; CHECK owner ≠ contact | |

**conversations** — supports 1:1 now, groups later
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| type | text | `direct` \| `group` |
| title | text | groups only |
| created_by | uuid FK→users | |
| created_at | timestamptz | |

**conversation_members**
| column | type | notes |
|---|---|---|
| conversation_id | uuid FK→conversations ON DELETE CASCADE | |
| user_id | uuid FK→users | |
| role | text | `member` \| `admin` |
| joined_at | timestamptz | |
| last_read_message_id | uuid | read-cursor |
| PK | `(conversation_id, user_id)` | |

**messages** — ciphertext ledger (server stores encrypted blobs it can't read)
| column | type | notes |
|---|---|---|
| id | uuid PK | client-generatable (ULID) for offline-first ordering |
| conversation_id | uuid FK→conversations | |
| sender_id | uuid FK→users | |
| type | text | `text` \| `voice` \| `video` \| `system` |
| ciphertext | bytea | E2E-encrypted body |
| nonce | bytea | AEAD nonce |
| media_object_id | uuid FK→media_objects | for voice/video |
| client_created_at | timestamptz | device clock (for ordering) |
| server_created_at | timestamptz default now() | authoritative arrival time |
| status | text | `sent` \| `delivered` \| `read` (coarse; per-recipient in receipts) |
| Index | `(conversation_id, server_created_at)`; partition by month | |

**message_receipts** — per-recipient delivery/read (accurate for groups + multi-device)
| column | type | notes |
|---|---|---|
| message_id | uuid FK→messages ON DELETE CASCADE | |
| user_id | uuid FK→users | recipient |
| delivered_at | timestamptz | |
| read_at | timestamptz | |
| PK | `(message_id, user_id)` | |

**calls** — call ledger
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| conversation_id | uuid FK→conversations | nullable (ad-hoc) |
| caller_id | uuid FK→users | |
| type | text | `voice` \| `video` |
| transport | text | `p2p` \| `lan` \| `turn` — how media flowed |
| status | text | `ringing` \| `answered` \| `rejected` \| `missed` \| `ended` \| `failed` |
| started_at | timestamptz | |
| answered_at | timestamptz | nullable |
| ended_at | timestamptz | nullable |
| duration_seconds | int | computed on end |
| end_reason | text | `hangup` \| `timeout` \| `error` |
| Index | `(caller_id, started_at)` | |

**call_participants**
| column | type | notes |
|---|---|---|
| call_id | uuid FK→calls ON DELETE CASCADE | |
| user_id | uuid FK→users | |
| device_id | uuid FK→devices | which device took it |
| joined_at / left_at | timestamptz | |
| PK | `(call_id, user_id)` | |

**media_objects** — pointer to Backblaze B2 blob
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid FK→users | |
| kind | text | `avatar` \| `voice_note` \| `video_note` |
| bucket_key | text | B2 object key |
| content_type | text | |
| size_bytes | bigint | |
| duration_ms | int | audio/video length |
| encrypted | boolean default true | media encrypted client-side before upload |
| created_at | timestamptz | |

**networks** — approved LANs for offline mode + permissions
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid FK→users | who approved it |
| ssid_hash | text | hashed SSID (privacy) |
| bssid_hash | text | hashed router MAC, nullable |
| local_identifier | text | mDNS service id / group name |
| label | text | "Home", "Site B" |
| permissions | jsonb | e.g. `{ "allowDiscovery": true, "autoAcceptCalls": false }` |
| approved | boolean default false | admin/user gate |
| created_at | timestamptz | |

**audit_log** — security-relevant events
| column | type | notes |
|---|---|---|
| id | bigserial PK | |
| actor_user_id | uuid FK→users | nullable (system) |
| action | text | `login`, `device.verify`, `contact.block`, `admin.suspend_user`, … |
| target | text | affected entity id |
| ip | inet | |
| metadata | jsonb | |
| created_at | timestamptz default now() | |

### Indexing & integrity notes
- All FKs indexed; hot query paths: contacts by owner, messages by conversation+time, calls by user+time.
- `messages` partitioned monthly (`PARTITION BY RANGE (server_created_at)`) for prune-ability.
- `citext` for username/email → case-insensitive uniqueness.
- Soft-delete users (`status='deleted'`) to preserve ledger integrity; hard-delete media on request.

---

## B. Redis (Upstash) keyspace

| Key | Type | TTL | Purpose |
|---|---|---|---|
| `presence:user:{userId}` | hash `{deviceId: lastBeatEpoch}` | 60s refresh | which devices are online |
| `presence:online` | sorted set (score=lastBeat) | — | global online index for dashboards |
| `heartbeat:device:{deviceId}` | string | 45s | liveness; expiry ⇒ offline |
| `socket:device:{deviceId}` | string → socketId | session | route events to the right socket |
| `call:{callId}` | hash `{state, caller, callee, transport, startedAt}` | 2h | live call state machine |
| `call:invite:{callId}` | string | 45s | ring timeout |
| `signal:room:{callId}` | set of deviceIds | 2h | signaling participants |
| `typing:{conversationId}` | set of userIds | 5s | typing indicators |
| `ratelimit:{scope}:{id}` | string counter | window | token-bucket rate limiting |
| `mailbox:{userId}` | list | until drained | offline message delivery pointers (ids to fetch) |

**Rules:** Redis is a cache/coordination layer. Losing it degrades presence/live-state but never loses accounts, messages, or call history (all in Postgres). On reconnect, clients reconcile from Postgres, not Redis.

---

## C. Migrations & seeds
- Drizzle ORM migrations in `database/migrations` (also mirrored from `backend`).
- `database/seeds` provides an admin user, demo users, and a demo approved network for local dev.
- Neon **branching** used for staging: branch prod schema, run new migration, verify, promote.

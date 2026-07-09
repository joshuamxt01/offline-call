# 07 — Security & Threat Model

## Threat model (who we defend against)
1. **Network eavesdropper** (LAN or internet) — sees traffic, wants message/media content.
2. **Curious/compromised server** — we minimize what the server *can* read (E2EE, no media).
3. **Credential attacker** — password guessing, token theft, replay.
4. **Malicious peer on the LAN** — impersonation, spoofed discovery.
5. **Abusive user** — spam, enumeration, DoS.

## Controls

### Passwords & accounts
- **Argon2id** hashing (tuned memory/time cost), per-user salt.
- Password policy + breached-password rejection (optional HIBP k-anonymity).
- Login rate-limited + exponential backoff; generic error messages (no user enumeration).

### Sessions & tokens
- **JWT access token** (~15 min, signed HS256/EdDSA), carries `sub`, `did` (deviceId), `role`.
- **Refresh token** (~30 days) stored **hashed** server-side, in a rotation **family**;
  presenting a used refresh token ⇒ **reuse detection** ⇒ revoke the whole family.
- Tokens are **device-bound** (`did`); revoking a device kills its sessions.
- Mobile stores tokens in Android **Keystore / EncryptedSharedPreferences**; web uses
  httpOnly-style handling (token in memory + refresh via secure cookie where feasible).

### Transport
- HTTPS/WSS everywhere. HSTS. Helmet security headers on web + API.
- Strict **CORS allowlist** (web origin only). Socket.IO CORS locked to known origins.

### Authorization (RBAC + resource checks)
- Roles: `user`, `admin`. `/admin/*` guarded by `rbac('admin')`.
- Every resource access re-checks ownership/membership (e.g., you can only fetch a media
  download URL for a conversation you belong to). No IDOR by object id alone.

### Input validation
- **Zod** schemas validate body/query/params on every REST route and every Socket.IO event.
- Parameterized queries only (Drizzle) — no string-built SQL. Output encoding on web (React
  escaping) + sanitization for any rich content.

### Rate limiting & abuse
- Redis **token-bucket** per identity/IP on: auth, user search, contact requests, message
  send, media upload-url, TURN creds. `429` + `retryAfter`.
- User search returns bounded results; no bulk enumeration; contact requests throttled.

### End-to-end encryption (messages & media)
- **Session setup:** X3DH-lite — fetch peer's identity + signed prekey + one-time prekey via
  `GET /keys/:userId`; derive a shared secret via X25519 ECDH.
- **Message encryption:** XChaCha20-Poly1305 AEAD; server stores only `ciphertext + nonce`
  and cannot read content. Same scheme encrypts LAN frames.
- **Media:** encrypted **client-side** before upload to B2; the server/B2 hold ciphertext;
  the content key travels inside the E2E-encrypted message.
- **Phase 2:** upgrade to the **Double Ratchet** for per-message forward secrecy &
  post-compromise security. libsodium on both JVM (lazysodium) and JS (libsodium-wasm).

### WebRTC media security
- WebRTC mandates **DTLS-SRTP** — media encrypted end-to-end by the peer connection itself.
- DTLS fingerprints are exchanged inside the (already E2E-trusted) signaling path, binding
  the media session to the verified peer.
- **TURN** credentials are **short-lived HMAC** (`username = expiry:userId`,
  `credential = HMAC(secret, username)`), issued per session, never static.

### Offline/LAN specific
- Discovery TXT records are **signed** (Ed25519) and verified against cached/paired keys →
  defeats LAN impersonation.
- First-time offline trust via **QR pairing + safety number** (TOFU), like Signal's model.
- LAN signaling frames are E2E-encrypted → hostile LAN can't read them.

### Data protection & privacy
- SSID/BSSID stored **hashed** (network privacy).
- Media presigned URLs are short-TTL and scoped to one object.
- Soft-delete accounts to preserve ledger integrity; honor hard-delete of media on request.
- **Audit log** for security events (login, device verify/revoke, admin actions, blocks).

### Secrets & ops
- All secrets via host **environment variables** (Render/Neon/Upstash/B2 dashboards); never
  committed. `.env.example` documents names only.
- Separate secrets per environment (dev/staging/prod). Rotate JWT & TURN secrets on schedule.
- Dependency scanning (npm audit / Dependabot) + minimal container images.

## Security checklist (pre-launch)
- [ ] Argon2id params load-tested; login/refresh flows reuse-tested
- [ ] All routes behind auth except register/login/health; RBAC on admin
- [ ] Zod on every input; no raw SQL; CORS + Helmet locked
- [ ] Rate limits on all abuse-prone endpoints
- [ ] E2EE verified (server DB shows only ciphertext); media encrypted at rest
- [ ] TURN creds short-lived; presigned URLs short-TTL + authz-checked
- [ ] Signed discovery + QR pairing verified against MITM on LAN
- [ ] Secrets only in env; audit logging on; backups configured

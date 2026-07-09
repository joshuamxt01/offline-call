# @nexa/web

Mobile-first Next.js (App Router) client for Nexa — the full communication app
**plus** the user and admin dashboards. Shares the same design language the Android
app mirrors.

## Run

```bash
cp .env.example .env.local     # point NEXT_PUBLIC_API_URL at the backend
npm install                    # from repo root (workspaces)
npm run dev                    # http://localhost:3000
```
The backend must be running (see `../backend`). Demo login: `alice@nexa.local` / `Password123!`.

## What's inside
- **Auth** — register/login, X25519 identity keypair generated in-browser, bearer-token session with silent refresh.
- **Contacts** — search, add, presence dots (live via Socket.IO), one-tap call/message.
- **Chat** — end-to-end encrypted (libsodium `crypto_box`), delivery/read receipts, typing indicators, offline REST fallback.
- **Voice & video messages** — record in-browser (MediaRecorder), encrypt with a per-blob secretbox key, upload ciphertext to B2, play back with an inline audio/video player. Requires B2 CORS (`infra/b2-cors.json`).
- **Calls** — WebRTC voice + video: incoming/outgoing/in-call overlay, mute, camera toggle, camera flip, call timer, TURN fallback. **Media is peer-to-peer; the server only relays signaling.**
- **User dashboard** — activity stats, recent calls, devices, security (key fingerprint).
- **Admin dashboard** — tabbed: overview stats (live), user management (suspend/role), devices, networks, call log, audit.
- **PWA** — installable, dark/light, offline app-shell.

## Structure
```
src/
  app/
    (auth)/login, register        auth pages
    (app)/                        authenticated shell (sidebar + bottom nav + CallOverlay)
      chats, chats/[id]           conversation list + thread
      contacts, calls, settings
      dashboard                   user dashboard
      admin                       admin dashboard
  components/  ui/ call/ chat/ dashboard/ layout/
  lib/
    api/        typed REST client (+ token refresh)
    realtime/   Socket.IO provider
    webrtc/     PeerConnection engine + call store
    crypto/     libsodium E2EE
    store/      zustand (auth)
    theme.tsx   dark/light
```

## Design system
Tokens live in `src/app/globals.css` (CSS variables, light + dark) and
`tailwind.config.ts`. Indigo-violet primary, teal accent, slate neutrals — the same
palette the Android app implements in Compose.

## Notes / hardening
- Tokens are in `localStorage` (SPA bearer auth). httpOnly cookies would be stronger — documented in `docs/07-SECURITY.md`.
- E2EE is single-key-per-user for the MVP; Double Ratchet + multi-device is Phase 2.
- Browsers can't do mDNS, so web offline/LAN mode falls back to cloud; native Android is the full offline client (`docs/06-OFFLINE-HYBRID.md`).

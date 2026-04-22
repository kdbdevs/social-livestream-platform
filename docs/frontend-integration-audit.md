# Frontend Integration Audit

## 1. Audit `assets-frontend`

`assets-frontend` is a Stitch export made of standalone HTML screens, not a runnable React app.

Entry points discovered:

- `authentication_login_register/code.html`
- `home_discovery_page/code.html`
- `room_watch_high_performance_player/code.html`
- `wallet_financial_history/code.html`
- `creator_earnings_withdrawals/code.html`
- `host_dashboard/code.html`
- `host_application_states/code.html`
- `room_management_obs_setup/code.html`

Shared design patterns discovered:

- Top navigation with brand, search, wallet, go-live CTA
- Viewer-side left navigation and followed/live lists
- Creator Studio left navigation
- Dark editorial palette with `primary` purple highlight
- Repeated glass panels, rounded cards, bold display typography
- Repeated CTA patterns for auth, room cards, wallet cards, and creator workflow

Export limitations:

- No React structure, router, services, hooks, or typed models
- No central asset pipeline
- No state management
- No backend bindings

## 2. Important Pages and Components

Viewer-facing pages:

- Auth page
- Home / discovery listing
- Room watch page
- Wallet / transaction history

Creator-facing pages inside unified app:

- Host application states
- Creator dashboard
- Creator finance / withdrawal page
- Room setup / OBS configuration

Important reusable component families:

- Global top bars
- Viewer sidebar
- Creator sidebar
- Hero / live room cards
- Metric cards
- Ledger / stream tables
- Ingest config fields with copy action
- Chat panel and composer
- Gift action / drawer shell

## 3. Mapping Page -> Data -> Backend

| Page | Data / Action | Backend |
| --- | --- | --- |
| `/auth` | login | `POST /auth/login` |
| `/auth` | register | `POST /auth/register` |
| app bootstrap | current session | `GET /auth/me` |
| `/` | live room listing | `GET /rooms/live` |
| `/rooms/:roomId` | room detail | `GET /rooms/:id` |
| `/rooms/:roomId` | chat history | `GET /rooms/:id/chat` |
| `/rooms/:roomId` | follow state | `GET /hosts/:hostId/follow` |
| `/rooms/:roomId` | follow host | `POST /hosts/:hostId/follow` |
| `/rooms/:roomId` | unfollow host | `DELETE /hosts/:hostId/follow` |
| `/wallet` | wallet balances | `GET /wallets/me` |
| `/wallet` | wallet ledger | `GET /wallets/me/ledger` |
| `/creator/apply` | application state | `GET /host-applications/me` |
| `/creator/apply` | submit application | `POST /host-applications` |
| `/creator/dashboard` | host room list | `GET /rooms/my` |
| `/creator/dashboard` | per-room live summary | `GET /hosts/me/live-summary/:roomId` |
| `/creator/finance` | wallet balances | `GET /wallets/me` |
| `/creator/finance` | diamond ledger | `GET /wallets/me/ledger?currencyType=DIAMOND` |
| `/creator/finance` | withdrawal history | `GET /withdrawals/me` |
| `/creator/finance` | create withdrawal | `POST /withdrawals/requests` |
| `/creator/setup` | create draft room | `POST /rooms` |
| `/creator/rooms/:roomId/setup` | room detail | `GET /rooms/:id` |
| `/creator/rooms/:roomId/setup` | update draft room | `PATCH /rooms/:id` |
| `/creator/rooms/:roomId/setup` | publish room | `POST /rooms/:id/publish` |
| `/creator/rooms/:roomId/setup` | broadcast config | `GET /host/broadcast/config` |

## 4. Recommended Integration Structure

Implemented structure:

```text
apps/web-app
  /src
    /components
      layout.tsx
      media-player.tsx
    /features
      /auth
      /home
      /room
      /wallet
      /creator
    /lib
      api-client.ts
      env.ts
      format.ts
    /services
      auth-service.ts
      rooms-service.ts
      finance-service.ts
      host-application-service.ts
      social-service.ts
      realtime-service.ts
    /types
      contracts.ts
```

Architecture split:

- Presentation/UI lives in `components` and feature page files
- API access is centralized in `services/*`
- Envelope parsing and fetch handling live in `lib/api-client.ts`
- Feature/session state lives in `features/auth/session-store.ts`
- Local response schemas and typed adapters live in `types/contracts.ts`

## 5. Implemented Integration Decisions

- Preserved the Stitch visual direction using the same dark palette, typography emphasis, rounded cards, and layered/glass surfaces
- Kept unified user app architecture, matching repo rules
- Used typed service layer with Zod-backed response parsing
- Used React Query for backend state and refresh behavior
- Used Zustand persist store for JWT session handling
- Preserved backend ownership of financial mutations and room lifecycle
- Kept room `LIVE` transition out of frontend and routed publish through existing room publish endpoint only

## 6. Gaps Between Design UI and Current Backend

- Room listing/detail endpoints do not include host public profile, so UI currently falls back to host ID-based labels
- `viewerCount` is serialized as `0` by backend today unless another service injects it
- No backend endpoint for sending chat messages
- No backend endpoint for listing gift catalog
- No backend endpoint for sending gifts
- No realtime server implementation wired into this repo for Socket.IO chat/gifts/presence
- No upload endpoint for creator thumbnail assets
- No payment/top-up endpoints exposed for viewer wallet purchase flow
- No public config endpoint for showing withdrawal conversion/fee info ahead of submit
- Host application backend accepts fewer fields than the design form shows

## 7. Explicit TODO

- TODO: enrich `GET /rooms/live` and `GET /rooms/:id` with host preview data
- TODO: expose realtime viewer presence and real viewer counts
- TODO: implement chat send endpoint or Socket.IO server
- TODO: implement gift catalog list endpoint
- TODO: implement gift send transaction endpoint and realtime gift event stream
- TODO: add payment package and payment-order endpoints for top-up flow
- TODO: add upload/media endpoint for room thumbnails
- TODO: expose withdrawal config / conversion info for finance UI
- TODO: expand host application API if richer creator profile fields are required

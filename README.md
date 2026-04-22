# Social Livestream Platform

Implementasi awal project mengikuti `prd.md` sebagai source of truth utama.

Fase yang dibootstrap pada commit ini:

* Milestone 0: foundation, shared packages, Prisma schema, env config
* Milestone 1: core platform API untuk auth, host applications, rooms, discovery, dan admin force-end
* Minimal Milestone 2 hook: media publish/unpublish lifecycle agar room `LIVE` hanya berasal dari media hook

## Workspace

```text
/services
  /api
  /media-hooks
  /worker
/packages
  /config
  /contracts-rest
  /contracts-socket
  /db
  /domain-core
  /shared-types
  /tsconfig
/docs
  /api
  /system-design
/infrastructure
  /compose
```

## Next Setup

1. Copy `.env.example` to `.env`
2. Start infra stack with `docker compose -f infrastructure/compose/local.yml up -d`
3. Start the backend processes from the workspace: `npm run dev:api` and `npm run dev:media-hooks`
4. PostgreSQL will be available on `localhost:5433`
5. Redis will be available on `localhost:6379`
6. SRS playback/HTTP endpoint will be available on `http://localhost:8080`

## Docker Compose Scope

`infrastructure/compose/local.yml` currently boots the local infra needed by the workspace:

* `postgres`
* `redis`
* `srs`

The application processes still run from this repo during local development:

* `api`
* `media-hooks`
* `worker`

`realtime`, `web-app`, dan `web-admin` belum dimasukkan ke compose saat ini. Arsitektur frontend user-facing di repo ini memakai satu aplikasi user terpadu `apps/web-app` dan satu aplikasi admin terpisah `apps/web-admin`; tidak ada `web-viewer` atau `web-host-panel`.

## Important Constraints

* backend is the source of truth
* financial and lifecycle state transitions stay server-side
* wallet mutation must always be paired with ledger entries
* room `LIVE` transition is reserved for media hooks

## 🔥 Architecture Rules (Critical)

This project follows a **Unified User Model**:

- There is NO separation between viewer and host as different user types.
- All users are a single entity: `User`.
- Host is a capability unlocked via `HostApplication` approval.

### Capabilities

Any logged-in user can:
- watch livestream
- chat, like, send gift
- follow other users

Any approved user can additionally:
- create rooms
- go live
- receive gifts

### Frontend Architecture

There are ONLY two frontend apps:

- `apps/web-app` → unified user app (viewer + host)
- `apps/web-admin` → admin-only app (strictly separate)

### Forbidden

Do NOT introduce:
- `web-viewer`
- `web-host`
- `web-host-panel`
- admin routes inside `web-app`

If any code or design conflicts with this section, this section takes priority.

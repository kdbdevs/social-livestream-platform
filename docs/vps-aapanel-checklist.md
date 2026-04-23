# Checklist Praktis Deploy Ubuntu VPS Sampai Live

Checklist ini adalah versi singkat dan operasional dari [vps-aapanel-setup.md](/d:/Project/livestream-intregated/docs/vps-aapanel-setup.md).

Pakai checklist ini jika target Anda adalah:

- OS: Ubuntu VPS
- Panel: aaPanel
- Reverse proxy dan SSL: Nginx di aaPanel
- Infra Docker: PostgreSQL, Redis, SRS
- App Node.js di host: API, media-hooks, worker via PM2

Data target:

- VPS IP: `134.199.174.22`
- Repo: `https://github.com/kdbdevs/social-livestream-platform.git`
- Frontend: `app.aweekday.site`
- API: `api.aweekday.site`
- Hooks: `hooks.aweekday.site`
- Stream: `stream.aweekday.site`

## A. Sebelum Masuk Server

Pastikan DNS sudah dibuat:

- `app.aweekday.site` -> `134.199.174.22`
- `api.aweekday.site` -> `134.199.174.22`
- `hooks.aweekday.site` -> `134.199.174.22`
- `stream.aweekday.site` -> `134.199.174.22`

## B. Terminal VPS: Install Dasar

Login ke VPS:

```bash
ssh root@134.199.174.22
```

Update package:

```bash
apt update && apt upgrade -y
apt install -y curl wget git unzip rsync build-essential ca-certificates gnupg lsb-release
```

Install Docker:

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
docker --version
```

Install Node.js 24:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs
node -v
npm -v
```

Install PM2:

```bash
npm install -g pm2
pm2 -v
```

## C. Terminal VPS: Install aaPanel

Jika aaPanel belum terpasang:

```bash
URL=https://www.aapanel.com/script/install_6.0_en.sh
curl -ksSO "$URL"
bash install_6.0_en.sh
```

Setelah selesai:

- buka URL panel aaPanel
- login

## D. aaPanel: Install Komponen Yang Dipakai

Di aaPanel lakukan ini:

1. `App Store` -> install `Nginx`
2. `App Store` -> install `Docker Manager` jika ingin monitor container dari panel
3. Pastikan service `Nginx` status `Running`

## E. Terminal VPS: Clone Project

```bash
mkdir -p /www/wwwroot
cd /www/wwwroot
git clone https://github.com/kdbdevs/social-livestream-platform.git
cd social-livestream-platform
npm install --include=dev
```

## F. Terminal VPS: Siapkan Environment Production

Copy template:

```bash
cp .env.vps.example .env
```

Edit `.env`:

```bash
nano .env
```

Isi minimal seperti ini:

```env
NODE_ENV=production
DATABASE_URL=postgresql://postgres:GANTI_PASSWORD_POSTGRES@127.0.0.1:5433/livestream
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=ISI_RANDOM_STRING_MIN_32
JWT_EXPIRES_IN=7d
API_HOST=127.0.0.1
API_PORT=4000
API_CORS_ORIGIN=https://app.aweekday.site
VITE_API_BASE_URL=https://api.aweekday.site/api/v1
MEDIA_HOOKS_PORT=4002
WORKER_PORT=4003
MEDIA_HOOK_SECRET=ISI_RANDOM_STRING_MIN_16
RTMP_INGEST_URL=rtmp://stream.aweekday.site/live
PLAYBACK_BASE_URL=https://stream.aweekday.site/live
ROOM_DISCONNECT_GRACE_SECONDS=30
POSTGRES_PASSWORD=GANTI_PASSWORD_POSTGRES
```

Simpan file.

## G. Terminal VPS: Siapkan Config SRS Production

Jika memakai `deploy.sh`, langkah ini akan dirender otomatis dari `.env` dan bisa dilewati.

Edit file config SRS:

```bash
nano infrastructure/compose/srs.vps.conf
```

Ganti:

```text
CHANGE_ME_MEDIA_HOOK_SECRET
```

dengan nilai yang sama persis seperti `MEDIA_HOOK_SECRET` di `.env`.

Contoh cepat:

```bash
grep MEDIA_HOOK_SECRET .env
```

## H. Terminal VPS: Naikkan Infra Docker

Jalankan:

```bash
docker compose -f infrastructure/compose/vps.yml up -d
docker compose -f infrastructure/compose/vps.yml ps
```

Kalau mau cek log SRS:

```bash
docker compose -f infrastructure/compose/vps.yml logs -f srs
```

Alternatif lebih praktis:

```bash
bash deploy.sh
```

Catatan:

- `deploy.sh` akan memastikan extension PostgreSQL `citext` aktif otomatis sebelum `db push`.

## I. Terminal VPS: Build App

```bash
npm run db:generate
npm run build
```

## J. Terminal VPS: Inisialisasi Database

Push schema:

```bash
npx prisma db push --schema packages/db/prisma/schema.prisma
```

Seed data awal:

```bash
npm run db:seed
```

## K. Terminal VPS: Jalankan Service Dengan PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Catatan:

- PM2 di repo ini dijalankan memakai `ecosystem.config.cjs`, jadi tidak perlu menebak path file `dist` secara manual.

Lihat status:

```bash
pm2 status
```

Lihat log jika perlu:

```bash
pm2 logs livestream-api
pm2 logs livestream-hooks
pm2 logs livestream-worker
```

## L. Terminal VPS: Publish Frontend Static

Copy hasil build frontend ke folder website:

```bash
mkdir -p /www/wwwroot/app.aweekday.site
rsync -av --delete apps/web-app/dist/ /www/wwwroot/app.aweekday.site/
```

## M. aaPanel: Buat 4 Website

### 1. `app.aweekday.site`

Di aaPanel:

1. `Website` -> `Add site`
2. Domain: `app.aweekday.site`
3. Root: `/www/wwwroot/app.aweekday.site`
4. Type: `Pure static`
5. Save

Lalu:

1. Buka site `app.aweekday.site`
2. `Config`
3. Pastikan route SPA memakai:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

4. `SSL` -> issue Let’s Encrypt
5. Aktifkan force HTTPS

### 2. `api.aweekday.site`

Di aaPanel:

1. `Website` -> `Add site`
2. Domain: `api.aweekday.site`
3. Root bebas/default
4. Save

Lalu reverse proxy:

1. Buka site `api.aweekday.site`
2. `Proxy Project` atau `Reverse Proxy`
3. Add rule:
   - path: `/`
   - target: `http://127.0.0.1:4000`
4. `SSL` -> issue Let’s Encrypt
5. Aktifkan force HTTPS

### 3. `hooks.aweekday.site`

Di aaPanel:

1. `Website` -> `Add site`
2. Domain: `hooks.aweekday.site`
3. Save

Lalu reverse proxy:

1. Add rule `/`
2. Target: `http://127.0.0.1:4002`
3. Issue SSL
4. Force HTTPS

### 4. `stream.aweekday.site`

Di aaPanel:

1. `Website` -> `Add site`
2. Domain: `stream.aweekday.site`
3. Save

Lalu reverse proxy:

1. Add rule `/`
2. Target: `http://127.0.0.1:8080`
3. Issue SSL
4. Force HTTPS

Catatan:

- RTMP ingest tetap lewat port `1935`, bukan lewat reverse proxy.
- Encoder akan push ke:

```text
rtmp://stream.aweekday.site/live
```

## N. Terminal VPS: Verifikasi Berurutan

### 1. Cek API lokal

```bash
curl http://127.0.0.1:4000/api/v1/rooms/live?limit=1
```

### 2. Cek API publik

```bash
curl -I https://api.aweekday.site/api/v1/rooms/live?limit=1
```

### 3. Cek frontend publik

```bash
curl -I https://app.aweekday.site
```

### 4. Cek playback host

```bash
curl -I https://stream.aweekday.site
```

### 5. Cek PM2

```bash
pm2 status
```

### 6. Cek container

```bash
docker compose -f infrastructure/compose/vps.yml ps
```

## O. Data Login Seed

Kalau seed berhasil, akun awal:

- `admin@example.com` / `password123`
- `host@example.com` / `password123`
- `viewer@example.com` / `password123`

## P. Setelah Live: Cara Update

Saat ada update dari GitHub:

```bash
cd /www/wwwroot/social-livestream-platform
git pull
bash deploy.sh --skip-seed
pm2 status
```

## Q. Checklist Singkat Super Ringkas

Jika mau versi super singkat, urutannya hanya ini:

```bash
ssh root@134.199.174.22
apt update && apt upgrade -y
apt install -y curl wget git unzip rsync build-essential ca-certificates gnupg lsb-release
curl -fsSL https://get.docker.com | sh
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs
npm install -g pm2
mkdir -p /www/wwwroot
cd /www/wwwroot
git clone https://github.com/kdbdevs/social-livestream-platform.git
cd social-livestream-platform
npm install --include=dev
cp .env.vps.example .env
nano .env
nano infrastructure/compose/srs.vps.conf
docker compose -f infrastructure/compose/vps.yml up -d
npm run db:generate
npm run build
npx prisma db push --schema packages/db/prisma/schema.prisma
npm run db:seed
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
mkdir -p /www/wwwroot/app.aweekday.site
rsync -av --delete apps/web-app/dist/ /www/wwwroot/app.aweekday.site/
```

Lalu lanjutkan website, reverse proxy, dan SSL dari aaPanel.

# Deploy Ke Satu VPS Dengan aaPanel + Docker Infra

Panduan ini untuk topologi berikut:

- VPS: `134.199.174.22`
- Frontend: `app.aweekday.site`
- API: `api.aweekday.site`
- Media hooks: `hooks.aweekday.site`
- Stream playback + ingest domain: `stream.aweekday.site`
- Source code: `https://github.com/kdbdevs/social-livestream-platform.git`

Arsitektur yang dipakai:

- `aaPanel` untuk website management, reverse proxy Nginx, SSL, file manager, dan terminal.
- `Docker` hanya untuk `PostgreSQL`, `Redis`, dan `SRS`.
- Process Node.js (`api`, `media-hooks`, `worker`) dijalankan di host VPS dengan `PM2`.
- Frontend `web-app` dibuild menjadi static files lalu disajikan oleh Nginx melalui aaPanel.

Kenapa arsitektur ini dipilih:

- Cocok dengan struktur repo saat ini yang memisahkan `api`, `media-hooks`, dan `worker`.
- Nginx di aaPanel menangani domain, SSL, dan reverse proxy dengan jelas.
- Docker dipakai hanya untuk infra stateful/streaming.
- `PM2` lebih cocok untuk multi-process Node daripada memaksa semua service masuk ke satu mekanisme web project.

## 1. Siapkan DNS

Tujuan:

- memastikan semua subdomain sudah mengarah ke VPS sebelum konfigurasi SSL dan reverse proxy.

Yang dilakukan:

1. Di provider DNS, buat 4 record `A`:
   - `app.aweekday.site` -> `134.199.174.22`
   - `api.aweekday.site` -> `134.199.174.22`
   - `hooks.aweekday.site` -> `134.199.174.22`
   - `stream.aweekday.site` -> `134.199.174.22`
2. Tunggu propagasi DNS selesai.

Verifikasi terminal:

```bash
nslookup app.aweekday.site
nslookup api.aweekday.site
nslookup hooks.aweekday.site
nslookup stream.aweekday.site
```

Hasil yang diharapkan:

- semua domain resolve ke `134.199.174.22`.

## 2. Siapkan VPS Dasar

Tujuan:

- menyiapkan server agar bisa menjalankan aaPanel, Docker, Git, Node.js, dan PM2.

Yang dilakukan via terminal VPS:

```bash
apt update && apt upgrade -y
apt install -y curl wget git unzip build-essential
```

Install Docker jika belum ada:

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

Install Node.js 24:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs
node -v
npm -v
```

Install PM2 global:

```bash
npm install -g pm2
pm2 -v
```

Hasil yang diharapkan:

- `docker`, `node`, `npm`, dan `pm2` tersedia dari terminal.

## 3. Install Dan Siapkan aaPanel

Tujuan:

- menggunakan aaPanel sebagai panel untuk Nginx, SSL, terminal, file manager, dan reverse proxy.

Jika aaPanel belum terpasang, install dari server:

```bash
URL=https://www.aapanel.com/script/install_6.0_en.sh
curl -ksSO "$URL"
bash install_6.0_en.sh
```

Referensi:

- aaPanel install reference: https://aapanel.org/reference.html
- aaPanel docs home: https://www.aapanel.com/docs/

Langkah di aaPanel:

1. Login ke aaPanel.
2. Di `App Store`, install:
   - `Nginx`
   - `Docker Manager` bila ingin memantau container dari panel
   - `Node.js Manager` opsional, hanya untuk version manager
3. Pastikan service `Nginx` status-nya running.

Catatan:

- runtime Node tetap dianjurkan dikelola lewat `PM2` di terminal karena repo ini memiliki 3 process terpisah dan salah satunya adalah worker non-HTTP.

## 4. Buka Firewall Yang Dibutuhkan

Tujuan:

- memastikan trafik penting bisa masuk, dan port sensitif tidak dibuka ke publik tanpa perlu.

Port yang perlu dibuka ke publik:

- `22` untuk SSH
- `80` untuk HTTP
- `443` untuk HTTPS
- `1935` untuk RTMP ingest
- port aaPanel Anda sendiri, jika panel diakses publik

Port yang tidak perlu dibuka ke publik:

- `5433` PostgreSQL
- `6379` Redis
- `4000` API
- `4002` media hooks
- `4003` worker
- `8080` SRS HTTP playback origin
- `1985` SRS HTTP API

Catatan:

- file compose VPS di repo memang membind banyak service ke `127.0.0.1` agar tidak langsung terekspos.

## 5. Clone Source Code

Tujuan:

- mengambil source app ke VPS.

Contoh lokasi deploy:

```bash
mkdir -p /www/wwwroot
cd /www/wwwroot
git clone https://github.com/kdbdevs/social-livestream-platform.git
cd social-livestream-platform
```

Install dependency:

```bash
npm install --include=dev
```

Catatan:

- walaupun `NODE_ENV=production`, tahap build tetap butuh dev dependency seperti `vite`, `typescript`, dan `@types/node`.
- karena itu gunakan `npm install --include=dev`, bukan `npm install` biasa.

## 6. Siapkan File Environment Production

Tujuan:

- memberi semua service nilai env yang sesuai domain VPS production.

Di terminal:

```bash
cd /www/wwwroot/social-livestream-platform
cp .env.vps.example .env
```

Edit `.env` lalu isi nilai finalnya. Minimal hasilnya seperti ini:

```env
NODE_ENV=production
DATABASE_URL=postgresql://postgres:GANTI_PASSWORD_POSTGRES@127.0.0.1:5433/livestream
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=ISI_DENGAN_RANDOM_STRING_MIN_32
JWT_EXPIRES_IN=7d
API_HOST=127.0.0.1
API_PORT=4000
API_CORS_ORIGIN=https://app.aweekday.site
VITE_API_BASE_URL=https://api.aweekday.site/api/v1
MEDIA_HOOKS_PORT=4002
WORKER_PORT=4003
MEDIA_HOOK_SECRET=ISI_DENGAN_RANDOM_STRING_MIN_16
RTMP_INGEST_URL=rtmp://stream.aweekday.site/live
PLAYBACK_BASE_URL=https://stream.aweekday.site/live
ROOM_DISCONNECT_GRACE_SECONDS=30
POSTGRES_PASSWORD=GANTI_PASSWORD_POSTGRES
```

Catatan penting:

- `API_HOST=127.0.0.1` membuat API dan hooks hanya terbuka lokal, lalu diexpose ke publik melalui Nginx.
- `POSTGRES_PASSWORD` dipakai oleh Docker Compose VPS.
- password di `DATABASE_URL` dan `POSTGRES_PASSWORD` harus sama.

## 7. Siapkan Docker Infra Production

Tujuan:

- menjalankan PostgreSQL, Redis, dan SRS dengan konfigurasi VPS.

File yang dipakai:

- `infrastructure/compose/vps.yml`
- `infrastructure/compose/srs.vps.conf`
- `deploy.sh`

Jika ingin cara manual, edit `infrastructure/compose/srs.vps.conf` lalu ganti:

- `CHANGE_ME_MEDIA_HOOK_SECRET`

dengan nilai yang sama persis seperti `MEDIA_HOOK_SECRET` di `.env`.

Tujuannya:

- agar callback `on_publish` dan `on_unpublish` dari SRS diizinkan oleh service `media-hooks` saat `NODE_ENV=production`.

Referensi SRS:

- HTTP callback docs: https://ossrs.io/lts/en-us/docs/v5/doc/http-callback

Setelah file siap, jalankan:

```bash
docker compose -f infrastructure/compose/vps.yml up -d
docker compose -f infrastructure/compose/vps.yml ps
```

Atau jika ingin alur otomatis, cukup jalankan dari root repo:

```bash
bash deploy.sh
```

Hasil yang diharapkan:

- `postgres`, `redis`, dan `srs` semua `Up`.
- extension PostgreSQL seperti `citext` tersedia untuk schema Prisma.

## 8. Build Aplikasi

Tujuan:

- menghasilkan output production untuk service backend dan frontend.

Jalankan:

```bash
npm run db:generate
npm run build
```

Hasil yang diharapkan:

- Prisma client dan type backend tergenerate sesuai schema aktif.
- file `dist` terbentuk untuk package backend.
- `apps/web-app/dist` terbentuk untuk frontend.

## 9. Inisialisasi Database Production

Tujuan:

- membuat schema dan data awal di PostgreSQL VPS.

Jalankan:

```bash
npx prisma db push --schema packages/db/prisma/schema.prisma
npm run db:seed
```

Catatan:

- `db push` dipakai karena repo saat ini belum menyiapkan migrasi versioned.
- `db:seed` mengisi akun awal, gift catalog, payment packages, dan system config.

## 10. Jalankan Backend Dengan PM2

Tujuan:

- membuat `api`, `media-hooks`, dan `worker` selalu hidup setelah logout/reboot.

Repo ini sudah disiapkan dengan:

- `ecosystem.config.cjs`
- script `start` di masing-masing service

Catatan:

- service backend production dijalankan lewat `tsx src/main.ts` melalui PM2.
- build `tsc` tetap berguna untuk validasi, tetapi PM2 tidak bergantung pada file `dist/main.js`.

Jalankan:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Lalu cek:

```bash
pm2 status
pm2 logs livestream-api
pm2 logs livestream-hooks
pm2 logs livestream-worker
```

Hasil yang diharapkan:

- `livestream-api` running di `127.0.0.1:4000`
- `livestream-hooks` running di `127.0.0.1:4002`
- `livestream-worker` running tanpa port publik

## 11. Publish Frontend Static Ke Document Root

Tujuan:

- membuat `app.aweekday.site` dilayani langsung oleh Nginx sebagai static SPA.

Buat direktori target:

```bash
mkdir -p /www/wwwroot/app.aweekday.site
rsync -av --delete apps/web-app/dist/ /www/wwwroot/app.aweekday.site/
```

Catatan:

- setiap kali frontend dibuild ulang, isi folder ini perlu disinkronkan lagi.

## 12. Buat Website Di aaPanel

Tujuan:

- menyiapkan domain, root, reverse proxy, dan SSL secara terpisah per subdomain.

### 12.1 `app.aweekday.site`

Tujuan:

- melayani frontend React static.

Langkah di aaPanel:

1. `Website` -> `Add site`
2. Domain: `app.aweekday.site`
3. Root directory: `/www/wwwroot/app.aweekday.site`
4. PHP version: `Pure static`
5. Simpan

Setelah website dibuat:

1. Masuk ke website `app.aweekday.site`
2. Buka `Config`
3. Di block `location /`, pastikan SPA fallback aktif. Bentuk aman yang dibutuhkan:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

4. Buka menu `SSL`
5. Issue Let’s Encrypt certificate
6. Aktifkan force HTTPS

### 12.2 `api.aweekday.site`

Tujuan:

- meneruskan request publik ke API lokal `127.0.0.1:4000`.

Langkah di aaPanel:

1. `Website` -> `Add site`
2. Domain: `api.aweekday.site`
3. Root directory boleh default statis
4. Simpan
5. Masuk ke website `api.aweekday.site`
6. Buka `Proxy Project` atau `Reverse Proxy`
7. Tambahkan reverse proxy:
   - Source path: `/`
   - Target URL: `http://127.0.0.1:4000`
8. Issue SSL Let’s Encrypt
9. Aktifkan force HTTPS

Referensi:

- aaPanel Proxy Project docs: https://www.aapanel.com/docs/Function/proxy.html

### 12.3 `hooks.aweekday.site`

Tujuan:

- memberi endpoint publik/terkontrol untuk callback media hooks, walau SRS di arsitektur ini tetap memanggil host lokal langsung.

Langkah di aaPanel:

1. `Website` -> `Add site`
2. Domain: `hooks.aweekday.site`
3. Simpan
4. Tambahkan reverse proxy:
   - Source path: `/`
   - Target URL: `http://127.0.0.1:4002`
5. Issue SSL Let’s Encrypt
6. Aktifkan force HTTPS

Catatan:

- pada setup repo ini, file `srs.vps.conf` memanggil `media-hooks` lewat `host.docker.internal:4002`, bukan lewat domain publik, agar callback tidak bergantung pada DNS/SSL eksternal dari container.

### 12.4 `stream.aweekday.site`

Tujuan:

- menyajikan playback HLS dari SRS ke publik.

Langkah di aaPanel:

1. `Website` -> `Add site`
2. Domain: `stream.aweekday.site`
3. Simpan
4. Tambahkan reverse proxy:
   - Source path: `/`
   - Target URL: `http://127.0.0.1:8080`
5. Issue SSL Let’s Encrypt
6. Aktifkan force HTTPS

Catatan penting:

- ingest RTMP **tidak** lewat Nginx. Encoder tetap push ke:

```text
rtmp://stream.aweekday.site/live
```

- playback HLS dibaca dari:

```text
https://stream.aweekday.site/live/<streamKey>.m3u8
```

## 13. Verifikasi Berurutan

Tujuan:

- memastikan setiap lapisan sudah benar sebelum testing end-to-end.

### 13.1 Cek infra

```bash
docker compose -f infrastructure/compose/vps.yml ps
docker logs $(docker ps --filter name=srs --format "{{.ID}}")
```

### 13.2 Cek backend lokal

```bash
curl http://127.0.0.1:4000/api/v1/rooms/live?limit=1
curl -X POST "http://127.0.0.1:4002/hooks/srs/on-publish?secret=ISI_SECRET" -H "Content-Type: application/json" -d "{\"streamKey\":\"00000000-0000-0000-0000-000000000000\"}"
```

Catatan:

- request hook di atas kemungkinan akan mengembalikan error business bila `streamKey` tidak ada, tetapi itu sudah cukup untuk membuktikan secret dan routing hooks berfungsi.

### 13.3 Cek domain publik

```bash
curl -I https://app.aweekday.site
curl -I https://api.aweekday.site/api/v1/rooms/live?limit=1
curl -I https://stream.aweekday.site/live/
```

### 13.4 Cek login frontend

1. Buka `https://app.aweekday.site`
2. Login dengan akun seed:
   - `host@example.com` / `password123`
   - `viewer@example.com` / `password123`
3. Pastikan frontend bisa mengambil data dari `https://api.aweekday.site/api/v1`

## 14. Urutan Update Deploy Berikutnya

Tujuan:

- memastikan update berikutnya dilakukan tanpa melompati dependency.

Urutan update:

1. Masuk ke repo
2. `git pull`
3. Jalankan `bash deploy.sh --skip-seed`
4. Verifikasi `pm2 status` dan akses domain

## 15. Catatan Risiko Yang Perlu Diketahui

1. Repo production saat ini memakai `prisma db push`, bukan migrasi versioned. Untuk tim dan production yang lebih matang, sebaiknya nanti ditingkatkan ke Prisma migrations.
2. `hooks.aweekday.site` saat ini tidak wajib dipakai oleh SRS karena callback diarahkan langsung ke host lokal. Domain itu tetap berguna untuk observability atau bila nanti ingin mengganti ke callback berbasis public HTTPS.
3. `stream.aweekday.site` melayani HLS playback via HTTPS, tetapi ingest tetap RTMP biasa di port `1935`.
4. `apps/web-admin` belum siap production dari repo saat ini, jadi langkah ini hanya men-deploy `apps/web-app`, `api`, `media-hooks`, dan `worker`.

## Referensi

- aaPanel docs home: https://www.aapanel.com/docs/
- aaPanel Node Project docs: https://www.aapanel.com/docs/Function/Node.html
- aaPanel Proxy Project docs: https://www.aapanel.com/docs/Function/proxy.html
- aaPanel install reference: https://aapanel.org/reference.html
- SRS HTTP callback docs: https://ossrs.io/lts/en-us/docs/v5/doc/http-callback
- PM2 docs: https://doc.pm2.io/

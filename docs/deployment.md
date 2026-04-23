# Deployment Guide

## Goals

Use a same-origin `/api` path for the web app so browsers do not need cross-origin requests in production.

## Frontend Defaults

`apps/web-app` now defaults to `VITE_API_BASE_URL=/api/v1`.

Local development uses the Vite dev proxy in `apps/web-app/vite.config.ts`, which forwards `/api/*` to `DEV_API_PROXY_TARGET` or `http://localhost:4000`.

## Backend CORS

The API supports:

* exact origins via `API_CORS_ORIGIN`
* wildcard origin patterns via `API_CORS_ORIGIN_PATTERNS`

Examples:

```env
API_CORS_ORIGIN=https://app.aweekday.site,https://social-livestream-platform-web-app.vercel.app
API_CORS_ORIGIN_PATTERNS=https://*.vercel.app,https://*.aweekday.site
```

## Vercel Setup

Set the Vercel project root directory to `apps/web-app`.

Set these environment variables in the Vercel project:

```env
VITE_API_BASE_URL=/api/v1
API_PROXY_TARGET=https://api.aweekday.site
```

`apps/web-app/api/[...path].js` proxies same-origin `/api/*` requests from the browser to `API_PROXY_TARGET`.

`apps/web-app/vercel.json` keeps SPA routes working by falling back to `index.html` after filesystem routes are checked.

## VPS Setup

Serve the built frontend and reverse-proxy `/api` to the Fastify API on the same domain.

Example Nginx config:

```nginx
server {
  listen 80;
  server_name app.aweekday.site;

  root /var/www/social-livestream-platform/apps/web-app/dist;
  index index.html;

  location /api/ {
    proxy_pass http://127.0.0.1:4000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

With this setup, the browser calls `https://app.aweekday.site/api/v1/...`, Nginx forwards to Fastify, and CORS is no longer required for the web app itself.

## Notes

If the API is still accessed directly from a different origin, you must keep `API_CORS_ORIGIN` and/or `API_CORS_ORIGIN_PATTERNS` configured on the API server.

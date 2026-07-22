# FlowPilot API — Deployment Guide

## Environments

| Layer | Target | Notes |
|-------|--------|--------|
| API | OpsCtrl / any Node host | NestJS on port 4000 |
| Database | Managed PostgreSQL | Prisma migrations |
| Mail | SMTP provider | Mailpit locally |
| Files | Local disk or S3 later | `STORAGE_LOCAL_PATH` |

## Prerequisites

- Node.js 22+
- PostgreSQL 16+
- Environment variables from `.env.example`

## Production checklist

1. Set strong `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (32+ chars)
2. Set `COOKIE_SECURE=true` behind HTTPS
3. Set `FRONTEND_URL` to the Vercel domain
4. Set `DATABASE_URL` to managed Postgres
5. Configure real SMTP (`SMTP_*`)
6. Run migrations: `npx prisma migrate deploy`

## OpsCtrl

OpsCtrl auto-generates its own build image for NestJS + Prisma.
Do **not** commit a custom `Dockerfile` unless you intentionally override their builder.

Reserved platform vars (do not set manually): `APP_URL`, `PORT`, `DATABASE_URL`, `NODE_ENV`.
OpsCtrl injects its managed Postgres as `DATABASE_URL`.

Set app vars in the dashboard instead: `FRONTEND_URL`, JWT secrets, cookie flags, storage.

## VPS (manual)

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start:prod
```

Health: `GET /v1/health`  
Swagger: `/docs` (disable or protect in production if desired)

## GitHub Actions

CI runs on `main` / `develop`: install → prisma generate → lint → unit tests → build.

## Google OAuth

1. Create a Web OAuth client in Google Cloud Console.
2. Authorized redirect URI: `https://flowpilot.opsctrl.dev/v1/auth/google/callback`
3. Set on OpsCtrl:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_CALLBACK_URL=https://flowpilot.opsctrl.dev/v1/auth/google/callback`
4. Redeploy the API, then use **Continue with Google** on the Vercel login page.

## Security notes

- Refresh tokens are hashed at rest and rotated on use
- Auth endpoints are rate-limited
- Helmet + CORS + ValidationPipe are enabled globally
- Uploaded files are MIME-allowlisted and size-capped

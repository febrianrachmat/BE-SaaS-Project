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

## Docker

```bash
docker compose up -d postgres mailpit
docker build -t flowpilot-api .
docker run --env-file .env -p 4000:4000 flowpilot-api
```

## OpsCtrl / VPS

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

## Security notes

- Refresh tokens are hashed at rest and rotated on use
- Auth endpoints are rate-limited
- Helmet + CORS + ValidationPipe are enabled globally
- Uploaded files are MIME-allowlisted and size-capped

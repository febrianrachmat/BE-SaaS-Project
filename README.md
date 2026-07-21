# FlowPilot Backend

NestJS API for FlowPilot — production-ready Project Management SaaS.

## Stack

- NestJS + TypeScript (strict)
- Prisma ORM + PostgreSQL
- JWT + Refresh Token Rotation
- Swagger · Helmet · Throttler · ValidationPipe
- Docker Compose (Postgres + Mailpit)

## Architecture

Clean Architecture per module:

```
src/
  modules/           # Feature modules (auth, workspace, …)
    */controllers
    */dto
    */use-cases
    */repositories
  common/            # Filters, interceptors, guards, RBAC
  infrastructure/    # Prisma, mail, storage
```

## Getting started

```bash
cp .env.example .env
docker compose up -d          # Postgres + Mailpit (requires Docker)
npm install
npx prisma migrate dev --name init
npm run start:dev
```

- API: http://localhost:4000/v1
- Swagger: http://localhost:4000/docs
- Mailpit UI: http://localhost:8025

> **Note:** Docker is optional for reading the codebase. Migrations need a running Postgres.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Watch mode |
| `npm run build` | Compile |
| `npx prisma studio` | DB GUI |
| `npm run test` | Unit tests |
| `npm run test:e2e` | E2E tests |

## Deploy

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Docker, OpsCtrl, and production checklist.

## Related

Frontend: [FE-SaaS-Project](https://github.com/febrianrachmat/FE-SaaS-Project)

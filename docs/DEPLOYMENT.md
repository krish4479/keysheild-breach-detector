# KeyShield — Deployment Guide

## Prerequisites

- PostgreSQL 17 (TLS enabled in production)
- Redis 7 / Valkey
- A place to run the container (the image is Next.js standalone, non-root)
- A secret manager (KMS / Vault / cloud secrets) for production secrets

## Build & run

```bash
docker compose up --build          # local: app + postgres + redis + migrate/seed
```

For a standalone image:

```bash
docker build -t keyshield:latest .
docker run --rm -p 3000:3000 --env-file .env.production keyshield:latest
# apply migrations + seed with the builder image (has drizzle-kit + tsx):
docker build -t keyshield:tools --target builder .
docker run --rm --env-file .env.production keyshield:tools sh -c "npm run db:migrate && npm run db:seed"
```

## Required environment variables

See `.env.example` for the full annotated list. In production you **must** set:

| Variable | Notes |
| --- | --- |
| `SESSION_SECRET` | ≥ 32 bytes, unique per environment (`openssl rand -base64 48`) |
| `DATABASE_URL` | Point at a **least-privilege** app user; append `?sslmode=require` for TLS |
| `REDIS_URL` | Use `rediss://` for TLS |
| `APP_ORIGIN`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` | Your real public origin/host |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_TOTP_SECRET` | Real admin bootstrap — rotate after first login |

Optional: `BREACH_MODE=offline` + `BREACH_CORPUS_PATH` for enterprise offline breach checking; `SENTRY_DSN` / `OTEL_EXPORTER_OTLP_ENDPOINT` to activate the telemetry seams.

## Hardening checklist for production

- [ ] **Pin the base image by digest** in the `Dockerfile` (`node:22-bookworm-slim@sha256:…`); let Renovate/Dependabot update it.
- [ ] Terminate TLS at the edge; keep HSTS (already emitted) and consider preload submission.
- [ ] Give the app DB user only `SELECT/INSERT/UPDATE/DELETE` on its tables — no DDL, no superuser. Run migrations with a separate privileged user.
- [ ] Enable TLS to PostgreSQL and Redis; enable encrypted, tested backups.
- [ ] Source `SESSION_SECRET` and admin secrets from a secret manager, not env files.
- [ ] Set `TRUSTED_PROXY_COUNT` to the number of reverse proxies actually in front of the app (nginx/ingress/CDN), so `X-Forwarded-For` can't be spoofed to defeat per-IP rate limits. Use `0` if directly exposed.
- [ ] Run behind a WAF / L3-L4 DDoS protection; the app handles L7 abuse via rate limits.
- [ ] Set `NODE_ENV=production` (the image already does) and confirm `/api/health` is green before shifting traffic.
- [ ] Scope the CSP if you add third-party origins; keep the nonce-based `script-src` strict.
- [ ] Rotate the seeded demo admin: change the password and TOTP secret, or delete and recreate the admin.

## Migrations

Schema is migration-only (Drizzle). To evolve it:

```bash
npm run db:generate      # after editing lib/db/schema.ts → creates drizzle/NNNN_*.sql
npm run db:migrate       # apply pending migrations
```

Never edit the database by hand; commit generated migrations.

## Health, scaling & observability

- **Health**: `GET /api/health` returns 200 when DB + Redis are up (breach-API degradation is non-fatal). Wire it to your orchestrator's liveness/readiness probe.
- **Scaling**: the app is stateless apart from Postgres/Redis — scale horizontally behind a load balancer. Sessions and rate-limit counters are shared via the DB/Redis, so any instance can serve any request.
- **Observability**: structured Pino logs (JSON in production, redacted); flip `SENTRY_DSN` / OTel env vars to activate the error/trace seams in `lib/telemetry`.

## CI/CD

`.github/workflows/ci.yml` gates merges on typecheck, lint, unit/security tests, build + SBOM, integration + Playwright e2e (against an ephemeral stack), and the security scanners (CodeQL, Semgrep, Trivy, Gitleaks, `npm audit`, OWASP ZAP baseline). Promote only green builds.

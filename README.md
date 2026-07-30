# KeyShield

A production-minded **password strength, breached-password detection, and authentication-policy platform** — built as a single Next.js (App Router) + TypeScript-strict full-stack app, hardened so the app itself resists the attacks it defends against.

Follows OWASP ASVS 5.0 / Top 10, OWASP Auth & REST cheat sheets, NIST SP 800-63B, and the Have I Been Pwned Pwned-Passwords k-anonymity range API.

---

## What's inside

- **Public checker** (`/checker`) — live, in-browser strength analysis; breach check only on blur/debounce.
- **Admin console** (`/admin/*`) — analytics dashboard, DB-stored password policy editor, and audit logs. Requires an authenticated admin with MFA, re-checked in every handler.
- **REST API** — strength, breach, combined validate, policy, admin metrics/audit, health, and security-headers introspection. Documented at `/docs/api` (OpenAPI 3.1, downloadable at `/api/openapi`).
- **Security explainer** (`/security`) and a dual-theme "Entropy & Vault" design system.

### The important invariants

- The plaintext password **never** leaves the browser except as the first **5 hex chars of its SHA-1** (the HIBP k-anonymity prefix), computed **server-side**, HTTPS-only, with `Add-Padding: true`.
- The plaintext, the full hash, and the suffix are **never** logged, stored, or cached. (Proven by `tests/security/redaction.test.ts`.)
- The **same** `zxcvbn-ts` module runs on client and server, so Weak/Fair/Good/Strong verdicts are identical.
- Admin passwords are stored with **Argon2id**; SHA-1 is used **only** for the breach lookup.

---

## Quick start (Docker)

```bash
docker compose up --build
```

This starts **app + postgres + redis**, applies migrations, and seeds a default policy, the common-password blocklist, a demo admin, and realistic sample analytics.

- App: <http://localhost:3000>
- Health: <http://localhost:3000/api/health> → `{"status":"healthy",...}`

### Demo admin login

| Field | Value |
| --- | --- |
| URL | <http://localhost:3000/admin/login> |
| Email | `admin@keyshield.local` |
| Password | `correct-horse-battery-staple-42` |
| MFA (TOTP) secret | `KS5DEMOADMINSEEDTOTPBASE32SECRET` |

Admin accounts require MFA. Either add the TOTP secret to an authenticator app (Google Authenticator, 1Password, …) as a Base32 key, or print the current code:

```bash
npm run totp
```

> ⚠️ These are **demo** credentials for local use. Change `SESSION_SECRET`, `ADMIN_PASSWORD`, and `ADMIN_TOTP_SECRET` for any real deployment (see `docs/DEPLOYMENT.md`).

---

## Local development (without Docker)

Requires Node 22+, and a reachable PostgreSQL 17 and Redis 7.

```bash
cp .env.example .env         # defaults already target localhost
npm install
npm run db:migrate           # apply Drizzle migrations
npm run db:seed              # policy + blocklist + demo admin + sample data
npm run dev                  # http://localhost:3000
```

---

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev / production build / serve |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint |
| `npm run test` | Vitest — unit + security (integration auto-skips with no server) |
| `npm run test:e2e` | Playwright e2e (needs a running app) |
| `npm run db:generate` / `db:migrate` / `db:seed` | Drizzle migration generate / apply / seed |
| `npm run totp` | Print the current demo-admin TOTP code |

### Running the full test suite locally

```bash
# with the app + db + redis running (e.g. docker compose up):
KEYSHIELD_BASE_URL=http://localhost:3000 npx vitest run tests/integration
npm run test:e2e     # screenshots land in tests/e2e/screenshots
```

---

## REST API

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/password/analyze` | Local-style strength analysis |
| POST | `/api/password/check-breach` | HIBP k-anonymity breach lookup |
| POST | `/api/password/validate` | Combined analyze + breach + policy verdict |
| GET/PUT | `/api/policy` | Read / update policy (PUT = admin only) |
| GET | `/api/admin/metrics` | Dashboard analytics (admin) |
| GET | `/api/admin/audit-logs` | Audit feed (admin) |
| GET | `/api/health` | DB + Redis + breach reachability |
| GET | `/api/security/headers-check` | Reports the enforced security headers |
| POST | `/api/auth/login` · `/api/auth/mfa` · `/api/auth/logout` | Session auth + TOTP MFA |
| DELETE | `/api/auth/sessions` | Log out all sessions |
| POST | `/api/auth/webauthn/**` | Passkey register / authenticate |

Example `POST /api/password/validate`:

```json
{
  "valid": false,
  "score": 2,
  "riskLevel": "high",
  "strengthLabel": "Weak",
  "breached": true,
  "breachCount": 12345,
  "reasons": ["Password appears in known breaches"],
  "suggestions": ["Choose a unique passphrase that you do not use anywhere else"]
}
```

---

## Security & privacy

Highlights: strict CSP with a per-request nonce, HSTS, `frame-ancestors 'none'`, Argon2id storage, WebAuthn passkeys + TOTP MFA, DB-backed sessions with rotation and idle/absolute timeouts, per-IP/account/session/route rate limits, CSRF (origin + double-submit token), Zod validation everywhere, and parameterized Drizzle queries.

Full detail lives in:

- [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md)
- [`docs/SECURITY_CHECKLIST.md`](docs/SECURITY_CHECKLIST.md)
- [`docs/PRIVACY_MODEL.md`](docs/PRIVACY_MODEL.md)
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

CI (`.github/workflows/ci.yml`) runs typecheck, lint, tests, build, an SBOM, and **CodeQL, Semgrep, Trivy, Gitleaks, `npm audit`, and an OWASP ZAP baseline**, failing on critical findings.

---

## Notable, deliberate deviations from the original brief

- **`proxy.ts`, not `middleware.ts`** — Next.js 16 renamed Middleware to Proxy (identical behavior). Same CSP-nonce + security-header logic.
- **TOTP is the guaranteed admin MFA**; WebAuthn passkeys are a registerable second factor. Passkeys are device-bound and can't be seeded, so a fixed TOTP secret makes the demo admin logins reproducible and testable while still satisfying "MFA required for admin."
- **`style-src` allows `'unsafe-inline'`** (scripts do not) — inline `style=""` attributes can't carry a nonce; the brief prohibits unsafe-inline *scripts*. See `docs/SECURITY_CHECKLIST.md`.
- **Offline breach corpus** is a small deterministic file generated from the blocklist (`npx tsx lib/breach/build-corpus.ts`); swap in the real downloaded HIBP corpus for production enterprise mode.
- Some enterprise seams (OpenTelemetry, Sentry, a BullMQ corpus-sync job) are **env-flagged stubs**, not full integrations — add the SDK the day you flip the flag.

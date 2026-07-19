# KeyShield — Security Checklist

Mapped to OWASP ASVS 5.0 / Top 10 and NIST SP 800-63B. ✅ implemented · 🔶 seam/partial (documented).

## Authentication & session (ASVS V2/V3, Top 10 A07)

- ✅ Argon2id password storage, per-hash salt, OWASP params — `lib/auth/argon2.ts`
- ✅ SHA-1 used **only** for HIBP lookup, never for storage — `lib/breach/index.ts`
- ✅ MFA required for admin: TOTP (`lib/auth/totp.ts`) + WebAuthn passkeys (`lib/auth/webauthn.ts`)
- ✅ Sessions in httpOnly + Secure + SameSite cookies; only an encrypted session id is stored client-side — `lib/auth/session.ts`
- ✅ No tokens in localStorage
- ✅ Session rotation on login and privilege change; idle + absolute timeouts; revoke one / revoke all
- ✅ Generic login errors (no account enumeration); temporary lockout after repeated failures
- ✅ NIST policy: min 15 chars (8 with MFA), allow ≥64 & spaces & Unicode, no forced composition, no periodic rotation, block breached & common

## Authorization (ASVS V4, Top 10 A01)

- ✅ Deny-by-default RBAC re-checked in **every** protected handler — `requireAuth` / `requireAdmin` in `lib/auth/rbac.ts`
- ✅ Never relies on the proxy alone for protection
- ✅ Object ownership checked on session/credential access (IDOR)

## Input / output (ASVS V5, Top 10 A03)

- ✅ Every body/query/param validated with Zod; unknown fields rejected (`z.strictObject`) — `lib/validation`
- ✅ Request body size limits — `readJsonBody` in `lib/http.ts`
- ✅ Parameterized queries only (Drizzle) — no string-built SQL
- ✅ Output encoded by React; no `dangerouslySetInnerHTML`

## Headers & transport (ASVS V14, Top 10 A05)

- ✅ CSP with a **per-request nonce** + `'strict-dynamic'`, no unsafe-inline **scripts** — `proxy.ts` / `lib/security/headers.ts`
- 🔶 `style-src 'unsafe-inline'` — inline `style=""` attributes can't carry a nonce; the brief bans unsafe-inline *scripts* only. Removable by moving all inline styles to classes if a stricter posture is required.
- ✅ HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (sensors denied, WebAuthn allowed), COOP/CORP
- ✅ `frame-ancestors 'none'` + `X-Frame-Options: DENY`
- ✅ `x-powered-by` disabled; `Cache-Control: no-store` on admin surfaces
- ✅ Introspectable at `/api/security/headers-check`

## CSRF / CORS (Top 10 A01/A05)

- ✅ Origin/Referer allowlist + double-submit token on all cookie-authed mutations — `lib/security/csrf.ts`
- ✅ Same-origin only for admin/auth APIs; no wildcard CORS with credentials

## Abuse protection (Top 10 A04)

- ✅ Rate limits per IP / account / session / route (Redis) — `lib/security/rateLimit.ts`
- ✅ Client IP resolved via trusted-proxy hop count (`TRUSTED_PROXY_COUNT`) so a spoofed `X-Forwarded-For` can't forge rate-limit keys or audit IPs — `clientIp` in `lib/http.ts`
- ✅ Rate-limit trips recorded to metrics + audit; fail-open on Redis outage, backstopped by a DB-backed lockout on **both** login **and** MFA (guessable factors); passkey verification needs none (unforgeable crypto)
- ✅ Repeated MFA failures lock the account and revoke the pending session (force full re-auth)
- ✅ Time-boxed HIBP calls with graceful degraded state

## Logging & privacy (ASVS V7, Top 10 A09)

- ✅ Pino redaction scrubs password/hash/prefix/suffix/token/secret/cookie fields — `lib/logging/logger.ts`
- ✅ Proven by `tests/security/redaction.test.ts`
- ✅ Only aggregate metadata stored; audit logs contain no secrets
- ✅ Admin actions audited

## Data / supply chain (Top 10 A06/A08)

- ✅ Migration-based schema only (Drizzle); least-privilege DB user (see `docs/DEPLOYMENT.md`)
- ✅ Non-root container, Next.js standalone output, `.dockerignore`
- ✅ Lockfile committed; SBOM generated in CI; Dependabot (npm + actions + docker)
- ✅ CI: CodeQL, Semgrep, Trivy, Gitleaks, `npm audit --audit-level=critical`, OWASP ZAP baseline — fails on critical findings
- 🔶 Base image pinned by tag in the Dockerfile; pin by **digest** in production (Renovate/Dependabot keeps it fresh)
- 🔶 TLS to DB, KMS/Vault secret sourcing, encrypted backups — operator responsibility, documented in `DEPLOYMENT.md`

## Quality gates

- ✅ TypeScript strict (`strict` + `noUncheckedIndexedAccess`), no `any`
- ✅ `npm run typecheck`, `npm run lint`, `npm run test` all green; `npm run build` succeeds

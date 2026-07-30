# KeyShield — Threat Model

## 1. Assets

| Asset | Sensitivity |
| --- | --- |
| User-submitted passwords (checker/API) | **Critical** — never persisted; must never leak |
| Admin credentials (Argon2id hash, TOTP secret, passkeys) | Critical |
| Session state (DB rows + encrypted cookie) | High |
| Password policy | Medium (integrity) |
| Aggregate metrics & audit logs | Low/Medium (no secrets) |
| Common-password blocklist / offline breach corpus | Low |

## 2. Trust boundaries

```
[ Browser ]  ──HTTPS──▶  [ Next.js app (proxy + route handlers) ]  ──▶  [ PostgreSQL ]
    │  (untrusted input)          │  (CSP nonce, authz, rate limit)     └─▶ [ Redis ]
    │                             └───5-char SHA-1 prefix, HTTPS──▶ [ HIBP range API ]
```

- **Browser → app**: all input is untrusted; validated with Zod, unknown fields rejected.
- **App → HIBP**: only a 5-char hash prefix crosses this boundary; HTTPS-only, `Add-Padding: true`.
- **App → DB/Redis**: least-privilege credentials; TLS in production; parameterized queries only.

## 3. Actors

- **Anonymous user** — uses the checker and public APIs.
- **Admin** — manages policy, views analytics/audit. Requires password + MFA.
- **Attacker** — network MITM, credential-stuffer/brute-forcer, XSS/CSRF/clickjacking attempts, IDOR probing, enumeration, abuse/DoS, supply-chain.

## 4. Threats & mitigations (STRIDE)

### Spoofing / Authentication
- **Credential stuffing / brute force** → per-IP + per-account rate limits (`lib/security/rateLimit.ts`); temporary account lockout after repeated failures; generic login errors to block enumeration.
- **Session hijacking** → httpOnly + Secure + SameSite cookie carrying only an encrypted session id; DB-backed sessions with rotation on login and privilege change; idle + absolute timeouts; revoke-all.
- **Weak MFA** → TOTP with ±1 step drift + WebAuthn passkeys; MFA required for admin, enforced in `requireAdmin()` in every admin handler.

### Tampering
- **SQL injection** → Drizzle parameterized queries only; no string-built SQL.
- **Request tampering / mass assignment** → strict Zod schemas (`z.strictObject`) reject unknown fields; body size limits.
- **Policy tampering** → PUT `/api/policy` requires admin + CSRF; changes are audited.

### Repudiation
- Admin/security actions are recorded in `audit_logs` (no secrets) with actor, action, tag, and IP.

### Information disclosure
- **Password/hash/suffix leakage** → never logged (Pino redaction), never stored, never cached; only the safe 5-char prefix is cached in Redis. Verified by `tests/security/redaction.test.ts`.
- **Account enumeration** → uniform generic responses for login/reset.
- **Framework fingerprinting** → `x-powered-by` disabled.
- **Error leakage** → internal errors return a generic 500; details only for validation.

### Denial of service
- Redis-backed rate limits per IP/account/session/route; request body limits; HIBP calls time-boxed with `AbortController`, degrading to a clear "unknown" state instead of hanging.

### Elevation of privilege
- Deny-by-default RBAC re-checked **in each handler**, never relying on the proxy alone; IDOR avoided by ownership checks on session/credential rows.

### Cross-site attacks
- **XSS** → strict CSP with a per-request nonce and `'strict-dynamic'` (no unsafe-inline scripts); React output encoding; no `dangerouslySetInnerHTML`.
- **CSRF** → Origin/Referer allowlist + double-submit token on every cookie-authenticated mutation.
- **Clickjacking** → `frame-ancestors 'none'` + `X-Frame-Options: DENY`.

## 5. Out of scope / assumptions

- TLS termination and HSTS preload are handled at the edge/ingress in production (the app sets HSTS but assumes HTTPS).
- The demo runs with seeded demo secrets; production must supply real secrets via a secret manager (see `docs/DEPLOYMENT.md`).
- Physical/host security, DB engine hardening, and DDoS at L3/L4 are the platform's responsibility.
- Offline breach mode ships a small demo corpus; the full HIBP corpus is operator-provided.

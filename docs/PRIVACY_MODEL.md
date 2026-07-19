# KeyShield — Privacy Model

KeyShield's core promise: **a password you check is never logged, stored, or sent anywhere in a form that could reveal it.**

## What happens to a password you submit

1. **In the browser** — strength is computed locally with `zxcvbn-ts`. The password is held only in React state and is not transmitted for strength analysis.
2. **Breach check** — on blur/debounce the password is sent over HTTPS to KeyShield's own server, which:
   - computes `SHA-1(password)` **locally**,
   - sends **only the first 5 hex characters** of that hash to the HIBP range API (`Add-Padding: true`),
   - compares the returned suffixes locally to find any match + count.
3. **Server-side** the password is used within a single request and falls out of scope. It is never written to a log, a database, or a cache.

### What is never collected or stored

- ❌ Plaintext passwords
- ❌ Full password hashes
- ❌ The SHA-1 suffix used for comparison
- ❌ Reset tokens, MFA secrets, or session tokens in logs
- ❌ Any per-check identifier tying a check to a person

### What the breach API sees

Only a 5-character hex prefix (one of 16³ ≈ 1,048,576 buckets), which maps to hundreds of candidate hashes — the k-anonymity guarantee. `Add-Padding` normalizes response sizes so the queried prefix isn't inferable from traffic shape.

## Data that *is* stored

| Data | Where | Contains secrets? |
| --- | --- | --- |
| Aggregate daily metrics (check counts, weak/breached blocks, rejection-reason histogram, rate-limit/suspicious counts) | `metrics_daily` | No |
| Audit log (admin & security events: actor email, action, tag, IP) | `audit_logs` | No |
| Admin account (Argon2id hash, TOTP secret, passkey public keys) | `users`, `webauthn_credentials` | Credentials only — never plaintext |
| Sessions (id, user, timestamps, IP, UA) | `sessions` | No |
| Password policy | `policy` | No |

## Logging

Structured logs (Pino) apply a redaction allowlist that censors `password`, `passwordHash`, `prefix`, `suffix`, `token`, `csrf`, `secret`, `totpSecret`, `sessionId`, `cookie`, and `authorization` at root and one level deep, plus request cookie/authorization headers. This is enforced by config, not discipline, and is covered by `tests/security/redaction.test.ts`.

## Data retention

- **Password material**: retained for the lifetime of a single request only (never persisted).
- **Aggregate metrics**: retained indefinitely by default (contains no personal data); prune by day as policy dictates.
- **Audit logs**: retain per your compliance requirement (e.g. 90–365 days); they hold admin emails + IPs, so treat as operational PII and expire on a schedule.
- **Sessions**: bounded by idle (30 min) and absolute (12 h) timeouts; revoked rows can be pruned.

## Third parties

- **Have I Been Pwned Pwned-Passwords range API** — receives only the 5-char prefix. No account, cookie, or PII is sent. In **offline enterprise mode** (`BREACH_MODE=offline`) no external call is made at all; lookups run against a locally downloaded corpus.

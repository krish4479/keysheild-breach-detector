# KeyShield — Complete Project Overview

*A full, plain-language reference to everything in this website — written so it can be explained to (or handed to) a teacher/reviewer.*

---

## 0. The one-paragraph summary (the "elevator pitch")

**KeyShield is a password-security web application.** It lets anyone check how strong a password is and whether that password has already appeared in a known data breach — without ever sending the actual password anywhere. On top of that public tool, it includes a full **admin console** (analytics dashboard, editable password policy, and an audit log), a **secure REST API**, and a **hardened security baseline** so the app itself is built to resist the very attacks it protects against. It follows recognised industry standards: **OWASP Top 10 / ASVS 5.0**, **NIST SP 800-63B** (modern password guidance), and the **Have I Been Pwned (HIBP)** breach-checking method.

**Tagline in the app:** *"A security instrument for passwords."*  **Design theme:** *"Entropy & Vault."*

---

## Table of contents
1. [What the project is and why it matters](#1-what-the-project-is-and-why-it-matters)
2. [The technology stack](#2-the-technology-stack)
3. [Every page in the website](#3-every-page-in-the-website)
4. [The three core ideas (explained simply)](#4-the-three-core-ideas-explained-simply)
5. [The REST API](#5-the-rest-api)
6. [Security & how the app protects itself](#6-security--how-the-app-protects-itself)
7. [The database (what data is stored)](#7-the-database-what-data-is-stored)
8. [Testing](#8-testing)
9. [How it's built and run (DevOps)](#9-how-its-built-and-run-devops)
10. [Documentation included in the project](#10-documentation-included-in-the-project)
11. [How to run it & demo login](#11-how-to-run-it--demo-login)
12. [Honest limitations (it's a demo)](#12-honest-limitations-its-a-demo)
13. [Quick glossary](#13-quick-glossary)
14. [If the teacher asks… (quick answers)](#14-if-the-teacher-asks-quick-answers)

---

## 1. What the project is and why it matters

Weak and reused passwords are the single most common cause of account breaches. KeyShield is a **serious, production-style security product** (not a toy password meter) that demonstrates the *right* way to help people choose safe passwords **and** the *right* way to build a web app that itself can't be easily hacked.

It does three jobs:
1. **Measures password strength** — how hard a password is to guess.
2. **Detects breached passwords** — whether a password has already leaked publicly.
3. **Enforces a modern password policy** — configurable rules an admin controls.

The whole thing is one **full-stack application**: the front-end (what you see) and the back-end (the API + logic) are the **same codebase in one language (TypeScript)**. That's a deliberate design choice — it means the *exact same* strength-checking code runs both in your browser and on the server, so the results always match.

---

## 2. The technology stack

| Layer | Technology | Why |
|---|---|---|
| **Framework** | Next.js 16 (App Router) + React 19 | One app serves both the web pages and the API |
| **Language** | TypeScript (strict mode) | Type safety; no unsafe shortcuts |
| **Styling** | Tailwind CSS 4 | The custom "Entropy & Vault" design system |
| **Charts** | Recharts | Admin dashboard graphs |
| **Icons** | lucide-react | Clean line icons |
| **Database** | PostgreSQL 17 + Drizzle ORM | Stores policy, users, audit logs, analytics |
| **Cache / rate limiting** | Redis 7 | Rate limits + safe breach-response caching |
| **Password hashing** | Argon2id (`@node-rs/argon2`) | Industry-best way to store admin passwords |
| **Strength engine** | zxcvbn-ts | Realistic strength estimation (not just "has a number?") |
| **Breach lookup** | SHA-1 + HIBP range API | k-anonymity breach check (explained below) |
| **MFA** | otplib (TOTP) + SimpleWebAuthn (passkeys) | Two-factor / passwordless login for admins |
| **Sessions** | iron-session (encrypted cookies) | Secure login sessions — no tokens in the browser |
| **Validation** | Zod | Every input is checked against a strict schema |
| **Logging** | Pino (with redaction) | Structured logs that never record secrets |
| **Testing** | Vitest + Playwright | Unit, integration, security & browser tests |
| **Packaging** | Docker + Docker Compose | Runs the whole stack with one command |
| **CI/CD** | GitHub Actions | Automated tests + security scanning on every change |

> **Note:** In Next.js 16 the file historically called `middleware.ts` is now called `proxy.ts` — that's why this project uses `proxy.ts` for its security headers.

---

## 3. Every page in the website

The site has **two areas**: a **public site** (anyone can use) and an **admin console** (login + MFA required).

### Public pages

| # | Page | URL | What it does |
|---|---|---|---|
| 1 | **Landing / Home** | `/` | Explains what KeyShield is; buttons to the checker, security page, and API docs; shows the standards it follows and four feature cards. |
| 2 | **Password Checker** ⭐ | `/checker` | The flagship tool. Type a password and instantly see its **strength** (Weak/Fair/Good/Strong), estimated **entropy** and crack time, a **requirements checklist**, and — after you click away or press check — whether it's been **breached**. |
| 3 | **Security & Privacy** | `/security` | A plain-language explainer of how breach detection stays private, why two different hash functions are used, how login/sessions work, how the app defends itself, and what data is (and isn't) kept. |
| 4 | **API Docs** | `/docs/api` | Human-readable list of every API endpoint, grouped and colour-coded by method, generated from an OpenAPI 3.1 spec. Has a "Download OpenAPI JSON" button. |
| 5 | **Admin Login** | `/admin/login` | Two-step login: email + password, then a **6-digit MFA code**. The bridge into the admin area. |

### Admin-only pages (require login + MFA)

| # | Page | URL | What it does |
|---|---|---|---|
| 6 | **Dashboard** | `/admin/dashboard` | Security analytics: four stat cards (checks run, weak blocked, breached blocked, MFA adoption %) with mini-sparklines, plus a bar chart of top rejection reasons and a line chart of daily activity. **Aggregate numbers only — never a real password.** |
| 7 | **Policy Editor** | `/admin/policy` | Turn the password rules on/off and set the numbers (minimum length, max length, minimum strength score, reuse history, etc.). Saved to the database and enforced by the server. |
| 8 | **Audit Log** | `/admin/audit-logs` | A read-only, time-stamped record of admin/security events (policy changes, logins, MFA events, rate-limit trips…). **Never contains passwords, hashes, or secrets.** |

### The password checker in detail (the page a teacher will most likely look at)

When you type into `/checker`:
- **Strength is analysed on your device, on every keystroke** — instantly, with no network call.
- A **4-segment meter** fills up (1 = Weak → 4 = Strong) and a coloured badge shows the verdict.
- You see a readout like `~72 bits · 18 chars` (entropy + length) and up to four **reasons** ("This is a top-10 common password", "Contains a keyboard pattern like *qwerty*", etc.).
- The **breach check runs only when you click away (blur) or press the button** — never on every keystroke — and it's **debounced** (waits ~700 ms) so it isn't spammed.
- A **NIST 800-63B requirements checklist** ticks off live: minimum length, reads like a passphrase, not common/breached, no keyboard walks, no long repeats. (It deliberately does **not** require "one uppercase + one symbol", because modern guidance favours length over forced complexity.)
- A **privacy banner** states plainly that your password never leaves the device un-hashed.

---

## 4. The three core ideas (explained simply)

### A. Password strength (the `lib/strength` engine)
KeyShield uses **zxcvbn-ts**, a well-known library that estimates how many guesses an attacker would need. Instead of naive rules ("must have a number"), it detects real weaknesses: dictionary words, names, dates, keyboard walks (`qwerty`, `asdf`), repeats (`aaaa`), sequences (`1234`), and "leetspeak" tricks (`P@ssw0rd`). It also takes **your personal info** (email, name) so a password made from them scores lower.

- Output: a **score 0–4** → label **Weak (≤1) / Fair (2) / Good (3) / Strong (4)**, plus entropy in bits, a crack-time estimate, human-readable reasons, and improvement suggestions.
- **Key point for the teacher:** the *same* engine runs in the browser and on the server, so the verdicts are identical — that's why the code lives in one shared file.

### B. Breach detection with **k-anonymity** (the `lib/breach` engine)
This is the clever, privacy-preserving part. KeyShield checks the password against **Have I Been Pwned (HIBP)**, a database of billions of leaked passwords — **without ever sending the password.**

How it works:
1. The server computes the **SHA-1 hash** of the password (a 40-character fingerprint).
2. It sends **only the first 5 characters** of that hash to HIBP.
3. HIBP replies with *all* leaked hashes that start with those 5 characters (hundreds of them).
4. The server compares the rest **locally** to find a match and its breach count.

Because only a 5-character prefix leaves the server, HIBP never learns the actual password — this is called **k-anonymity**. Extra protections: an `Add-Padding` header hides the response size, everything is HTTPS-only, results are cached briefly in Redis (only the safe prefix), and there's an **offline "enterprise" mode** that checks a downloaded corpus so *zero* external calls are made. If HIBP is unreachable, the app **degrades gracefully** (reports "unknown") rather than blocking the user.

> **Why SHA-1 here but Argon2id elsewhere?** SHA-1 is used *only* for the breach lookup (that's what HIBP uses) — never to store anything. Admin passwords are stored with **Argon2id**, a slow, salted hashing algorithm designed to resist cracking.

### C. Password policy (the `lib/policy` engine)
A configurable set of rules, following **NIST SP 800-63B**:
- Minimum **15 characters** (or **8** if MFA is on) — favouring length over complexity.
- Allow up to 128 characters, allow spaces and Unicode, **never silently cut off** a password.
- **Don't** force uppercase/symbol composition; **don't** force periodic password changes.
- **Block** breached passwords and common passwords; prevent reuse of recent passwords.

The admin edits this in `/admin/policy`; it's stored in the database and enforced by the server whenever a password is validated. Each password gets a **risk level** (low / medium / high / critical).

---

## 5. The REST API

All endpoints live under `/api/...`. Every request is validated with Zod (unknown fields rejected, 64 KB body limit), and admin endpoints re-check authentication *inside the handler*.

| Method & path | Purpose | Auth | Rate limit |
|---|---|---|---|
| `POST /api/password/analyze` | Strength analysis only | Public | 60 / min per IP |
| `POST /api/password/check-breach` | Breach lookup only | Public | 30 / min per IP |
| `POST /api/password/validate` | **Combined verdict** (strength + breach + policy) | Public | 60 / min per IP |
| `GET /api/policy` | Read the current policy | Public | — |
| `PUT /api/policy` | Update the policy | **Admin** | 20 / min |
| `GET /api/admin/metrics` | Dashboard analytics | **Admin** | — |
| `GET /api/admin/audit-logs` | Audit log feed | **Admin** | — |
| `GET /api/health` | Health check (DB + Redis + HIBP) | Public | — |
| `GET /api/security/headers-check` | Reports which security headers are set | Public | — |
| `GET /api/openapi` | Download the OpenAPI spec | Public | — |
| `POST /api/auth/login` · `/mfa` · `/logout` | Admin login flow | mixed | yes |
| `DELETE /api/auth/sessions` | "Log out everywhere" | Auth | yes |
| `.../auth/webauthn/**` | Passkey register/authenticate | mixed | yes |

**Example response from `POST /api/password/validate`:**
```json
{
  "valid": false,
  "score": 1,
  "riskLevel": "critical",
  "strengthLabel": "Weak",
  "breached": true,
  "breachCount": 3730471,
  "reasons": ["Password appears in known breaches", "This is a very common password"],
  "suggestions": ["Use several unrelated words as a passphrase"]
}
```

---

## 6. Security & how the app protects itself

This is a security product, so the app is hardened against attack. Highlights:

**Authentication (admin login)**
- Admin passwords stored with **Argon2id** (salted, memory-hard).
- **MFA required** — either a 6-digit **TOTP** code (authenticator app) or a **WebAuthn passkey**.
- Sessions are **server-side**; the browser only holds an **encrypted cookie** (httpOnly, Secure, SameSite) with a session ID — **no tokens in localStorage**.
- **Idle timeout** (30 min) and **absolute timeout** (12 h); sessions rotate on login; "log out everywhere" supported.
- **Account lockout:** 5 failed attempts → locked 15 minutes. Login errors are **generic** ("Invalid email or password") so attackers can't tell which accounts exist.

**Authorization**
- **Deny-by-default** role-based access (admin vs user), **re-checked inside every API handler** — not relying on routing alone.

**Input / output safety**
- Every input validated with **Zod** (strict).
- Database access is **parameterised** via Drizzle ORM — no string-built SQL (prevents SQL injection).

**CSRF / CORS**
- **CSRF protection** on every cookie-authenticated action: a strict Origin/Referer check **plus** a double-submit token.
- **Same-origin only** — no cross-origin credentialed calls.

**Security headers** (set in `proxy.ts`)
- **Content-Security-Policy with a per-request nonce** (`strict-dynamic`, no inline scripts) — strong XSS defence.
- **HSTS**, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (clickjacking), `Referrer-Policy: no-referrer`, a locked-down Permissions-Policy, and COOP/CORP.

**Rate limiting & abuse protection**
- Redis-based limits per **IP / account / session / route**. Trips are audited and counted.
- If Redis fails, the limiter **fails open** (never blocks real users) — and the **database-backed account lockout** is the safety net that still stops password/MFA guessing.

**Logging privacy**
- Pino logging **redacts** passwords, hashes, hash prefixes/suffixes, tokens, session IDs, cookies, and TOTP secrets — they can never appear in logs.

**Standards addressed:** OWASP Top 10 (A01–A09), OWASP ASVS 5.0 cheat sheets (password storage, sessions, CSRF, WebAuthn), and NIST SP 800-63B.

---

## 7. The database (what data is stored)

PostgreSQL, managed with Drizzle ORM migrations. **8 tables:**

| Table | What it holds |
|---|---|
| `users` | Admin account(s): email, Argon2id password hash, role, TOTP secret, MFA flag, failed-login count, lock time. |
| `password_history` | Recent password **hashes** (never plaintext) to prevent reuse. |
| `sessions` | Server-side login sessions (for rotation, timeout, revoke, "log out all"). |
| `webauthn_credentials` | Registered passkeys (public key + signature counter). |
| `policy` | The single password-policy row (as JSON), plus who last changed it. |
| `audit_logs` | Time-stamped admin/security events — **contains no secrets**. |
| `metrics_daily` | Daily **aggregate** analytics only — never a password/hash/user. |
| `common_passwords` | The common-password blocklist. |

**Crucial privacy point:** a password you *check* is never written to the database — only aggregate counts (e.g. "12 weak passwords blocked today") are kept.

---

## 8. Testing

| Type | Tool | Covers |
|---|---|---|
| **Unit** (5 files) | Vitest | Strength labels & determinism, policy evaluation, breach logic (asserts *only* the 5-char prefix is sent), Zod validation, trusted-proxy IP handling. |
| **Security** (1 file) | Vitest | Proves the log redaction works — secrets never reach the logs. |
| **Integration** (1 file) | Vitest | Hits the running API: health, security headers, validation, admin access denial, CSRF blocking, rate-limit 429s. |
| **End-to-end** (2 files) | Playwright | Drives a real browser: admin login with a generated TOTP code, and the full public flow (checker, demos, API docs) — with screenshots. |

---

## 9. How it's built and run (DevOps)

- **Docker (multi-stage, non-root):** the app runs as an unprivileged user in a slim Node image using Next.js "standalone" output.
- **Docker Compose** brings up **four services**: `postgres`, `redis`, a one-shot `migrate` (runs DB migrations + seed data), and the `app` — each with health checks. One command (`docker compose up --build`) starts everything at http://localhost:3000.
- **GitHub Actions CI** runs on every push/PR with **7 jobs**: quality (typecheck, lint, test, build, generate an **SBOM**), end-to-end tests + **OWASP ZAP** scan, **CodeQL**, **Semgrep**, **Trivy**, **Gitleaks** (secret scanning), and a dependency audit. This is a genuine security-focused pipeline.

---

## 10. Documentation included in the project

The `docs/` folder contains four professional documents:
- **THREAT_MODEL.md** — assets, trust boundaries, and a full **STRIDE** analysis of attacks and mitigations.
- **SECURITY_CHECKLIST.md** — every control mapped to OWASP ASVS 5.0 / Top 10 and NIST, with status marks.
- **PRIVACY_MODEL.md** — the promise that a checked password is never logged/stored/leaked, with the full data lifecycle.
- **DEPLOYMENT.md** — how to deploy to production and a hardening checklist.

Plus a top-level **README.md** summarising the whole product.

---

## 11. How to run it & demo login

**Run it:**
```bash
cd keyshield
docker compose up --build
# then open http://localhost:3000
```

**Demo admin account** (for the `/admin/login` page — these are demo-only credentials, safe to show):
- **Email:** `admin@keyshield.local`
- **Password:** `correct-horse-battery-staple-42`
- **MFA:** it uses a TOTP secret; run `npm run totp` to print the current 6-digit code.

**Try the checker first (no login needed):** open `/checker` and type a few passwords — e.g. `password123` (weak + breached) vs. a long random passphrase (strong + safe).

---

## 12. Honest limitations (it's a demo)

Be upfront with the teacher — good engineering includes knowing the trade-offs:
- The **demo admin password and secrets have default values** for convenience; in real deployment they must be rotated (the deployment docs say so).
- The rate limiter **fails open** if Redis is down — the database lockout is the backstop by design.
- The session cookie uses `SameSite=Lax` (not Strict), relying on the CSRF token + Origin check for the strict layer.
- CSP allows inline **styles** (not scripts) — a documented, minor trade-off.
- Minor doc drift: some docs mention Node 22 while the Dockerfile uses Node 24.
- The app is a **public password-checking tool** — there are no user accounts, no signup, and no password-change flow. The only accounts are admin accounts for the security console.

---

## 13. Quick glossary

| Term | Meaning |
|---|---|
| **Entropy** | A measure of unpredictability (in bits). More bits = harder to guess. |
| **Hash** | A one-way fingerprint of data. You can't reverse it to get the original. |
| **SHA-1** | An older hash function — used here *only* for the HIBP breach lookup. |
| **Argon2id** | A modern, slow, salted hash used to *store* passwords securely. |
| **k-anonymity** | Hiding one item among *k* others — here, sending only 5 hash characters so the real password stays private. |
| **HIBP** | "Have I Been Pwned" — a public database of breached passwords. |
| **MFA / TOTP** | Multi-Factor Auth / the 6-digit codes from an authenticator app. |
| **WebAuthn / passkey** | Passwordless login using your device (fingerprint/PIN/security key). |
| **CSRF** | An attack that tricks your browser into making unwanted requests — blocked here. |
| **CSP** | Content-Security-Policy — a browser rule set that blocks injected scripts (XSS). |
| **Rate limiting** | Capping how many requests one source can make, to stop brute-forcing. |
| **RBAC** | Role-Based Access Control — permissions based on role (admin vs user). |
| **SBOM** | Software Bill of Materials — a list of every dependency, for supply-chain security. |

---

## 14. If the teacher asks… (quick answers)

- **"What does it do?"** → Checks password strength and whether a password has been breached, and enforces a modern password policy — with a secure admin console and API.
- **"Is my password sent anywhere?"** → No. Strength is checked in your browser; the breach check sends only the first 5 characters of a hash (k-anonymity), never the password.
- **"What makes it 'secure'?"** → Argon2id password storage, MFA, encrypted server-side sessions, strict CSP, CSRF protection, rate limiting + lockout, deny-by-default access control, and no secrets in logs — all mapped to OWASP/NIST standards.
- **"What did you use to build it?"** → A single Next.js + TypeScript full-stack app, with PostgreSQL, Redis, Docker, and a GitHub Actions security pipeline.
- **"How do I see it working?"** → `docker compose up --build`, then open http://localhost:3000/checker.
- **"How do you know it works?"** → Unit, integration, security, and end-to-end (browser) tests, plus automated security scanning (CodeQL, Semgrep, Trivy, Gitleaks, ZAP) on every commit.

---

*Generated as a reference for presenting the KeyShield project. Every detail above was drawn directly from the project's real source code.*

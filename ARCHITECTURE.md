# KeyShield — Architecture

*System architecture of the KeyShield password-security platform. Diagrams below use **Mermaid** — they render automatically in VS Code (Markdown preview), GitHub, and most Markdown viewers.*

---

## 1. Overview

KeyShield is built as a **single full-stack Next.js application in TypeScript** — the web pages (front-end) and the REST API (back-end) live in **one codebase and one language**. This is a deliberate architectural choice: the *exact same* password-strength code and the *exact same* validation rules run on both the browser and the server, so the results can never disagree.

**Guiding principles**
- **One shared engine** — strength analysis and Zod validation schemas are written once and imported by both client and server.
- **Privacy by design** — a password being checked is analysed locally; only a 5-character hash prefix ever leaves the server (and only for the breach lookup).
- **Defence in depth** — every request passes through independent security layers (headers → validation → CSRF → rate limit → auth → parameterised queries → audit).
- **Deny by default** — access is denied unless explicitly allowed, and authorisation is re-checked *inside every* API handler.
- **Framework-agnostic core** — all business logic sits in `lib/`, so it could be lifted into another framework without a rewrite.

---

## 2. High-level system architecture

```mermaid
flowchart LR
  U["User's Browser<br/>(React UI)"] -->|HTTPS| PX

  subgraph APP["Next.js 16 App — single TypeScript codebase"]
    PX["proxy.ts<br/>security headers + CSP nonce"]
    PG1["React Pages<br/>(App Router)"]
    API["API Route Handlers<br/>/api/**"]
    LIB["lib/ core engines<br/>strength · breach · policy<br/>auth · security · db"]
    PX --> PG1
    PX --> API
    PG1 -->|shared code| LIB
    API --> LIB
  end

  LIB --> DB[("PostgreSQL 17<br/>Drizzle ORM")]
  LIB --> RD[("Redis 7<br/>rate limit + cache")]
  LIB -->|"5-char hash prefix only"| HIBP[("Have I Been Pwned<br/>Pwned Passwords API")]
```

**Three external dependencies:** PostgreSQL (durable data), Redis (rate limiting + safe breach-cache), and the HIBP API (breach lookups; optional — can run fully offline).

---

## 3. Layered / component architecture

The codebase is organised by responsibility. The `lib/` layer holds all the logic; pages and API handlers are thin and call into it.

```mermaid
flowchart TB
  subgraph Presentation["app/ — Presentation (App Router)"]
    direction LR
    Public["Public pages<br/>/ · /checker · /security · /docs/api"]
    Admin["Admin pages<br/>/admin/{login,dashboard,policy,audit-logs}"]
  end

  subgraph Components["components/ — 18 React components"]
    C["PasswordAnalyzer · StrengthMeter · BreachBadge<br/>RequirementsChecklist · PolicyEditor · DashboardClient · …"]
  end

  subgraph ApiLayer["app/api/** — REST API handlers"]
    direction LR
    APwd["password/{analyze,check-breach,validate}"]
    AAuth["auth/{login,mfa,logout,sessions,webauthn/**}"]
    AAdmin["policy · admin/{metrics,audit-logs}"]
    ASys["health · security/headers-check · openapi"]
  end

  subgraph Core["lib/ — Core engines & services"]
    direction LR
    L1["strength/<br/>(zxcvbn-ts)"]
    L2["breach/<br/>(HIBP k-anonymity)"]
    L3["policy/<br/>(NIST 800-63B)"]
    L4["auth/<br/>argon2 · totp · webauthn<br/>session · rbac"]
    L5["security/<br/>csrf · headers<br/>rateLimit · challenge"]
    L6["validation/ (Zod)<br/>db/ (Drizzle) · logging/ (Pino)"]
  end

  Presentation --> Components
  Components --> ApiLayer
  Presentation --> ApiLayer
  ApiLayer --> Core
  Components -->|shared strength + validation| Core
```

---

## 4. Request lifecycle — `POST /api/password/validate`

This is the app's combined verdict (strength + breach + policy) and shows how a request flows through the stack.

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant A as API validate handler
  participant S as Strength engine
  participant Br as Breach engine
  participant P as Policy + DB

  B->>A: POST { password, userInputs, mfaEnabled }
  A->>A: Zod validate (strict, reject unknown, 64 KB cap)
  A->>S: analyzeStrength()  → score, entropy, reasons
  par Run in parallel
    A->>Br: checkBreach()  → sends only 5-char hash prefix
    A->>P: getActivePolicy() + isCommonPassword()
  end
  A->>P: evaluatePolicy()  → valid? riskLevel? reasons
  A->>P: recordValidation()  → aggregate counters only (no password)
  A-->>B: { valid, score, riskLevel, breached, breachCount, reasons, suggestions }
```

> **Key point:** the password is used in memory and discarded — it is never written to the database or the logs. Only anonymous aggregate counts (e.g. "weak blocked +1") are stored.

---

## 5. Breach detection — k-anonymity (the signature feature)

How KeyShield checks a password against ~1 billion leaked passwords **without ever sending it**.

```mermaid
sequenceDiagram
  autonumber
  participant Srv as KeyShield Server
  participant R as Redis cache
  participant H as HIBP API

  Note over Srv: SHA-1(password) = 40 hex chars
  Srv->>Srv: prefix = first 5 chars, suffix = last 35 chars
  Srv->>R: GET hibp:range:{prefix}
  alt cache miss
    Srv->>H: GET /range/{prefix}  (Add-Padding: true, HTTPS)
    H-->>Srv: ~500 lines of "SUFFIX:COUNT"
    Srv->>R: cache prefix response (TTL 300s)
  end
  Srv->>Srv: match suffix locally → breach count
  Note over Srv,H: plaintext, full hash, and suffix are NEVER sent or logged
```

Because hundreds of leaked passwords share the same 5-character prefix, HIBP cannot tell which one is being checked. If HIBP is unreachable, the result degrades to "unknown" (it does **not** wrongly block the user). An **offline mode** checks a local corpus instead, making zero external calls.

---

## 6. Authentication & session flow (admin login)

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant L as /api/auth/login
  participant M as /api/auth/mfa
  participant DB as PostgreSQL

  B->>L: email + password (+ CSRF token)
  L->>L: CSRF check + rate limit (per IP & per account)
  L->>DB: look up user, verify with Argon2id
  alt too many failures
    L-->>B: 423 Locked (5 strikes → 15 min)
  else valid
    L->>DB: create session (mfaVerified = false)
    L-->>B: { mfaRequired: true }  + encrypted session cookie
    B->>M: 6-digit TOTP code (+ CSRF token)
    M->>M: verify code (otplib)
    M->>DB: elevate session → mfaVerified = true
    M-->>B: { ok } → redirect to /admin/dashboard
  end
```

Sessions are **server-side rows**; the browser holds only an encrypted `httpOnly`+`Secure`+`SameSite` cookie carrying the session id — never a token in localStorage. WebAuthn passkeys are supported as a strong (passwordless) alternative to the TOTP step.

---

## 7. Security — defence in depth

Every state-changing request passes through independent layers. If one fails, the others still stand.

```mermaid
flowchart TB
  Req["Incoming request"] --> H1["1 · proxy.ts<br/>CSP nonce + HSTS + security headers"]
  H1 --> H2["2 · Zod validation<br/>strict schema, 64 KB body cap"]
  H2 --> H3["3 · CSRF<br/>Origin allowlist + double-submit token"]
  H3 --> H4["4 · Rate limiting<br/>Redis: per IP / account / session"]
  H4 --> H5["5 · AuthN + AuthZ<br/>session check + RBAC re-check in handler"]
  H5 --> H6["6 · Business logic<br/>parameterised Drizzle queries only"]
  H6 --> H7["7 · Audit log<br/>redacted — never stores secrets"]
  H7 --> Resp["Response"]

  H4 -.->|"Redis down = fail open"| Fallback["DB-backed account lockout<br/>backstops password/MFA guessing"]
```

---

## 8. Data model

Eight PostgreSQL tables, managed with Drizzle ORM migrations.

```mermaid
erDiagram
  users ||--o{ sessions : "has"
  users ||--o{ password_history : "has"
  users ||--o{ webauthn_credentials : "has"

  users {
    uuid id PK
    text email UK
    text password_hash "Argon2id"
    enum role "admin | user"
    text totp_secret
    bool mfa_enabled
    int failed_login_count
    timestamptz locked_until
  }
  sessions {
    uuid id PK
    uuid user_id FK
    bool mfa_verified
    timestamptz expires_at
    timestamptz last_seen_at
    timestamptz revoked_at
  }
  password_history {
    uuid user_id FK
    text password_hash "reuse prevention"
  }
  webauthn_credentials {
    text id PK "credential id"
    uuid user_id FK
    text public_key
    int counter
  }
  policy {
    int id PK "always 1"
    jsonb settings "NIST policy"
    text updated_by_email
  }
  audit_logs {
    uuid id PK
    text action
    enum tag
    jsonb detail "no secrets"
  }
  metrics_daily {
    date day PK
    int password_checks
    int weak_blocked
    int breached_blocked
  }
  common_passwords {
    text value PK "blocklist"
  }
```

> **Privacy invariant:** a *checked* password is never stored anywhere. `metrics_daily` holds only aggregate counts; `audit_logs` holds only events; passwords/hashes/tokens are never written.

---

## 9. Deployment topology (Docker Compose)

```mermaid
flowchart TB
  Dev["Developer / User<br/>docker compose up --build"] --> Compose

  subgraph Compose["Local stack (4 services, non-root, health-checked)"]
    direction TB
    M["migrate (one-shot)<br/>db:migrate + db:seed"]
    App["app<br/>Next.js standalone runner<br/>:3000"]
    PG["postgres:17-bookworm<br/>:5432 · pgdata volume"]
    RD["redis:7-alpine"]
  end

  M -->|creates schema + seed data| PG
  App --> PG
  App --> RD
  App -.->|"waits for healthy"| PG
  App -.->|"waits for healthy"| RD
  App -.->|"waits for completed"| M
  Browser["Browser → http://localhost:3000"] --> App
```

**CI/CD (GitHub Actions):** 7 jobs on every push/PR — quality (typecheck, lint, test, build, SBOM), end-to-end + OWASP ZAP, CodeQL, Semgrep, Trivy, Gitleaks, and a dependency audit.

---

## 10. Technology stack

| Concern | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 · "Entropy & Vault" design system |
| Strength engine | zxcvbn-ts (shared client + server) |
| Breach lookup | `node:crypto` SHA-1 + HIBP range API |
| Database | PostgreSQL 17 + Drizzle ORM |
| Cache / rate limiting | Redis 7 (ioredis) |
| Password hashing | Argon2id (`@node-rs/argon2`) |
| MFA | otplib (TOTP) + SimpleWebAuthn (passkeys) |
| Sessions | iron-session (encrypted cookies) |
| Validation | Zod (shared schemas) |
| Logging | Pino (with secret redaction) |
| Charts / icons | Recharts · lucide-react |
| Testing | Vitest + Playwright |
| Packaging / CI | Docker Compose · GitHub Actions |

---

## 11. Key design decisions

1. **One Next.js app instead of a separate API service** — the API surface is small (~15 endpoints), and a single TypeScript codebase lets the same strength engine and the same validation schema run on client and server, guaranteeing identical verdicts.
2. **PostgreSQL for relational data** (policy, RBAC, users, audit) and **Redis for ephemeral data** (rate-limit counters, safe breach-cache).
3. **Business logic isolated in `lib/`** so it is framework-agnostic and unit-testable.
4. **Security re-checked in every handler** — never relying on routing/middleware alone.
5. **Local-first analysis** — strength runs in the browser; only a 5-char prefix leaves the server, preserving the privacy promise.

---

## 12. Planned enhancement — Neural guessability (AI/ML)

A compact **neural character-language model** is planned as a complement to zxcvbn: trained offline on a public leaked-password corpus, it scores how *predictable* a password is (predictable ⇒ weak). It will ship as exported weights with **pure-TypeScript inference**, so it runs **locally on-device** like the rest of the strength engine — no GPU, no external calls, privacy preserved. It slots into the existing `lib/strength/` layer and surfaces as an "AI guessability" gauge on `/checker` alongside the classical score.

---

*This architecture reflects the KeyShield codebase as built. Diagrams are Mermaid; open this file in VS Code's Markdown preview to view them rendered.*

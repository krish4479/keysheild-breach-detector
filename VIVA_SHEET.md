# KeyShield — Viva Preparation Sheet

*Everything you need to explain the project confidently: what it is, how you built each part, the ML model's metrics, and a full Q&A. Study the **bold** lines — they're your talking points.*

---

## 0. 30-second pitch

> "KeyShield is a **password-security web app**. It lets anyone check how strong a password is and whether it has already been leaked in a data breach — **without the password ever leaving the device unhashed**. It adds a **machine-learning model** that scores guessability, a **NIST-based password policy**, an **admin console** with analytics, and the app itself is **hardened** against the OWASP Top 10. Built as one full-stack Next.js + TypeScript app."

---

## 1. The problem & the idea

- Weak and **reused/leaked** passwords are the #1 cause of account breaches.
- Two things make a password safe: it must be **hard to guess** and **not already leaked**.
- KeyShield measures both, using real security research (not naive "add a symbol" rules), following **OWASP Top 10 / ASVS 5.0** and **NIST SP 800-63B**.

---

## 2. What I built (the tour)

**Public**
- **`/` Landing** — explains the product.
- **`/checker`** ⭐ — the flagship tool: enter a **username + password**, see live **strength** (Weak→Strong), **entropy**, an **AI guessability** gauge, a **breach check**, and a **requirements checklist** — including *"doesn't contain your username."*
- **`/security`** — plain-language security & privacy model.

**Admin (login + MFA required)**
- **`/admin/login`** — email + password, then a 6-digit MFA code.
- **`/admin/dashboard`** — analytics (checks, weak/breached blocked, MFA adoption) — aggregate numbers only.
- **`/admin/policy`** — edit the password rules (stored in DB, enforced server-side).
- **`/admin/audit-logs`** — time-stamped security events (never secrets).

**REST API** — `password/analyze`, `check-breach`, `validate`; `policy` (GET/PUT); `admin/metrics`, `admin/audit-logs`; `health`; `security/headers-check`; and auth (`login`, `mfa`, `logout`, `me`, `csrf`, `sessions`, `webauthn/**`).

> *(I removed the earlier signup, change-password, and API-docs pages — the app is a focused public checking tool + admin console.)*

---

## 3. Tech stack (and why)

| Layer | Tech | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router) + React 19 | one app = web + API |
| Language | **TypeScript strict** | type safety, `noUncheckedIndexedAccess` |
| DB | **PostgreSQL 17 + Drizzle ORM** | relational data, migrations |
| Cache | **Redis 7** | rate limiting + safe breach-cache |
| Hashing | **Argon2id** | best-practice password storage |
| Strength | **zxcvbn-ts** | realistic guess estimation |
| Breach | SHA-1 + **HIBP** range API | k-anonymity leak check |
| MFA | **otplib (TOTP)** + **SimpleWebAuthn (passkeys)** | two-factor |
| Sessions | **iron-session** | encrypted cookie, DB-backed |
| Validation | **Zod** | strict input schemas |
| Logging | **Pino** (redacted) | no secrets in logs |
| ML | **numpy** (train) + **pure TypeScript** (inference) | trained offline, runs in browser |
| DevOps | **Docker Compose + GitHub Actions** | one-command run + CI security scans |

---

## 4. The three core ideas (explain these well)

### A. Password strength (`lib/strength`)
Uses **zxcvbn** — estimates how many guesses an attacker needs. Detects dictionary words, names, dates, keyboard walks (`qwerty`), repeats, sequences, and leetspeak (`P@ssw0rd`). Output: **score 0–4 → Weak/Fair/Good/Strong**, entropy in bits, reasons, suggestions. It also takes **user inputs** (username/name) so passwords built from them score lower.

### B. Breach detection via k-anonymity (`lib/breach`) — the standout
1. Hash the password with **SHA-1** (a 40-char fingerprint).
2. Send **only the first 5 characters** to Have I Been Pwned.
3. HIBP returns *all* leaked hashes starting with those 5 chars (~500).
4. Compare the rest **locally** → found = breached (with count).

**HIBP never sees the password or even the full hash.** Extra: `Add-Padding` header hides response size; HTTPS only; short Redis cache of the safe prefix; an **offline mode** (zero external calls); and if HIBP is down it **degrades gracefully** (doesn't wrongly block).

> **Why SHA-1 here but Argon2id elsewhere?** SHA-1 is used *only* for the HIBP lookup (that's HIBP's format) — never to store anything. Admin passwords are stored with **Argon2id**, a slow, salted, memory-hard hash.

### C. Password policy (`lib/policy`) — NIST 800-63B
- **Length over complexity**: min **15** chars (or **8** with MFA).
- Allow up to 128 chars, spaces, Unicode; **never truncate**.
- **Don't** force symbols/uppercase; **don't** force periodic changes.
- **Block** breached + common passwords; prevent reuse.
- **New rule:** the password must **not contain the username** (any ≥4-char chunk — so username `krishjosh` blocks `krish`, `josh`, etc.). Enforced client-side (live checklist) **and** server-side in `/api/password/validate`.

---

## 5. The AI/ML model — your ML answers

**What it is:** a **character-level neural n-gram language model** (NPLM, Bengio-style) — genuine supervised deep learning, based on Melicher et al., *USENIX Security 2016*.

**How it works:** it reads a password one character at a time and predicts the next character. Trained on real leaked passwords, it becomes an expert at *password-shaped* text. A password it predicts **easily = weak**; one that **surprises it = strong**.

**Architecture:** char embeddings (16-dim) → hidden layer (128 units, tanh) → softmax over a **138-symbol** vocabulary. Context = previous **3** characters. **~26,000 parameters**, exported to a **242 KB** JSON.

**Data & training:**
- Corpus: the **rockyou** breach list (14.3M passwords); training was time-capped and reached **~5.7 million**.
- **HIBP-weighted**: the most-breached passwords (real HIBP counts, e.g. `123456` = 210M) were up-weighted.
- **Cross-entropy loss + Adam optimiser**, streamed in blocks (memory-safe).

**Scoring:** total guessability = `log10(estimated guesses)`, mapped to **0–100** against data anchors (median-weak = 12.09, median-strong = 50.47). Using *total* (not per-character) surprise means **long passphrases score high** — matching the app's "length wins" message.

**Where it runs:** inference re-implemented in **~80 lines of pure TypeScript** → runs **locally in the browser**, so the password never leaves the device. Shown as the **"AI Guessability" gauge** next to zxcvbn.

### 5.1 Evaluation metrics — memorise these

Held-out test: **2,000 unseen rockyou passwords** (from beyond the training cutoff) vs **2,000 strong** (random + diceware). "Positive" = model **flags as weak**.

| Metric | Value | What it means |
|---|---|---|
| **Accuracy** | **99.50%** | overall correct = (TP+TN)/total |
| **Precision** | **99.85%** | of those flagged weak, how many truly were (1983/1986) |
| **Recall** | **99.15%** | of the truly weak, how many were caught (1983/2000) |
| **F1 score** | **99.50%** | harmonic mean of precision & recall |
| **False Positive Rate** | **0.15%** | strong wrongly flagged (usability cost) |
| **False Negative Rate** | **0.85%** | weak wrongly passed (security cost) |
| **ROC AUC** | **0.9989** | threshold-independent separation (1 = perfect) |

Confusion matrix: **TP 1983 · FN 17 · FP 3 · TN 1997**. Reproducible via [`ml/evaluate.py`](ml/evaluate.py).

**Formulas (if asked):**
- Precision = TP / (TP + FP)
- Recall = TP / (TP + FN)
- F1 = 2 · (P · R) / (P + R)
- Accuracy = (TP + TN) / (TP + TN + FP + FN)

---

## 6. Security hardening (defense in depth)

Every request passes independent layers: **security headers (CSP nonce, HSTS) → Zod validation → CSRF (Origin + double-submit token) → rate limiting (Redis) → auth + RBAC re-check → parameterised Drizzle queries → redacted audit log.**

- **Argon2id** password storage; **MFA required** for admins (TOTP + passkeys).
- **Sessions**: server-side, encrypted httpOnly cookie holds only a session id; rotation, idle + absolute timeouts, "log out everywhere"; **5-strike lockout**.
- **Deny-by-default RBAC**, re-checked in every handler.
- **No SQL injection** (parameterised), strong **CSP** (nonce, no inline scripts) blocks XSS.
- **Rate limiter fails open** if Redis dies — the **DB lockout is the backstop**.
- Logs **redact** passwords/hashes/tokens.
- Maps to **OWASP Top 10** (A01–A09) and **NIST 800-63B**.

---

## 7. Data, testing, DevOps

- **8 PostgreSQL tables**: users, password_history, sessions, webauthn_credentials, policy, audit_logs, metrics_daily, common_passwords. **A checked password is never stored** — only aggregate counts.
- **Tests**: unit (strength, policy, breach, validation, IP, neural), security (log redaction), integration (API), e2e (Playwright). **~35 unit/security + 8 integration.**
- **DevOps**: Docker Compose (app + postgres + redis + one-shot migrate). **GitHub Actions CI**: typecheck, lint, test, build, SBOM, plus **CodeQL, Semgrep, Trivy, Gitleaks, OWASP ZAP**.

---

## 8. Anticipated viva questions & answers

**Q: What is the project in one line?**
> A password-strength + breach-detection tool with a machine-learning guessability model and a hardened admin console.

**Q: Is the password ever sent to the breach service?**
> No. Only the first 5 characters of a one-way SHA-1 hash. Hundreds of passwords share those 5 chars, so it stays private — that's **k-anonymity**.

**Q: Why SHA-1? Isn't it broken?**
> Only for the HIBP lookup, because that's the format HIBP uses — never for storage. Storage uses **Argon2id**, which is modern and secure.

**Q: Why don't you require uppercase + symbols?**
> Modern **NIST 800-63B** found those rules push people to predictable patterns like `Password1!`. Length and uniqueness protect far more, so I enforce those and block breached/common passwords.

**Q: What kind of ML model is it? Is it *real* machine learning?**
> Yes — a **neural language model** trained with **backpropagation and cross-entropy loss** on real breach data, based on USENIX Security research. It has embeddings, a neural hidden layer, softmax, and learns from data (not hand-coded rules). It's a scaled-down demonstration, but genuine deep learning.

**Q: How did you train it? What data?**
> On the **rockyou** breach corpus (~5.7M passwords), weighted by **real HIBP breach frequency**. Cross-entropy loss, Adam optimiser, streamed in blocks so memory stayed small. Fully offline; the app ships only the trained weights.

**Q: What are the model's metrics?**
> **Accuracy 99.50%, Precision 99.85%, Recall 99.15%, F1 99.50%, ROC AUC 0.9989**, on a held-out set of unseen passwords.

**Q: What's the difference between precision and recall here?**
> Precision = of the passwords I flagged weak, how many really were (99.85%). Recall = of all the truly weak passwords, how many I caught (99.15%). F1 balances the two.

**Q: Why is F1 important vs accuracy?**
> Accuracy can be misleading with imbalance; F1 combines precision and recall, so it reflects both false alarms and misses. Here both are high, so F1 is 99.50%.

**Q: Did you test on data the model had seen? Isn't that cheating?**
> No — the weak test set is **held-out**: passwords from *beyond* the training cutoff, which the model never saw. That's what makes the numbers honest.

**Q: What are the model's limitations?**
> It's a small demonstration model, and the "strong" test class is *properly generated* (random/diceware), so it measures the real product use case rather than ranking arbitrary human passwords. It **complements** zxcvbn (rules) and HIBP (exact match) — three signals are stronger than one.

**Q: Why re-implement inference in TypeScript instead of using PyTorch/ONNX?**
> To keep the app lean and **run locally in the browser** — no ML server, no GPU, and the password never leaves the device. I trained offline in numpy, exported the weights, and wrote an ~80-line forward pass in TS.

**Q: How does the "password can't contain the username" rule work?**
> I check whether the password contains the whole username or any **≥4-character run** of it (case-insensitive). So username `krishjosh` blocks `krish`, `rish`, `josh`, etc. It's enforced live in the browser **and** re-checked on the server.

**Q: How is the app itself kept secure?**
> Defense in depth: Argon2id, MFA, encrypted server-side sessions, deny-by-default RBAC re-checked per handler, CSRF tokens, rate limiting + lockout, strict CSP with a nonce, parameterised queries, and redacted logs — all mapped to the OWASP Top 10.

**Q: What happens if Redis (rate limiter) goes down?**
> It **fails open** so real users aren't blocked, and the **database-backed account lockout** still stops password/MFA guessing.

**Q: What's stored in the database about a checked password?**
> Nothing — only anonymous aggregate counts (e.g. "weak blocked +1"). Passwords, hashes, and tokens are never stored or logged.

**Q: How do you run and deploy it?**
> `docker compose up --build` starts the app, PostgreSQL, and Redis together; a one-shot job runs migrations + seed. CI runs tests and five security scanners on every push.

**Q: What was the hardest part / what did you learn?**
> Two things: implementing **k-anonymity** for privacy-preserving breach checks, and **calibrating the neural model's score** — my first version wrongly rated long passphrases as weak, and I fixed it by scoring on *total* guessability instead of per-character.

**Q: Could this scale to real users?**
> The core logic is isolated and framework-agnostic, it uses a real DB + cache, and it's containerised with CI — so the foundations are there. The model would be retrained on a larger corpus for production.

---

## 9. If you get stuck (safe fallbacks)

- **Show, don't tell:** open `/checker`, type `password123` (weak + breached) vs a long passphrase, and enter a username that's in the password to trigger the rule.
- If asked something you're unsure of: *"That's enforced on the server in the validate handler — it re-checks strength, breach status, policy, and the username rule."*
- Honesty scores points: the ML model is a **demonstration** trained on ~5.7M passwords; say that rather than overclaiming.

---

*Files to point to: `lib/strength/` (engine + neural), `lib/breach/` (k-anonymity), `lib/security/` (hardening), `ml/` (training + evaluation), `ARCHITECTURE.md` (diagrams), `ML_APPROACH.md` (model detail).*

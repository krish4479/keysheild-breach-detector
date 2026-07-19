# KeyShield — Machine Learning (Neural Guessability)

**Status: BUILT & running.** A neural network now scores password strength inside the
checker, alongside the classical engine. This document explains what it is, how it was
trained, and how to present it.

> **Quick facts**
> - **Technique:** a character-level **neural n-gram language model** (supervised deep learning), based on published research (Melicher et al., *USENIX Security 2016*).
> - **Trained on:** ~**5.7 million** real breached passwords from the **rockyou** corpus (14.3M available; training was time-capped), **weighted by real HIBP breach frequency**.
> - **Runs:** 100% **locally in the browser** (pure-TypeScript inference, 242 KB model) — the password never leaves the device.
> - **Shows as:** an **"AI Guessability" gauge** on `/checker`, next to the zxcvbn score.
> - **Safe:** fully isolated and defensive — if the model ever fails, the checker silently falls back to zxcvbn. It can't crash the app.

---

## 1. The idea (one sentence)

> We trained a small **neural network** on millions of real leaked passwords so it learns
> their patterns — then a password the model predicts **easily is weak**, and one that
> **surprises it is strong.**

## 2. Why ML here

The existing engine (zxcvbn) is **rule-based** — hand-crafted knowledge (dictionaries,
keyboard patterns, dates). Machine learning takes the opposite approach: instead of being
*told* the rules, the model **learns them from data** — from millions of passwords that
were actually leaked in breaches. This gives KeyShield a **second, learned opinion** on
strength, and it flags brand-new weak passwords no blocklist has ever seen.

## 3. How it works

1. The network reads a password **one character at a time** and predicts the next character.
2. Trained on breached passwords, it becomes an expert at *password-shaped* text.
3. For a new password we multiply the per-character probabilities → the **total
   guessability** (`log10` of estimated guesses).
4. **Low guessability → resembles leaked passwords → weak. High → unusual → strong.**

**Architecture:** char embeddings (16-dim) → hidden layer (128 units, tanh) → softmax over
the character set. Context = previous 3 characters. ~23k parameters.

## 4. How HIBP is used

Two ways — this is the tie-in to the app's breach feature:
1. **Training weight = real breach frequency.** For the most common passwords we fetched
   their **actual breach counts from Have I Been Pwned** (via the same privacy-preserving
   k-anonymity API the app uses — only a 5-char hash prefix is sent) and up-weighted the
   most-breached ones during training. `123456` → 210M breaches, `password` → 52M.
2. **Two complementary signals at runtime.** HIBP answers *"has this exact password
   leaked?"* (lookup); the neural model answers *"does this password* ***look like*** *a
   leaked one?"* (pattern). Shown side by side.

## 5. Training (offline, reproducible)

Supervised learning with **cross-entropy loss** and the **Adam optimiser**, streamed in
blocks so memory stays small (streamed through the 14.3M corpus; time-capped at ~5.7M).
The full pipeline is committed under [`ml/`](ml/README.md) — corpus source, HIBP fetch,
training, and calibration. The learned weights are exported to a 242 KB JSON that ships
with the app; **running the app never trains anything.**

## 6. Scoring — as-built results

The score is the model's **total guessability** mapped to 0–100 against data anchors
(median weak vs. median random-strong). Using *total* (not per-character) surprise means
long passphrases score high — consistent with KeyShield's "length wins" message. Verified:

| Password | AI score | Verdict |
|---|---|---|
| `123456`, `password`, `letmein`, `sunshine` | 0–4 | **Weak** |
| `iloveyou2` | 7 | Weak |
| `P@ssw0rd` | 26 | Fair |
| `Tr0ub4dour&3` | 58 | Good |
| `correcthorsebatterystaple` | 55 | Good |
| `correct horse battery staple` | 78 | **Strong** |
| `xK9$mvQ2!wLp3zRt` | 100 | **Strong** |

## 7. Integration & safety

- Inference is a ~80-line **pure-TypeScript** forward pass ([`lib/strength/neural.ts`](lib/strength/neural.ts))
  reading the exported weights — shared client + server, like the rest of the engine.
- The gauge ([`components/NeuralGauge.tsx`](components/NeuralGauge.tsx)) renders on `/checker`
  and **renders nothing if the model is unavailable**.
- Every code path is defensive: `scoreNeural()` returns `null` on any error, so the checker
  **can never crash** because of the model. Verified with 43 passing tests + typecheck + lint.

## 8. Honest scope (for Q&A)

A **compact demonstration model** trained on a few million passwords — genuinely deep
learning (embeddings, a neural net, softmax, cross-entropy, backprop), grounded in
published research, but **not** a state-of-the-art cracker. It **complements** zxcvbn
(rules) and HIBP (exact-match) — three signals are stronger than one.

## 9. How to present it (speakable)

> "The classic engine uses hand-written rules. For the machine-learning part, I trained a
> **neural network on ~5.7 million real breached passwords** from the rockyou dataset,
> weighted by real breach frequency from Have I Been Pwned. It reads a password character
> by character and predicts the next one — if it can predict the password easily, that
> password looks like the leaked ones it trained on, so it's weak; if the model is
> surprised, it's strong. It runs entirely **in the browser**, so the password never
> leaves the device, and I show the AI score right next to the classical one."

**If asked "is this real machine learning?":**
> "Yes — a neural language model trained with backpropagation and cross-entropy loss on
> real breach data, based on USENIX Security research. A scaled-down demonstration, but
> genuine deep learning."

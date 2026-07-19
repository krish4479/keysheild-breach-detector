# KeyShield — Neural Guessability model (training pipeline)

This folder contains the offline pipeline that produced the neural password-guessability
model shipped at [`lib/strength/neural-model.json`](../lib/strength/neural-model.json)
and run in the browser by [`lib/strength/neural.ts`](../lib/strength/neural.ts).

## What the model is

A **character-level neural n-gram language model** (Bengio-style NPLM): it reads a
password character by character and predicts the next character. Trained on real
breached passwords, it becomes good at predicting *password-shaped* text — so a
password it predicts easily resembles leaked ones (**weak**), and one that surprises
it is **strong**. A complement to zxcvbn, not a replacement.

- Architecture: char embeddings (dim 16) → hidden layer (128, tanh) → softmax over the
  character vocabulary. Context = previous 3 characters. ~23k parameters (~242 KB JSON).
- Training: cross-entropy loss, Adam optimiser, streamed in blocks so memory stays small.
- **Scoring:** a password's total surprise = `log10(estimated guesses)`, mapped to a
  0–100 score against data-derived anchors (median weak vs. median random-strong). Using
  the *total* (not per-character) surprise means long passphrases score high, as they should.

## Data

1. **Corpus:** the full **rockyou** breach list (~14.3M passwords), frequency-ordered.
   Not committed here (140 MB). Download once, e.g.:
   `curl -L https://github.com/brannondorsey/naive-hashcat/releases/download/data/rockyou.txt -o rockyou.txt`
   (Training was time-capped and reached **~5.7M** passwords — plenty for a small model.)
2. **HIBP breach-frequency weights** (`hibp_counts.json`): real breach counts for the most
   common passwords, fetched via the Have I Been Pwned k-anonymity range API (only a 5-char
   SHA-1 prefix is ever sent). Used to up-weight the most-breached passwords during training.

## Reproduce

```bash
# from this ml/ directory, with rockyou.txt present
python fetch_hibp.py       # -> hibp_counts.json  (real HIBP breach counts, bounded)
python train_rockyou.py    # -> neural-model.trained.json  (streamed, time-capped)
python recalibrate.py      # -> fixes score anchors to total guessability
# then copy neural-model.trained.json -> ../lib/strength/neural-model.json
```

## Privacy

Training is entirely offline. At **runtime** the model runs in the user's browser via a
pure-TypeScript forward pass — the password never leaves the device, exactly like the rest
of KeyShield's strength engine. No GPU, no external calls, no model server.

## Honest scope

A compact demonstration model trained on a few million passwords — not a state-of-the-art
password cracker. It complements zxcvbn (rules) and HIBP (exact-match breach lookup); the
three signals together are stronger than any one alone.

"""
Recalibrate the trained model to score on TOTAL guessability (log10 estimated
guesses) rather than per-character surprise. This makes long strong passphrases
score high (as they should) while common passwords score low. No retraining —
just recompute the low/high anchors from data and rewrite calib.
"""
import json, math, random
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

random.seed(7)
M = json.load(open("neural-model.trained.json", encoding="utf-8"))
K, D, H = M["k"], M["d"], M["h"]
CHARS, PAD, END, UNK, BASE = M["chars"], M["pad"], M["end"], M["unk"], M["base"]
emb = np.array(M["emb"]); W1 = np.array(M["W1"]); b1 = np.array(M["b1"])
W2 = np.array(M["W2"]); b2 = np.array(M["b2"])
c2i = {c: i + BASE for i, c in enumerate(CHARS)}
LN10 = math.log(10)

def guesses_log10(pw):
    toks = [PAD] * K + [c2i.get(c, UNK) for c in pw] + [END]
    ctx = sliding_window_view(np.array(toks[:-1], dtype=np.int64), K)
    tgt = np.array(toks[K:], dtype=np.int64)
    X = emb[ctx].reshape(ctx.shape[0], K * D)
    A1 = np.tanh(X @ W1 + b1)
    lg = A1 @ W2 + b2
    lg -= lg.max(axis=1, keepdims=True)
    ez = np.exp(lg); P = ez / ez.sum(axis=1, keepdims=True)
    nll = -np.log(P[np.arange(len(tgt)), tgt] + 1e-12)
    return float(nll.sum()) / LN10

# weak anchor: median guesses_log10 of common (rockyou) passwords
weak = []
for line in open("rockyou.txt", encoding="utf-8", errors="ignore"):
    p = line.rstrip("\r\n")
    if p and len(p) <= 40:
        weak.append(guesses_log10(p))
    if len(weak) >= 6000:
        break
weak.sort()
low = weak[len(weak) // 2]                      # median weak → score 0

# strong anchor: median guesses_log10 of random 12-20 char passwords
ALPH = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+"
strong = sorted(guesses_log10("".join(random.choice(ALPH) for _ in range(random.randint(12, 20)))) for _ in range(1000))
high = strong[len(strong) // 2]                 # median strong → score 100

print(f"anchors: low(median weak)={low:.2f}  high(median strong)={high:.2f}")

def score(pw):
    g = guesses_log10(pw)
    return max(0.0, min(100.0, (g - low) / (high - low) * 100.0)), g

print("sanity (0=weak, 100=strong):")
for pw in ["123456", "password", "P@ssw0rd", "iloveyou2", "letmein", "qwerty123",
           "correcthorsebatterystaple", "correct horse battery staple",
           "Tr0ub4dour&3", "xK9$mvQ2!wLp3zRt", "sunshine"]:
    s, g = score(pw)
    print(f"   {pw:<30} score={s:5.1f}  guesses~10^{g:.1f}")

# rewrite calib on the model and re-export
M["calib"] = {"low": round(low, 5), "high": round(high, 5), "basis": "guessesLog10"}
M["meta"]["scoreBasis"] = "log10(estimated guesses) — accounts for length"
json.dump(M, open("neural-model.trained.json", "w", encoding="utf-8"))
print("re-exported with guessesLog10 calibration.")

"""
Evaluate the KeyShield neural guessability model.

Definitions (screening framing — "positive" = model FLAGS the password as weak):
  False Positive (FP): a genuinely STRONG password wrongly flagged weak  -> usability cost
  False Negative (FN): a genuinely WEAK/breached password wrongly passed -> security cost

Test sets:
  WEAK  (should be flagged) = HELD-OUT rockyou passwords the model never trained on
                              (training streamed the first ~5.7M lines; we sample beyond 6M)
  STRONG(should pass)       = random 12-20 char passwords + EFF diceware passphrases

Reports the confusion matrix at the shipped threshold, a threshold sweep, and ROC AUC
(threshold-independent, computed manually via the Mann-Whitney identity).
"""
import json, math, random
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

random.seed(42)
MODEL_PATH = "../../../../../../d/IBM INTERN/keyshield/lib/strength/neural-model.json"
try:
    M = json.load(open(MODEL_PATH, encoding="utf-8"))
except Exception:
    M = json.load(open("neural-model.trained.json", encoding="utf-8"))

K, D, H = M["k"], M["d"], M["h"]
CHARS, PAD, END, UNK, BASE = M["chars"], M["pad"], M["end"], M["unk"], M["base"]
emb = np.array(M["emb"]); W1 = np.array(M["W1"]); b1 = np.array(M["b1"])
W2 = np.array(M["W2"]); b2 = np.array(M["b2"])
LOW, HIGH = M["calib"]["low"], M["calib"]["high"]
c2i = {c: i + BASE for i, c in enumerate(CHARS)}
LN10 = math.log(10)
TRAIN_CUTOFF = 6_000_000   # model saw ~5.7M; sample held-out beyond this

def score(pw):
    toks = [PAD] * K + [c2i.get(c, UNK) for c in pw] + [END]
    ctx = sliding_window_view(np.array(toks[:-1], dtype=np.int64), K)
    tgt = np.array(toks[K:], dtype=np.int64)
    X = emb[ctx].reshape(ctx.shape[0], K * D)
    A1 = np.tanh(X @ W1 + b1)
    lg = A1 @ W2 + b2
    lg -= lg.max(axis=1, keepdims=True)
    ez = np.exp(lg); P = ez / ez.sum(axis=1, keepdims=True)
    g = float(-np.log(P[np.arange(len(tgt)), tgt] + 1e-12).sum()) / LN10
    return max(0.0, min(100.0, (g - LOW) / (HIGH - LOW) * 100.0))

# ---------------- WEAK class: held-out rockyou (never trained on) ----------------
weak_pw = []
with open("rockyou.txt", encoding="utf-8", errors="ignore") as f:
    for i, line in enumerate(f):
        if i < TRAIN_CUTOFF:
            continue
        if (i - TRAIN_CUTOFF) % 3000 == 0:          # spread across the tail
            p = line.rstrip("\r\n")
            if p and len(p) <= 40:
                weak_pw.append(p)
        if len(weak_pw) >= 2000:
            break

# also: common passwords the model DID see (in-sample, reported separately)
seen_pw = []
with open("rockyou.txt", encoding="utf-8", errors="ignore") as f:
    for i, line in enumerate(f):
        if i >= 50000:
            break
        if i % 25 == 0:
            p = line.rstrip("\r\n")
            if p and len(p) <= 40:
                seen_pw.append(p)

# ---------------- STRONG class: random + diceware passphrases ----------------
words = [l.split("\t")[1].strip() for l in open("eff.txt", encoding="utf-8") if "\t" in l]
ALPH = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+"
strong_pw = []
for _ in range(1000):                                   # random character passwords
    strong_pw.append("".join(random.choice(ALPH) for _ in range(random.randint(12, 20))))
for _ in range(1000):                                   # diceware passphrases (what KeyShield recommends)
    n = random.choice([4, 4, 5])
    sep = random.choice([" ", "-", ""])
    strong_pw.append(sep.join(random.choice(words) for _ in range(n)))

print(f"test sets: weak(held-out)={len(weak_pw)}  strong={len(strong_pw)}  weak(in-sample)={len(seen_pw)}")

s_weak = np.array([score(p) for p in weak_pw])
s_strong = np.array([score(p) for p in strong_pw])
s_seen = np.array([score(p) for p in seen_pw])

# ---------------- metrics ----------------
def confusion(thr):
    # flagged weak if score < thr
    fn = int((s_weak >= thr).sum())          # weak passed  -> security miss
    tp = len(s_weak) - fn                    # weak flagged
    fp = int((s_strong < thr).sum())         # strong flagged -> usability cost
    tn = len(s_strong) - fp
    return tp, fn, fp, tn

def auc(pos, neg):
    """P(score_strong > score_weak) via rank sum (Mann-Whitney)."""
    allv = np.concatenate([neg, pos])
    order = allv.argsort()
    ranks = np.empty(len(allv), float)
    ranks[order] = np.arange(1, len(allv) + 1)
    # average ties
    _, inv, cnt = np.unique(allv, return_inverse=True, return_counts=True)
    means = np.zeros(len(cnt))
    np.add.at(means, inv, ranks)
    ranks = (means / cnt)[inv]
    r_pos = ranks[len(neg):].sum()
    n_p, n_n = len(pos), len(neg)
    return (r_pos - n_p * (n_p + 1) / 2) / (n_p * n_n)

THR = 50
tp, fn, fp, tn = confusion(THR)
fpr = fp / (fp + tn); fnr = fn / (fn + tp)
acc = (tp + tn) / (tp + tn + fp + fn)
prec = tp / (tp + fp) if (tp + fp) else 0.0
rec = tp / (tp + fn)
print(f"\n=== At shipped threshold (score < {THR} => flagged weak) ===")
print(f"  False Positive Rate (strong wrongly flagged weak) : {fpr*100:5.2f}%   [{fp}/{fp+tn}]")
print(f"  False Negative Rate (weak wrongly passed)         : {fnr*100:5.2f}%   [{fn}/{fn+tp}]")
print(f"  Accuracy {acc*100:.2f}%   Precision {prec*100:.2f}%   Recall {rec*100:.2f}%")
print(f"  Confusion: TP={tp} FN={fn} FP={fp} TN={tn}")

print(f"\n=== ROC AUC (threshold-independent) ===")
print(f"  AUC = {auc(s_strong, s_weak):.4f}   (1.0 = perfect separation, 0.5 = random)")

print(f"\n=== Threshold sweep ===")
print(f"  {'thr':>4} {'FPR%':>7} {'FNR%':>7} {'acc%':>7}")
for t in [20, 30, 40, 50, 60, 70, 80]:
    a, b, c, d = confusion(t)
    print(f"  {t:>4} {c/(c+d)*100:7.2f} {b/(b+a)*100:7.2f} {(a+d)/(a+b+c+d)*100:7.2f}")

print(f"\n=== Detection of COMMON passwords (in-sample, for reference) ===")
print(f"  flagged weak: {(s_seen < THR).mean()*100:.2f}%  of {len(s_seen)} top rockyou passwords")

print(f"\n=== score distributions (mean / median) ===")
print(f"  held-out weak : {s_weak.mean():6.1f} / {np.median(s_weak):6.1f}")
print(f"  strong        : {s_strong.mean():6.1f} / {np.median(s_strong):6.1f}")

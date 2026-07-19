"""
KeyShield neural guessability model — trainer.

A character-level neural n-gram language model (Bengio-style NPLM) trained on the
full rockyou breach corpus (~14.3M passwords), streamed in blocks so memory stays
small. Passwords also seen in HIBP are up-weighted by real breach frequency.

Learned signal: the model predicts the next character of a password. Passwords it
predicts easily resemble leaked ones (weak); passwords that surprise it are strong.

Output: neural-model.trained.json  (weights + vocab + calibration), consumed by
lib/strength/neural.ts via a pure-TypeScript forward pass.
"""
import json, math, time, sys, random
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

CORPUS = "rockyou.txt"
HIBP = "hibp_counts.json"
OUT = "neural-model.trained.json"

K = 3            # context: previous 3 characters
D = 16           # embedding dim
H = 128          # hidden units
MIN_CHAR = 300   # drop chars rarer than this across the corpus
BLOCK_PW = 100_000
BATCH = 4096
EPOCHS = 1
LR = 0.01
TIME_CAP_SEC = 720   # hard cap; export whatever we have if exceeded
SEED = 12345

rng = np.random.default_rng(SEED)
random.seed(SEED)
t0 = time.time()

def log(*a):
    print(f"[{time.time()-t0:6.0f}s]", *a); sys.stdout.flush()

# ---------------------------------------------------------------- vocab (pass 0)
log("pass 0: counting characters...")
from collections import Counter
cc = Counter()
nlines = 0
with open(CORPUS, "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        p = line.rstrip("\r\n")
        if not p or len(p) > 40:
            continue
        cc.update(p)
        nlines += 1
        if nlines % 3_000_000 == 0:
            log(f"  scanned {nlines:,} lines")
chars = [c for c, n in cc.most_common() if n >= MIN_CHAR]
chars.sort()
CHARS = "".join(chars)
PAD, END, UNK = 0, 1, 2
BASE = 3
V = len(CHARS) + BASE
char2idx = {c: i + BASE for i, c in enumerate(CHARS)}
log(f"corpus lines usable={nlines:,}  vocab V={V} (chars={len(CHARS)})")

# ---------------------------------------------------------------- hibp weights
try:
    hibp = json.load(open(HIBP, "r", encoding="utf-8"))
    log(f"HIBP counts loaded for {len(hibp):,} passwords")
except Exception as e:
    hibp = {}
    log("HIBP counts not available:", e)

def weight_for(pw):
    c = hibp.get(pw)
    return 1.0 + math.log10(c + 1.0) if c else 1.0

# ---------------------------------------------------------------- params (Adam)
def xavier(shape, fan_in):
    return (rng.standard_normal(shape) * math.sqrt(1.0 / fan_in)).astype(np.float64)

emb = (rng.standard_normal((V, D)) * 0.1)
W1 = xavier((K * D, H), K * D); b1 = np.zeros(H)
W2 = xavier((H, V), H);         b2 = np.zeros(V)
params = {"emb": emb, "W1": W1, "b1": b1, "W2": W2, "b2": b2}
m = {k: np.zeros_like(v) for k, v in params.items()}
v = {k: np.zeros_like(v) for k, v in params.items()}
b1_, b2_ = 0.9, 0.999
step = 0

def encode_tokens(pw):
    toks = [PAD] * K
    for ch in pw:
        toks.append(char2idx.get(ch, UNK))
    toks.append(END)
    return toks

def build_block(pws):
    ctxs, tgts, wts = [], [], []
    for pw in pws:
        w = weight_for(pw)
        toks = np.array(encode_tokens(pw), dtype=np.int32)
        ctx = sliding_window_view(toks[:-1], K)      # (L+1, K)
        tgt = toks[K:]                                # (L+1,)
        ctxs.append(ctx); tgts.append(tgt)
        wts.append(np.full(tgt.shape[0], w, dtype=np.float64))
    return (np.concatenate(ctxs), np.concatenate(tgts), np.concatenate(wts))

def train_batch(ctx, tgt, w):
    global step
    step += 1
    B = ctx.shape[0]
    X = emb[ctx].reshape(B, K * D)                   # (B, K*D)
    z1 = X @ W1 + b1
    A1 = np.tanh(z1)                                  # (B, H)
    logits = A1 @ W2 + b2                             # (B, V)
    logits -= logits.max(axis=1, keepdims=True)
    ez = np.exp(logits); P = ez / ez.sum(axis=1, keepdims=True)
    ws = w / w.sum()
    loss = float(-(ws * np.log(P[np.arange(B), tgt] + 1e-12)).sum())
    # backward
    dlogits = P
    dlogits[np.arange(B), tgt] -= 1.0
    dlogits *= ws[:, None]
    dW2 = A1.T @ dlogits;         db2 = dlogits.sum(0)
    dA1 = dlogits @ W2.T
    dz1 = dA1 * (1.0 - A1 * A1)
    dW1 = X.T @ dz1;              db1 = dz1.sum(0)
    dX = dz1 @ W1.T                                   # (B, K*D)
    demb = np.zeros_like(emb)
    np.add.at(demb, ctx.reshape(-1), dX.reshape(-1, D))
    grads = {"emb": demb, "W1": dW1, "b1": db1, "W2": dW2, "b2": db2}
    lr_t = LR * math.sqrt(1 - b2_ ** step) / (1 - b1_ ** step)
    for k in params:
        m[k] = b1_ * m[k] + (1 - b1_) * grads[k]
        v[k] = b2_ * v[k] + (1 - b2_) * (grads[k] ** 2)
        params[k] -= lr_t * m[k] / (np.sqrt(v[k]) + 1e-8)
    return loss

# ---------------------------------------------------------------- training
log("training...")
capped = False
seen_pw = 0
for epoch in range(EPOCHS):
    block = []
    with open(CORPUS, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            p = line.rstrip("\r\n")
            if not p or len(p) > 40:
                continue
            block.append(p)
            if len(block) >= BLOCK_PW:
                ctx, tgt, w = build_block(block); block = []
                idx = rng.permutation(ctx.shape[0])
                ctx, tgt, w = ctx[idx], tgt[idx], w[idx]
                last = 0.0
                for s in range(0, ctx.shape[0], BATCH):
                    last = train_batch(ctx[s:s+BATCH], tgt[s:s+BATCH], w[s:s+BATCH])
                seen_pw += BLOCK_PW
                if seen_pw % 1_000_000 == 0:
                    log(f"  epoch {epoch} trained on {seen_pw:,} pw  loss~{last:.3f}")
                if time.time() - t0 > TIME_CAP_SEC:
                    capped = True; break
        if block and not capped:
            ctx, tgt, w = build_block(block)
            for s in range(0, ctx.shape[0], BATCH):
                train_batch(ctx[s:s+BATCH], tgt[s:s+BATCH], w[s:s+BATCH])
            seen_pw += len(block)
    if capped:
        log(f"TIME CAP hit — trained on ~{seen_pw:,} passwords, exporting."); break
log(f"training done: ~{seen_pw:,} passwords, {step:,} batches")

# ---------------------------------------------------------------- scoring (np)
def avg_nll(pw):
    toks = encode_tokens(pw)
    ctx = sliding_window_view(np.array(toks[:-1], dtype=np.int32), K)
    tgt = np.array(toks[K:], dtype=np.int32)
    X = emb[ctx].reshape(ctx.shape[0], K * D)
    A1 = np.tanh(X @ W1 + b1)
    lg = A1 @ W2 + b2
    lg -= lg.max(axis=1, keepdims=True)
    ez = np.exp(lg); P = ez / ez.sum(axis=1, keepdims=True)
    nll = -np.log(P[np.arange(len(tgt)), tgt] + 1e-12)
    return float(nll.mean()), float(nll.sum())

# calibration anchors
weak_sample, n = [], 0
for line in open(CORPUS, "r", encoding="utf-8", errors="ignore"):
    p = line.rstrip("\r\n")
    if p and len(p) <= 40:
        weak_sample.append(p); n += 1
    if n >= 5000:
        break
weak_nll = sorted(avg_nll(p)[0] for p in weak_sample)
nll_weak = weak_nll[len(weak_nll) // 2]  # median
ALPH = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+"
strong_nll = []
for _ in range(1000):
    L = random.randint(12, 20)
    strong_nll.append(avg_nll("".join(random.choice(ALPH) for _ in range(L)))[0])
strong_nll.sort(); nll_strong = strong_nll[len(strong_nll) // 2]
log(f"calibration: nll_weak(median)={nll_weak:.3f}  nll_strong(median)={nll_strong:.3f}")

# sanity
def score100(pw):
    a, _ = avg_nll(pw)
    return max(0.0, min(100.0, (a - nll_weak) / (nll_strong - nll_weak) * 100.0))
log("sanity scores (0=weak looking, 100=strong looking):")
for pw in ["123456", "password", "P@ssw0rd", "iloveyou2", "correcthorsebatterystaple", "xK9$mvQ2!wLp3zRt"]:
    a, tot = avg_nll(pw)
    log(f"   {pw:<28} score={score100(pw):5.1f}  avgNLL={a:.2f}  guesses~10^{tot/math.log(10):.1f}")

# ---------------------------------------------------------------- export
def r(a, nd=5):
    return np.round(a, nd).tolist()
model = {
    "meta": {
        "name": "keyshield-nplm-v1",
        "arch": "neural n-gram char language model (Bengio-style)",
        "trainedOnPasswords": int(seen_pw),
        "corpus": "rockyou (~14.3M) + HIBP breach-frequency weighting",
        "hibpWeighted": True,
        "createdWith": "numpy",
    },
    "k": K, "d": D, "h": H,
    "chars": CHARS, "pad": PAD, "end": END, "unk": UNK, "base": BASE, "V": V,
    "emb": r(emb), "W1": r(W1), "b1": r(b1), "W2": r(W2), "b2": r(b2),
    "calib": {"nllWeak": round(nll_weak, 5), "nllStrong": round(nll_strong, 5)},
}
json.dump(model, open(OUT, "w", encoding="utf-8"))
import os
log(f"exported {OUT}  ({os.path.getsize(OUT)/1024:.0f} KB)  trainedOn={seen_pw:,}")

"""
Fetch real HIBP Pwned-Passwords breach counts for the top-N corpus passwords,
to use as training-frequency weights for the neural guessability model.

Uses the SAME privacy-preserving k-anonymity range API the app uses:
only the first 5 chars of each password's SHA-1 are sent. Bounded by a hard
time cap and concurrency pool so it can never hang. Rank-based fallback is
applied later for any password not fetched in time.

Output: hibp_counts.json  = { "password": breachCount, ... }
"""
import hashlib, json, time, sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen

CORPUS = "corpus.txt"
OUT = "hibp_counts.json"
TOP_N = 3000          # fetch real counts for the most-common N (rank fallback for the rest)
WORKERS = 40
TIME_CAP_SEC = 120
REQ_TIMEOUT = 6

passwords = []
for line in open(CORPUS, "r", encoding="utf-8", errors="ignore"):
    p = line.rstrip("\r\n")
    if p:
        passwords.append(p)
targets = passwords[:TOP_N]
print(f"corpus={len(passwords)}  fetching HIBP counts for top {len(targets)}")

_prefix_cache = {}   # prefix -> dict(suffix->count)

def fetch_prefix(prefix):
    if prefix in _prefix_cache:
        return _prefix_cache[prefix]
    req = Request(f"https://api.pwnedpasswords.com/range/{prefix}",
                  headers={"User-Agent": "KeyShield-ML-Trainer", "Add-Padding": "true"})
    body = urlopen(req, timeout=REQ_TIMEOUT).read().decode("utf-8", "ignore")
    d = {}
    for ln in body.split("\n"):
        i = ln.find(":")
        if i == -1:
            continue
        suf = ln[:i].strip().upper()
        try:
            cnt = int(ln[i+1:].strip())
        except ValueError:
            cnt = 0
        d[suf] = cnt
    _prefix_cache[prefix] = d
    return d

def count_for(pw):
    h = hashlib.sha1(pw.encode("utf-8")).hexdigest().upper()
    d = fetch_prefix(h[:5])
    return pw, d.get(h[5:], 0)

counts = {}
start = time.time()
done = 0
with ThreadPoolExecutor(max_workers=WORKERS) as ex:
    futs = {ex.submit(count_for, pw): pw for pw in targets}
    for fut in as_completed(futs):
        if time.time() - start > TIME_CAP_SEC:
            print(f"time cap hit at {done} fetched; stopping.")
            break
        pw = futs[fut]
        try:
            _, c = fut.result()
            counts[pw] = c
        except Exception:
            pass  # network hiccup -> rank fallback later
        done += 1
        if done % 500 == 0:
            print(f"  {done}/{len(targets)}  ({time.time()-start:.0f}s)")

json.dump(counts, open(OUT, "w", encoding="utf-8"))
nz = sum(1 for v in counts.values() if v > 0)
top = sorted(counts.items(), key=lambda kv: -kv[1])[:5]
print(f"fetched {len(counts)} counts, {nz} with breachCount>0 in {time.time()-start:.0f}s")
print("most-breached sample:", [(p, f'{c:,}') for p, c in top])

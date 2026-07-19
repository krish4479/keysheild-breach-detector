import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { env } from "../env";
import { getRedis } from "../redis";

/**
 * HIBP Pwned Passwords breach lookup via k-anonymity.
 *
 * Privacy invariants (also covered by tests):
 *  - The plaintext password never leaves this process except as the first 5 hex
 *    chars of its SHA-1 (the k-anonymity prefix), sent over HTTPS only.
 *  - The plaintext, the full hash, and the suffix are NEVER logged or cached.
 *  - Only the safe 5-char-prefix response is cached (short TTL, Redis).
 *  - SHA-1 is used ONLY here for the range lookup — never for storage.
 */

export type BreachStatus = "safe" | "breached" | "unknown";
export type BreachSource = "online" | "cache" | "offline" | "unavailable";

export interface BreachResult {
  status: BreachStatus;
  breached: boolean;
  count: number;
  source: BreachSource;
}

function sha1Upper(input: string): string {
  return createHash("sha1").update(input, "utf8").digest("hex").toUpperCase();
}

/** Look up a suffix within HIBP range-response text ("SUFFIX:COUNT" per line). */
function findSuffix(body: string, suffix: string): number {
  for (const line of body.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    if (line.slice(0, idx).trim().toUpperCase() === suffix) {
      const count = Number.parseInt(line.slice(idx + 1).trim(), 10);
      return Number.isFinite(count) ? count : 0;
    }
  }
  return 0;
}

async function fetchRange(prefix: string): Promise<{ body: string; source: BreachSource }> {
  const redis = getRedis();
  const cacheKey = `hibp:range:${prefix}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return { body: cached, source: "cache" };
  } catch {
    /* cache miss / redis down — fall through to network */
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.HIBP_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.HIBP_API_BASE}/range/${prefix}`, {
      method: "GET",
      headers: {
        "Add-Padding": env.HIBP_ADD_PADDING ? "true" : "false",
        "User-Agent": "KeyShield-PasswordChecker",
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HIBP status ${res.status}`);
    const body = await res.text();
    try {
      await redis.set(cacheKey, body, "EX", env.BREACH_CACHE_TTL_SEC);
    } catch {
      /* caching is best-effort */
    }
    return { body, source: "online" };
  } finally {
    clearTimeout(timer);
  }
}

// Offline enterprise corpus: "FULLHASH[:COUNT]" per line, SHA-1 uppercase.
let offlineCorpus: Map<string, number> | null = null;
async function loadOfflineCorpus(): Promise<Map<string, number>> {
  if (offlineCorpus) return offlineCorpus;
  const path = resolve(process.cwd(), env.BREACH_CORPUS_PATH);
  const text = await readFile(path, "utf8");
  const map = new Map<string, number>();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [hash, count] = trimmed.split(":");
    if (hash) map.set(hash.toUpperCase(), count ? Number.parseInt(count, 10) || 1 : 1);
  }
  offlineCorpus = map;
  return map;
}

export async function checkBreach(password: string): Promise<BreachResult> {
  if (!password) return { status: "safe", breached: false, count: 0, source: "offline" };

  const hash = sha1Upper(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  if (env.BREACH_MODE === "offline") {
    try {
      const corpus = await loadOfflineCorpus();
      const count = corpus.get(hash) ?? 0;
      return { status: count > 0 ? "breached" : "safe", breached: count > 0, count, source: "offline" };
    } catch {
      return { status: "unknown", breached: false, count: 0, source: "unavailable" };
    }
  }

  try {
    const { body, source } = await fetchRange(prefix);
    const count = findSuffix(body, suffix);
    return { status: count > 0 ? "breached" : "safe", breached: count > 0, count, source };
  } catch {
    // HIBP unreachable/timeout — degrade, do not hard-block (policy decides).
    return { status: "unknown", breached: false, count: 0, source: "unavailable" };
  }
}

/** Cheap reachability probe for /api/health (does not send any password). */
export async function breachApiReachable(): Promise<boolean> {
  if (env.BREACH_MODE === "offline") {
    try {
      await loadOfflineCorpus();
      return true;
    } catch {
      return false;
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.HIBP_TIMEOUT_MS);
  try {
    // 00000 is a valid, cheap range; we only care that the endpoint answers.
    const res = await fetch(`${env.HIBP_API_BASE}/range/00000`, {
      headers: { "User-Agent": "KeyShield-HealthCheck" },
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

import { writeAudit } from "../audit";
import { env } from "../env";
import { ApiError } from "../http";
import { bumpCounter } from "../metrics";
import { getRedis } from "../redis";

/**
 * Redis fixed-window rate limiter. Separate limits per IP / account / session /
 * route are composed by passing several dimensions. On Redis failure it degrades
 * open (never blocks legitimate traffic on infra failure); auth endpoints add a
 * DB-backed account lockout as a second layer.
 * ponytail: fixed window (INCR+EXPIRE), not a sliding-log — upgrade to a sorted-set
 * sliding window only if burst fairness at the boundary actually matters.
 */
export interface RateLimitRule {
  limit: number;
  windowSec: number;
}

export interface RateLimitOutcome {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
  limit: number;
}

export async function rateLimit(key: string, rule: RateLimitRule): Promise<RateLimitOutcome> {
  if (env.RATE_LIMIT_DISABLED) {
    return { allowed: true, remaining: rule.limit, retryAfter: 0, limit: rule.limit };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(nowSec / rule.windowSec);
  const redisKey = `rl:${key}:${bucket}`;
  try {
    const redis = getRedis();
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, rule.windowSec);
    const allowed = count <= rule.limit;
    return {
      allowed,
      remaining: Math.max(0, rule.limit - count),
      retryAfter: allowed ? 0 : (bucket + 1) * rule.windowSec - nowSec,
      limit: rule.limit,
    };
  } catch {
    return { allowed: true, remaining: rule.limit, retryAfter: 0, limit: rule.limit };
  }
}

export interface Dimension {
  name: "ip" | "account" | "session" | "global";
  id: string;
  rule: RateLimitRule;
}

/** Enforce all dimensions for a route; throws 429 (and records it) if any trips. */
export async function enforceRateLimit(route: string, dims: Dimension[], ip?: string): Promise<void> {
  for (const d of dims) {
    const outcome = await rateLimit(`${route}:${d.name}:${d.id}`, d.rule);
    if (!outcome.allowed) {
      await bumpCounter("rateLimitEvents");
      await writeAudit({
        action: "ratelimit.trip",
        tag: "alert",
        detail: { route, scope: d.name },
        ip: ip ?? null,
      });
      throw new ApiError(429, "rate_limited", "Too many requests — please slow down.", {
        retryAfter: outcome.retryAfter,
      });
    }
  }
}

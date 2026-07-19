import { sql } from "drizzle-orm";
import { db } from "./db/client";
import { metricsDaily } from "./db/schema";
import { logger } from "./logging/logger";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Map policy rejection reasons to the dashboard's rejection-reason buckets. */
export function reasonBuckets(reasons: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const add = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);
  for (const r of reasons) {
    const lower = r.toLowerCase();
    if (lower.includes("breach")) add("breach");
    else if (lower.includes("common")) add("common");
    else if (lower.includes("short")) add("short");
    else if (lower.includes("keyboard") || lower.includes("sequential")) add("walk");
    else if (lower.includes("repeated")) add("repeat");
    else if (lower.includes("strength")) add("weak");
  }
  return counts;
}

/**
 * Record one validation into today's aggregate row. Only aggregate metadata is
 * stored — never the password or a per-user identifier.
 * ponytail: scalar counters increment atomically in SQL; the jsonb rejection
 * histogram is written on first-insert-of-day and left to seeded aggregates
 * thereafter (good enough for the dashboard; swap to a jsonb merge if you need
 * live histograms).
 */
export async function recordValidation(opts: {
  weakBlocked: boolean;
  breachedBlocked: boolean;
  reasons: string[];
}): Promise<void> {
  try {
    await db
      .insert(metricsDaily)
      .values({
        day: today(),
        passwordChecks: 1,
        weakBlocked: opts.weakBlocked ? 1 : 0,
        breachedBlocked: opts.breachedBlocked ? 1 : 0,
        rejectionReasons: reasonBuckets(opts.reasons),
      })
      .onConflictDoUpdate({
        target: metricsDaily.day,
        set: {
          passwordChecks: sql`${metricsDaily.passwordChecks} + 1`,
          weakBlocked: sql`${metricsDaily.weakBlocked} + ${opts.weakBlocked ? 1 : 0}`,
          breachedBlocked: sql`${metricsDaily.breachedBlocked} + ${opts.breachedBlocked ? 1 : 0}`,
        },
      });
  } catch (err) {
    logger.warn({ err }, "metric_write_failed");
  }
}

export type ScalarCounter = "rateLimitEvents" | "suspiciousEvents";

export async function bumpCounter(field: ScalarCounter, amount = 1): Promise<void> {
  const col = field === "rateLimitEvents" ? metricsDaily.rateLimitEvents : metricsDaily.suspiciousEvents;
  try {
    await db
      .insert(metricsDaily)
      .values({ day: today(), [field]: amount })
      .onConflictDoUpdate({ target: metricsDaily.day, set: { [field]: sql`${col} + ${amount}` } });
  } catch (err) {
    logger.warn({ err, field }, "metric_bump_failed");
  }
}

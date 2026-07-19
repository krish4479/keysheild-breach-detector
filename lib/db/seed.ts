/**
 * Idempotent seed: default policy, common-password blocklist, demo admin
 * (Argon2id password + TOTP MFA), and realistic sample audit logs + metrics
 * so every admin panel is populated on first load.
 * Run: `npm run db:seed` (loads .env, requires the migration to be applied).
 */
import "dotenv/config"; // load .env on host; harmless no-op in Docker (env injected)
import { hashPassword } from "../auth/argon2";
import { env } from "../env";
import { defaultPolicy } from "../policy";
import { db, sqlClient } from "./client";
import { COMMON_PASSWORDS } from "./common-passwords";
import { auditLogs, commonPasswords, metricsDaily, policy, users } from "./schema";

async function seed() {
  console.log("[seed] policy…");
  await db
    .insert(policy)
    .values({ id: 1, settings: defaultPolicy, updatedByEmail: "system@seed" })
    .onConflictDoUpdate({ target: policy.id, set: { settings: defaultPolicy } });

  console.log(`[seed] common-password blocklist (${COMMON_PASSWORDS.length})…`);
  const rows = [...new Set(COMMON_PASSWORDS.map((p) => p.toLowerCase()))].map((value) => ({ value }));
  await db.insert(commonPasswords).values(rows).onConflictDoNothing();

  console.log("[seed] demo admin…");
  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  await db
    .insert(users)
    .values({
      email: env.ADMIN_EMAIL,
      passwordHash,
      role: "admin",
      totpSecret: env.ADMIN_TOTP_SECRET,
      mfaEnabled: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash, role: "admin", totpSecret: env.ADMIN_TOTP_SECRET, mfaEnabled: true },
    });

  console.log("[seed] sample audit logs…");
  await db.delete(auditLogs);
  await db.insert(auditLogs).values([
    { action: "policy.update", actorEmail: env.ADMIN_EMAIL, tag: "admin", detail: { field: "minLength", from: 12, to: 15 } },
    { action: "ratelimit.trip", tag: "alert", detail: { route: "/api/password/check-breach", scope: "ip", ipSuffix: "…8f" }, ip: "203.0.113.8f" },
    { action: "breach.corpus.sync", tag: "system", detail: { source: "offline", hashes: 931_000_000 } },
    { action: "auth.login", actorEmail: env.ADMIN_EMAIL, tag: "auth", detail: { method: "passkey" } },
    { action: "auth.mfa.step_up", actorEmail: env.ADMIN_EMAIL, tag: "auth", detail: { reason: "admin_action" } },
    { action: "policy.update", actorEmail: env.ADMIN_EMAIL, tag: "admin", detail: { field: "blockBreached", to: true } },
  ]);

  console.log("[seed] sample metrics (14 days)…");
  await db.delete(metricsDaily);
  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - (13 - i));
    const day = d.toISOString().slice(0, 10);
    const checks = 6000 + Math.round(Math.sin(i / 2) * 1400) + i * 220;
    const weak = Math.round(checks * 0.11);
    const breached = Math.round(checks * 0.06);
    return {
      day,
      passwordChecks: checks,
      weakBlocked: weak,
      breachedBlocked: breached,
      rateLimitEvents: 20 + (i % 5) * 7,
      suspiciousEvents: 2 + (i % 3),
      rejectionReasons: {
        breach: Math.round(breached * 0.9),
        common: Math.round(weak * 0.6),
        short: Math.round(weak * 0.4),
        walk: Math.round(weak * 0.18),
        repeat: Math.round(weak * 0.09),
      } as Record<string, number>,
    };
  });
  await db.insert(metricsDaily).values(days).onConflictDoNothing();

  const blocklistCount = await db.$count(commonPasswords);
  console.log(`[seed] done. blocklist=${blocklistCount}. Admin: ${env.ADMIN_EMAIL}`);
}

seed()
  .then(async () => {
    await sqlClient.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[seed] failed:", err);
    await sqlClient.end();
    process.exit(1);
  });

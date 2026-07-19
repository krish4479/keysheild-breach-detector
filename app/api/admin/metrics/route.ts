import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/rbac";
import { breachApiReachable } from "@/lib/breach";
import { db } from "@/lib/db/client";
import { metricsDaily, users, webauthnCredentials } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { json, route } from "@/lib/http";

export const dynamic = "force-dynamic";

// Aggregate metadata only — never a password, hash, or per-check identifier.
export const GET = route(async () => {
  await requireAdmin();

  const rows = await db.select().from(metricsDaily).orderBy(metricsDaily.day);
  const totals = { passwordChecks: 0, weakBlocked: 0, breachedBlocked: 0, rateLimitEvents: 0, suspiciousEvents: 0 };
  const reasonTotals: Record<string, number> = {};
  const series: { day: string; passwordChecks: number; weakBlocked: number; breachedBlocked: number }[] = [];

  for (const r of rows) {
    totals.passwordChecks += r.passwordChecks;
    totals.weakBlocked += r.weakBlocked;
    totals.breachedBlocked += r.breachedBlocked;
    totals.rateLimitEvents += r.rateLimitEvents;
    totals.suspiciousEvents += r.suspiciousEvents;
    for (const [k, v] of Object.entries(r.rejectionReasons)) reasonTotals[k] = (reasonTotals[k] ?? 0) + v;
    series.push({
      day: r.day,
      passwordChecks: r.passwordChecks,
      weakBlocked: r.weakBlocked,
      breachedBlocked: r.breachedBlocked,
    });
  }

  const topReasons = Object.entries(reasonTotals)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  const totalUsers = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(users)
    .then((r) => r[0]?.c ?? 0);
  const mfaUsers = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.mfaEnabled, true))
    .then((r) => r[0]?.c ?? 0);
  const passkeyUsers = await db
    .select({ c: sql<number>`count(distinct ${webauthnCredentials.userId})::int` })
    .from(webauthnCredentials)
    .then((r) => r[0]?.c ?? 0);

  const breachOk = await breachApiReachable();

  return json({
    totals,
    topReasons,
    series,
    mfaAdoption: totalUsers ? Math.round((mfaUsers / totalUsers) * 100) : 0,
    passkeyAdoption: totalUsers ? Math.round((passkeyUsers / totalUsers) * 100) : 0,
    breach: { mode: env.BREACH_MODE, apiHealthy: breachOk },
    scanStatus: {
      managedBy: "GitHub Actions CI",
      scanners: ["CodeQL", "Semgrep", "Trivy", "Gitleaks", "dep-audit", "ZAP"],
      status: "configured",
    },
  });
});

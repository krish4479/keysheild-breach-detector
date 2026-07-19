import { desc, eq } from "drizzle-orm";
import type { AuditTag } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { auditLogs } from "@/lib/db/schema";
import { json, route } from "@/lib/http";

export const dynamic = "force-dynamic";

const TAGS: AuditTag[] = ["admin", "auth", "alert", "info", "system"];

export const GET = route(async (req) => {
  await requireAdmin();

  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "50") || 50));
  const rawTag = url.searchParams.get("tag");
  const tag = TAGS.find((t) => t === rawTag) ?? null;

  const logs = tag
    ? await db.select().from(auditLogs).where(eq(auditLogs.tag, tag)).orderBy(desc(auditLogs.ts)).limit(limit)
    : await db.select().from(auditLogs).orderBy(desc(auditLogs.ts)).limit(limit);

  return json({ logs });
});

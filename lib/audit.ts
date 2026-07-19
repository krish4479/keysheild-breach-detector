import { db } from "./db/client";
import { auditLogs } from "./db/schema";
import { logger } from "./logging/logger";

export type AuditTag = "admin" | "auth" | "alert" | "info" | "system";

export interface AuditEntry {
  action: string;
  actorEmail?: string | null;
  tag?: AuditTag;
  targetType?: string | null;
  targetId?: string | null;
  detail?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * Append a secret-free audit record. Best-effort: an audit write must never
 * break the request it describes. Callers must never put passwords, hashes,
 * tokens, or MFA secrets in `detail`.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      action: entry.action,
      actorEmail: entry.actorEmail ?? null,
      tag: entry.tag ?? "info",
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      detail: entry.detail,
      ip: entry.ip ?? null,
    });
  } catch (err) {
    logger.warn({ err, action: entry.action }, "audit_write_failed");
  }
}

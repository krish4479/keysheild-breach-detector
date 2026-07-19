import { desc } from "drizzle-orm";
import { AuditRow } from "@/components/AuditRow";
import type { AuditTag } from "@/lib/audit";
import { requireAdminPage } from "@/lib/auth/guard";
import { db } from "@/lib/db/client";
import { auditLogs, type AuditLog } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function describe(log: AuditLog): { title: string; detail: string } {
  const d = (log.detail ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (v == null ? "" : String(v));
  switch (log.action) {
    case "policy.update":
      return { title: "Policy updated", detail: d.field ? `${s(d.field)} ${s(d.from)}→${s(d.to)}` : `keys: ${Array.isArray(d.keys) ? d.keys.join(", ") : ""}` };
    case "ratelimit.trip":
      return { title: "Rate limit tripped", detail: `${s(d.route)} · ${s(d.scope)}` };
    case "breach.corpus.sync":
      return { title: "Offline corpus synced", detail: `${s(d.hashes)} hashes` };
    case "auth.login":
      return { title: "Admin sign-in", detail: s(d.method) };
    case "auth.login.password_ok":
      return { title: "Password verified", detail: "awaiting MFA" };
    case "auth.login.fail":
      return { title: "Failed sign-in", detail: s(d.reason) };
    case "auth.mfa":
      return { title: "MFA verified", detail: s(d.method) };
    case "auth.mfa.step_up":
      return { title: "MFA step-up", detail: s(d.reason) };
    case "auth.mfa.fail":
      return { title: "MFA failed", detail: "" };
    case "auth.logout":
      return { title: "Signed out", detail: "" };
    case "auth.logout_all":
      return { title: "All sessions revoked", detail: d.revoked ? `${s(d.revoked)} sessions` : "" };
    case "auth.passkey.register":
      return { title: "Passkey registered", detail: "" };
    default:
      return { title: log.action, detail: "" };
  }
}

export default async function AdminAuditLogsPage() {
  await requireAdminPage();
  const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.ts)).limit(100);

  return (
    <section style={{ padding: "20px 0", maxWidth: 820 }}>
      <div className="sec-head">
        <div>
          <span className="idx">Audit</span>
          <h2 className="sec">Audit log</h2>
          <p>Admin and security events. Never contains passwords, hashes, tokens, or MFA secrets.</p>
        </div>
      </div>
      <div className="card">
        <div className="audit">
          {logs.length === 0 ? (
            <p className="mono" style={{ color: "var(--text-faint)" }}>No events yet.</p>
          ) : (
            logs.map((log) => {
              const { title, detail } = describe(log);
              return <AuditRow key={log.id} ts={log.ts} title={title} detail={detail} tag={log.tag as AuditTag} />;
            })
          )}
        </div>
      </div>
    </section>
  );
}

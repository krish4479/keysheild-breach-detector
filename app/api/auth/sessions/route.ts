import { writeAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth/rbac";
import { revokeAllForUser } from "@/lib/auth/session";
import { clientIp, json, route } from "@/lib/http";
import { assertCsrf } from "@/lib/security/csrf";

export const dynamic = "force-dynamic";

// Log out of every session for the current user (revokes the current one too).
export const DELETE = route(async (req) => {
  const auth = await requireAuth();
  await assertCsrf(req);
  const revoked = await revokeAllForUser(auth.user.id);
  await writeAudit({ action: "auth.logout_all", actorEmail: auth.user.email, tag: "auth", detail: { revoked }, ip: clientIp(req) });
  return json({ ok: true, revoked });
});

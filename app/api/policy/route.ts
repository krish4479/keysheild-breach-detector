import { writeAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/rbac";
import { clientIp, json, readJsonBody, route, validate } from "@/lib/http";
import { getActivePolicy, saveActivePolicy } from "@/lib/policy/store";
import { assertCsrf } from "@/lib/security/csrf";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { policyUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Public read: the checker surfaces the active requirements.
export const GET = route(async () => {
  const policy = await getActivePolicy();
  return json({ policy });
});

// Admin-only write, re-checked in the handler (not just the proxy).
export const PUT = route(async (req) => {
  const admin = await requireAdmin();
  await assertCsrf(req);
  await enforceRateLimit(
    "policy.update",
    [{ name: "session", id: admin.sessionId, rule: { limit: 20, windowSec: 60 } }],
    clientIp(req),
  );

  const settings = validate(policyUpdateSchema, await readJsonBody(req));
  await saveActivePolicy(settings, admin.user.email);
  await writeAudit({
    action: "policy.update",
    actorEmail: admin.user.email,
    tag: "admin",
    detail: { keys: Object.keys(settings) },
    ip: clientIp(req),
  });
  return json({ policy: settings });
});

import { writeAudit } from "@/lib/audit";
import { destroyCurrentSession, getAuth } from "@/lib/auth/session";
import { clientIp, json, route } from "@/lib/http";
import { assertCsrf } from "@/lib/security/csrf";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  await assertCsrf(req);
  const auth = await getAuth();
  await destroyCurrentSession();
  if (auth) await writeAudit({ action: "auth.logout", actorEmail: auth.user.email, tag: "auth", ip: clientIp(req) });
  return json({ ok: true });
});

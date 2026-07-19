import { eq, sql } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth/rbac";
import { elevateToMfaVerified, revokeSession } from "@/lib/auth/session";
import { verifyTotp } from "@/lib/auth/totp";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { ApiError, clientIp, json, readJsonBody, route, validate } from "@/lib/http";
import { assertCsrf } from "@/lib/security/csrf";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { mfaRequestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const POST = route(async (req) => {
  const auth = await requireAuth();
  await assertCsrf(req);
  const ip = clientIp(req);
  await enforceRateLimit(
    "auth.mfa",
    [
      { name: "ip", id: ip, rule: { limit: 10, windowSec: 300 } },
      { name: "account", id: auth.user.id, rule: { limit: 6, windowSec: 300 } },
    ],
    ip,
  );

  if (auth.user.lockedUntil && auth.user.lockedUntil > new Date()) {
    throw new ApiError(423, "locked", "Account temporarily locked. Sign in again later.");
  }

  const { code } = validate(mfaRequestSchema, await readJsonBody(req));
  if (!auth.user.totpSecret) throw new ApiError(400, "mfa_not_configured", "MFA is not configured for this account.");

  const ok = await verifyTotp(code, auth.user.totpSecret);
  if (!ok) {
    // DB-backed lockout backstops the Redis limiter, which fails open on outage.
    // TOTP is a low-entropy guessable factor, so it needs the same second layer as login.
    const willLock = auth.user.failedLoginCount + 1 >= MAX_FAILED;
    await db
      .update(users)
      .set({
        failedLoginCount: sql`${users.failedLoginCount} + 1`,
        lockedUntil: willLock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : (auth.user.lockedUntil ?? null),
      })
      .where(eq(users.id, auth.user.id));
    await writeAudit({ action: "auth.mfa.fail", actorEmail: auth.user.email, tag: "auth", ip });
    if (willLock) {
      await revokeSession(auth.sessionId); // force full re-authentication
      throw new ApiError(423, "locked", "Too many invalid codes — sign in again.");
    }
    throw new ApiError(401, "mfa_invalid", "Invalid code.");
  }

  await db.update(users).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, auth.user.id));
  await elevateToMfaVerified(auth.sessionId);
  await writeAudit({ action: "auth.mfa", actorEmail: auth.user.email, tag: "auth", detail: { method: "totp" }, ip });
  return json({ ok: true, role: auth.user.role });
});

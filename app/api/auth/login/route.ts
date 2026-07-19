import { eq, sql } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { verifyPassword } from "@/lib/auth/argon2";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { ApiError, clientIp, json, readJsonBody, route, validate } from "@/lib/http";
import { assertCsrf } from "@/lib/security/csrf";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { loginRequestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const GENERIC = "Invalid email or password."; // never reveal which was wrong
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const POST = route(async (req) => {
  const ip = clientIp(req);
  await assertCsrf(req);
  const { email, password } = validate(loginRequestSchema, await readJsonBody(req));
  await enforceRateLimit(
    "auth.login",
    [
      { name: "ip", id: ip, rule: { limit: 10, windowSec: 300 } },
      { name: "account", id: email.toLowerCase(), rule: { limit: 5, windowSec: 900 } },
    ],
    ip,
  );

  const found = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  const user = found[0];

  if (!user) {
    await writeAudit({ action: "auth.login.fail", tag: "auth", detail: { reason: "unknown_user" }, ip });
    throw new ApiError(401, "invalid_credentials", GENERIC);
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new ApiError(423, "locked", "Account temporarily locked. Try again later.");
  }

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) {
    const willLock = user.failedLoginCount + 1 >= MAX_FAILED;
    await db
      .update(users)
      .set({
        failedLoginCount: sql`${users.failedLoginCount} + 1`, // atomic — no lost updates under concurrent failures
        lockedUntil: willLock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : (user.lockedUntil ?? null),
      })
      .where(eq(users.id, user.id));
    await writeAudit({ action: "auth.login.fail", actorEmail: user.email, tag: "auth", detail: { reason: "bad_password" }, ip });
    throw new ApiError(401, "invalid_credentials", GENERIC);
  }

  await db.update(users).set({ failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, user.id));
  // Rotate: fresh session on login; MFA remains pending if the account requires it.
  await createSession(user.id, {
    ip,
    userAgent: req.headers.get("user-agent"),
    mfaVerified: !user.mfaEnabled,
  });
  await writeAudit({
    action: user.mfaEnabled ? "auth.login.password_ok" : "auth.login",
    actorEmail: user.email,
    tag: "auth",
    ip,
  });

  return json({ ok: true, mfaRequired: user.mfaEnabled, role: user.role });
});

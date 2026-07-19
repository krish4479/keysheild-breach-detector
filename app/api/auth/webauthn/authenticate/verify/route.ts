import type { AuthenticationResponseJSON, AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { createSession } from "@/lib/auth/session";
import { base64UrlToPublicKey, verifyAuthentication } from "@/lib/auth/webauthn";
import { db } from "@/lib/db/client";
import { users, webauthnCredentials } from "@/lib/db/schema";
import { ApiError, clientIp, json, readJsonBody, route, validate } from "@/lib/http";
import { takeChallenge } from "@/lib/security/challenge";
import { assertCsrf } from "@/lib/security/csrf";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { webauthnResponseSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const bodySchema = z.strictObject({ email: z.email().max(320), response: webauthnResponseSchema });

export const POST = route(async (req) => {
  await assertCsrf(req);
  const ip = clientIp(req);
  const { email, response } = validate(bodySchema, await readJsonBody(req));
  const lower = email.toLowerCase();
  await enforceRateLimit(
    "auth.webauthn",
    [
      { name: "ip", id: ip, rule: { limit: 10, windowSec: 300 } },
      { name: "account", id: lower, rule: { limit: 6, windowSec: 300 } },
    ],
    ip,
  );

  const challenge = await takeChallenge("auth", lower);
  if (!challenge) throw new ApiError(400, "no_challenge", "Authentication challenge expired.");

  const found = await db.select().from(users).where(eq(users.email, lower)).limit(1);
  const user = found[0];
  if (!user) throw new ApiError(401, "invalid_credentials", "Invalid credentials.");

  const credId = String(response.id);
  const credFound = await db
    .select()
    .from(webauthnCredentials)
    .where(and(eq(webauthnCredentials.id, credId), eq(webauthnCredentials.userId, user.id)))
    .limit(1);
  const stored = credFound[0];
  if (!stored) throw new ApiError(401, "invalid_credentials", "Invalid credentials.");

  const verification = await verifyAuthentication(response as unknown as AuthenticationResponseJSON, challenge, {
    id: stored.id,
    publicKey: base64UrlToPublicKey(stored.publicKey),
    counter: stored.counter,
    transports: (stored.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
  });
  if (!verification.verified) {
    await writeAudit({ action: "auth.passkey.fail", actorEmail: user.email, tag: "auth", ip });
    throw new ApiError(401, "invalid_credentials", "Invalid credentials.");
  }

  await db
    .update(webauthnCredentials)
    .set({ counter: verification.authenticationInfo.newCounter })
    .where(eq(webauthnCredentials.id, stored.id));
  // A passkey is a strong authenticator → the session is MFA-complete.
  await createSession(user.id, { ip, userAgent: req.headers.get("user-agent"), mfaVerified: true });
  await writeAudit({ action: "auth.login", actorEmail: user.email, tag: "auth", detail: { method: "passkey" }, ip });

  return json({ ok: true, role: user.role });
});

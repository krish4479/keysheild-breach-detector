import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { requireAuth } from "@/lib/auth/rbac";
import { publicKeyToBase64Url, verifyRegistration } from "@/lib/auth/webauthn";
import { db } from "@/lib/db/client";
import { users, webauthnCredentials } from "@/lib/db/schema";
import { ApiError, clientIp, json, readJsonBody, route, validate } from "@/lib/http";
import { takeChallenge } from "@/lib/security/challenge";
import { assertCsrf } from "@/lib/security/csrf";
import { webauthnResponseSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = route(async (req) => {
  const auth = await requireAuth();
  await assertCsrf(req);
  const body = validate(webauthnResponseSchema, await readJsonBody(req));

  const challenge = await takeChallenge("reg", auth.user.id);
  if (!challenge) throw new ApiError(400, "no_challenge", "Registration challenge expired.");

  const verification = await verifyRegistration(body as unknown as RegistrationResponseJSON, challenge);
  if (!verification.verified || !verification.registrationInfo) {
    throw new ApiError(400, "verify_failed", "Passkey registration failed.");
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  await db
    .insert(webauthnCredentials)
    .values({
      id: credential.id,
      userId: auth.user.id,
      publicKey: publicKeyToBase64Url(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? null,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    })
    .onConflictDoNothing();
  await db.update(users).set({ mfaEnabled: true }).where(eq(users.id, auth.user.id));
  await writeAudit({ action: "auth.passkey.register", actorEmail: auth.user.email, tag: "auth", ip: clientIp(req) });

  return json({ ok: true });
});

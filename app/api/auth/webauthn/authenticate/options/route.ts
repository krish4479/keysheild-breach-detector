import { eq } from "drizzle-orm";
import { z } from "zod";
import { authenticationOptions } from "@/lib/auth/webauthn";
import { db } from "@/lib/db/client";
import { users, webauthnCredentials } from "@/lib/db/schema";
import { clientIp, json, readJsonBody, route, validate } from "@/lib/http";
import { storeChallenge } from "@/lib/security/challenge";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const dynamic = "force-dynamic";

const bodySchema = z.strictObject({ email: z.email().max(320) });

export const POST = route(async (req) => {
  const ip = clientIp(req);
  const { email } = validate(bodySchema, await readJsonBody(req));
  const lower = email.toLowerCase();
  // Same anti-abuse posture as the verify step: an unauthenticated worker must be rate-limited.
  await enforceRateLimit(
    "auth.webauthn.options",
    [
      { name: "ip", id: ip, rule: { limit: 20, windowSec: 300 } },
      { name: "account", id: lower, rule: { limit: 10, windowSec: 300 } },
    ],
    ip,
  );

  const found = await db.select().from(users).where(eq(users.email, lower)).limit(1);
  const user = found[0];
  const creds = user
    ? await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, user.id))
    : [];

  // Generate options regardless (empty allowCredentials if unknown) to avoid enumeration.
  const options = await authenticationOptions(creds.map((c) => ({ id: c.id, transports: c.transports })));
  await storeChallenge("auth", lower, options.challenge);
  return json(options);
});

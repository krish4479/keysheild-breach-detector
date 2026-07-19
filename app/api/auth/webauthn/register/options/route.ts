import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/rbac";
import { registrationOptions } from "@/lib/auth/webauthn";
import { db } from "@/lib/db/client";
import { webauthnCredentials } from "@/lib/db/schema";
import { json, route } from "@/lib/http";
import { storeChallenge } from "@/lib/security/challenge";

export const dynamic = "force-dynamic";

export const POST = route(async () => {
  const auth = await requireAuth();
  const creds = await db.select().from(webauthnCredentials).where(eq(webauthnCredentials.userId, auth.user.id));
  const options = await registrationOptions(
    { id: auth.user.id, email: auth.user.email },
    creds.map((c) => ({ id: c.id, transports: c.transports })),
  );
  await storeChallenge("reg", auth.user.id, options.challenge);
  return json(options);
});

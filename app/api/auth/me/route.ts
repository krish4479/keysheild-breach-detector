import { getAuth } from "@/lib/auth/session";
import { json, route } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const auth = await getAuth();
  if (!auth) return json({ authenticated: false });
  return json({
    authenticated: true,
    email: auth.user.email,
    role: auth.user.role,
    mfaEnabled: auth.user.mfaEnabled,
    mfaVerified: auth.mfaVerified,
  });
});

import { ApiError } from "../http";
import { getAuth, type AuthContext } from "./session";

/**
 * Deny-by-default authorization, re-checked inside every protected handler
 * (never relying on proxy/middleware alone). requireAdmin additionally demands a
 * completed MFA step.
 */
export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) throw new ApiError(401, "unauthenticated", "Authentication required.");
  return auth;
}

export async function requireAdmin(): Promise<AuthContext> {
  const auth = await requireAuth();
  if (auth.user.role !== "admin") throw new ApiError(403, "forbidden", "Admin access required.");
  if (!auth.mfaVerified) throw new ApiError(401, "mfa_required", "Multi-factor authentication required.");
  return auth;
}

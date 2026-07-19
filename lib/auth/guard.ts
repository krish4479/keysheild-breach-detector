import { redirect } from "next/navigation";
import { getAuth, type AuthContext } from "./session";

/** Page-level admin guard: redirects to the login page instead of throwing. */
export async function requireAdminPage(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth || auth.user.role !== "admin" || !auth.mfaVerified) redirect("/admin/login");
  return auth;
}

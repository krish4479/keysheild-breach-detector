import { json, route } from "@/lib/http";
import { issueCsrfToken } from "@/lib/security/csrf";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const token = await issueCsrfToken();
  return json({ token });
});

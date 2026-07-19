import { json, route } from "@/lib/http";
import { SECURITY_HEADER_NAMES } from "@/lib/security/headers";

export const dynamic = "force-dynamic";

// Reports the security-header baseline KeyShield enforces. proxy.ts sets these on
// every response (inspect this request's response headers to confirm); the CSP is
// additionally forwarded onto the request, so we can detect it + the nonce here.
export const GET = route(async (req) => {
  const cspOnRequest = req.headers.get("content-security-policy");
  const nonce = req.headers.get("x-nonce");
  return json({
    enforcedBy: "proxy.ts",
    cspNonce: Boolean(nonce),
    cspPresent: Boolean(cspOnRequest),
    headers: SECURITY_HEADER_NAMES,
    note: "All listed headers are set on every response by proxy.ts.",
  });
});

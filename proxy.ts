import { NextResponse, type NextRequest } from "next/server";
import { buildSecurityHeaders } from "./lib/security/headers";

/**
 * Next.js 16 renamed Middleware to Proxy (same behavior; the proxy runtime is
 * nodejs and cannot be configured to edge). It is kept deliberately dependency-light:
 * it only sets the per-request CSP nonce and the security header baseline.
 * Auth/authorization is re-checked inside every API handler — the brief is explicit
 * that proxy alone must not gate access.
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function proxy(request: NextRequest): NextResponse {
  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV !== "production";
  const path = request.nextUrl.pathname;
  const isAdmin = path.startsWith("/admin") || path.startsWith("/api/admin");

  const headers = buildSecurityHeaders({ nonce, isDev, isAdmin });
  const csp = headers["Content-Security-Policy"] ?? "";

  // Pass nonce + CSP through the request so Next can apply the nonce during SSR.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "../env";
import { ApiError } from "../http";

/**
 * CSRF defense for cookie-authenticated mutations:
 *   1) strict Origin/Referer allowlist (primary), and
 *   2) a double-submit token (cookie value must equal the X-CSRF-Token header).
 * The token cookie is readable by same-origin JS (not httpOnly) so the client can
 * echo it; a cross-site attacker can neither read it nor set a custom header.
 */
const CSRF_COOKIE = "keyshield_csrf";

export async function issueCsrfToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(CSRF_COOKIE)?.value;
  if (existing) return existing;
  const token = randomBytes(32).toString("hex");
  store.set(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return token;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function assertCsrf(req: Request): Promise<void> {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  if (origin) {
    if (origin !== env.APP_ORIGIN) throw new ApiError(403, "csrf_origin", "Cross-origin request blocked.");
  } else if (referer) {
    // Exact origin match — a prefix check would accept http://APP_ORIGIN.evil.com.
    let refOrigin: string;
    try {
      refOrigin = new URL(referer).origin;
    } catch {
      throw new ApiError(403, "csrf_origin", "Invalid Referer.");
    }
    if (refOrigin !== env.APP_ORIGIN) throw new ApiError(403, "csrf_origin", "Cross-origin request blocked.");
  } else {
    throw new ApiError(403, "csrf_origin", "Missing Origin/Referer header.");
  }

  const store = await cookies();
  const cookieToken = store.get(CSRF_COOKIE)?.value;
  const headerToken = req.headers.get("x-csrf-token");
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    throw new ApiError(403, "csrf_token", "Invalid or missing CSRF token.");
  }
}

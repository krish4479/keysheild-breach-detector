/**
 * Security response headers, built per-request. Pure + dependency-free so it is
 * safe to import from `proxy.ts`. CSP uses a per-request nonce with
 * strict-dynamic (no unsafe-inline for scripts). `style-src` allows
 * 'unsafe-inline' because inline style="" attributes can't carry a nonce — the
 * brief bans unsafe-inline *scripts*, not styles (see docs/SECURITY_CHECKLIST.md).
 */

export interface HeaderOptions {
  nonce: string;
  isDev: boolean;
  isAdmin: boolean;
}

export function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  const scriptExtra = isDev ? " 'unsafe-eval'" : "";
  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `style-src 'self' 'unsafe-inline'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${scriptExtra}`,
    `connect-src 'self'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

export function buildSecurityHeaders(opts: HeaderOptions): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": buildContentSecurityPolicy(opts.nonce, opts.isDev),
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    // Deny sensors; allow WebAuthn/passkey ceremonies on same origin.
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), publickey-credentials-get=(self), publickey-credentials-create=(self)",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-DNS-Prefetch-Control": "off",
  };
  // Admin surfaces must never be cached (may contain sensitive analytics).
  if (opts.isAdmin) headers["Cache-Control"] = "no-store, max-age=0";
  return headers;
}

/** The exact header names we guarantee — used by /api/security/headers-check. */
export const SECURITY_HEADER_NAMES = [
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
] as const;

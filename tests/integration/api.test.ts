import { describe, expect, it } from "vitest";

/**
 * HTTP integration tests against a running instance (app + postgres + redis).
 * They auto-skip when no server is reachable, so `vitest run` stays green in a
 * bare unit environment; CI brings the stack up first.
 *   KEYSHIELD_BASE_URL overrides the target (default http://localhost:3000).
 */
const BASE = process.env.KEYSHIELD_BASE_URL ?? "http://localhost:3000";

let serverUp = false;
try {
  const r = await fetch(`${BASE}/api/health`);
  serverUp = r.status === 200 || r.status === 503;
} catch {
  serverUp = false;
}

const d = serverUp ? describe : describe.skip;

d("KeyShield API integration", () => {
  it("health reports db/redis/breach checks", async () => {
    const res = await fetch(`${BASE}/api/health`);
    const body = await res.json();
    expect(body).toHaveProperty("checks.db");
    expect(body).toHaveProperty("checks.redis");
    expect(body).toHaveProperty("checks.breachApi");
  });

  it("sets the security headers (CSP with nonce, HSTS, nosniff, frame deny)", async () => {
    const res = await fetch(`${BASE}/`);
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toMatch(/script-src[^;]*'nonce-/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.headers.get("strict-transport-security")).toBeTruthy();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("x-powered-by")).toBeNull();
  });

  it("analyze validates input and rejects unknown fields", async () => {
    const ok = await fetch(`${BASE}/api/password/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "correct horse battery staple" }),
    });
    expect(ok.status).toBe(200);
    const data = await ok.json();
    expect(data.label).toBe("Strong");

    const bad = await fetch(`${BASE}/api/password/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "x", injected: true }),
    });
    expect(bad.status).toBe(400);
  });

  it("validate returns the documented shape and blocks a breached password", async () => {
    const res = await fetch(`${BASE}/api/password/validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "password" }),
    });
    const data = await res.json();
    expect(data).toMatchObject({
      valid: expect.any(Boolean),
      score: expect.any(Number),
      riskLevel: expect.any(String),
      strengthLabel: expect.any(String),
      breached: expect.any(Boolean),
      breachCount: expect.any(Number),
    });
    expect(data.breached).toBe(true);
    expect(data.valid).toBe(false);
  });

  it("exposes the active policy", async () => {
    const res = await fetch(`${BASE}/api/policy`);
    const data = await res.json();
    expect(data.policy.minLength).toBeGreaterThan(0);
  });

  it("denies admin endpoints without authentication (RBAC, deny-by-default)", async () => {
    const metrics = await fetch(`${BASE}/api/admin/metrics`);
    expect([401, 403]).toContain(metrics.status);
    const auditLogs = await fetch(`${BASE}/api/admin/audit-logs`);
    expect([401, 403]).toContain(auditLogs.status);
  });

  it("blocks cookie-authed mutations without a CSRF token/origin", async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@keyshield.local", password: "whatever-long-enough" }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/csrf/);
  });

  it("rate-limits repeated breach checks per IP", async () => {
    const results = await Promise.all(
      Array.from({ length: 40 }, () =>
        fetch(`${BASE}/api/password/check-breach`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password: "password" }),
        }).then((r) => r.status),
      ),
    );
    expect(results).toContain(429);
  });
});

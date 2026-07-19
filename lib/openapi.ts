/**
 * OpenAPI 3.1 document for the KeyShield REST API. Hand-authored (the surface is
 * small and stable) so /docs/api and any external client have a single spec with
 * no codegen dependency. Rendered by app/docs/api and served at /api/openapi.
 */
const jsonBody = (schemaRef: string) => ({
  required: true,
  content: { "application/json": { schema: { $ref: `#/components/schemas/${schemaRef}` } } },
});
const jsonResponse = (description: string, schemaRef?: string) => ({
  description,
  ...(schemaRef ? { content: { "application/json": { schema: { $ref: `#/components/schemas/${schemaRef}` } } } } : {}),
});

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "KeyShield API",
    version: "1.0.0",
    description:
      "Password strength, HIBP k-anonymity breach detection, and NIST 800-63B policy enforcement. " +
      "Plaintext passwords are never logged, stored, or sent externally — only a 5-char SHA-1 prefix leaves the server.",
  },
  servers: [{ url: "/", description: "Same-origin" }],
  tags: [
    { name: "Password", description: "Strength, breach, and policy checks" },
    { name: "Policy", description: "Password policy (admin-managed)" },
    { name: "Admin", description: "Analytics & audit (admin + MFA required)" },
    { name: "Auth", description: "Session, MFA, and passkey authentication" },
    { name: "System", description: "Health & security introspection" },
  ],
  paths: {
    "/api/password/analyze": {
      post: {
        tags: ["Password"],
        summary: "Local-style strength analysis (score, label, reasons, suggestions).",
        requestBody: jsonBody("AnalyzeRequest"),
        responses: { "200": jsonResponse("Strength result", "StrengthResult"), "400": jsonResponse("Validation error", "Error"), "429": jsonResponse("Rate limited", "Error") },
      },
    },
    "/api/password/check-breach": {
      post: {
        tags: ["Password"],
        summary: "HIBP breach lookup via k-anonymity (breached bool + count).",
        requestBody: jsonBody("CheckBreachRequest"),
        responses: { "200": jsonResponse("Breach result", "BreachResult"), "429": jsonResponse("Rate limited", "Error") },
      },
    },
    "/api/password/validate": {
      post: {
        tags: ["Password"],
        summary: "Combined analyze + breach + policy verdict.",
        requestBody: jsonBody("ValidateRequest"),
        responses: { "200": jsonResponse("Validation verdict", "ValidateResult"), "400": jsonResponse("Validation error", "Error") },
      },
    },
    "/api/policy": {
      get: { tags: ["Policy"], summary: "Read the active password policy.", responses: { "200": jsonResponse("Policy", "PolicyEnvelope") } },
      put: {
        tags: ["Policy"],
        summary: "Update the password policy (admin only). Requires CSRF token.",
        requestBody: jsonBody("PolicySettings"),
        responses: { "200": jsonResponse("Updated policy", "PolicyEnvelope"), "401": jsonResponse("Unauthenticated", "Error"), "403": jsonResponse("Forbidden / CSRF", "Error") },
      },
    },
    "/api/admin/metrics": {
      get: { tags: ["Admin"], summary: "Aggregate analytics for the dashboard (admin only).", responses: { "200": jsonResponse("Metrics"), "401": jsonResponse("Unauthenticated", "Error"), "403": jsonResponse("Forbidden", "Error") } },
    },
    "/api/admin/audit-logs": {
      get: {
        tags: ["Admin"],
        summary: "Recent audit log entries (admin only). Never contains secrets.",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200 } },
          { name: "tag", in: "query", schema: { type: "string", enum: ["admin", "auth", "alert", "info", "system"] } },
        ],
        responses: { "200": jsonResponse("Audit logs"), "401": jsonResponse("Unauthenticated", "Error") },
      },
    },
    "/api/health": {
      get: { tags: ["System"], summary: "Liveness/readiness for DB, Redis, and the breach API.", responses: { "200": jsonResponse("Healthy", "Health"), "503": jsonResponse("Unhealthy", "Health") } },
    },
    "/api/security/headers-check": {
      get: { tags: ["System"], summary: "Reports the security headers KeyShield enforces.", responses: { "200": jsonResponse("Header report") } },
    },
    "/api/auth/csrf": {
      get: { tags: ["Auth"], summary: "Issue a CSRF token (also set as a SameSite=Strict cookie).", responses: { "200": jsonResponse("CSRF token") } },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Password login (step 1). Generic errors prevent account enumeration.",
        requestBody: jsonBody("LoginRequest"),
        responses: { "200": jsonResponse("Logged in / MFA required"), "401": jsonResponse("Invalid credentials", "Error"), "423": jsonResponse("Account locked", "Error") },
      },
    },
    "/api/auth/mfa": {
      post: { tags: ["Auth"], summary: "Verify a 6-digit TOTP code (step 2).", requestBody: jsonBody("MfaRequest"), responses: { "200": jsonResponse("MFA verified"), "401": jsonResponse("Invalid code", "Error") } },
    },
    "/api/auth/logout": { post: { tags: ["Auth"], summary: "Destroy the current session.", responses: { "200": jsonResponse("Logged out") } } },
    "/api/auth/sessions": { delete: { tags: ["Auth"], summary: "Revoke all sessions for the current user.", responses: { "200": jsonResponse("Revoked") } } },
    "/api/auth/webauthn/register/options": { post: { tags: ["Auth"], summary: "Begin passkey registration.", responses: { "200": jsonResponse("PublicKeyCredentialCreationOptions") } } },
    "/api/auth/webauthn/register/verify": { post: { tags: ["Auth"], summary: "Complete passkey registration.", responses: { "200": jsonResponse("Registered") } } },
    "/api/auth/webauthn/authenticate/options": { post: { tags: ["Auth"], summary: "Begin passkey authentication.", responses: { "200": jsonResponse("PublicKeyCredentialRequestOptions") } } },
    "/api/auth/webauthn/authenticate/verify": { post: { tags: ["Auth"], summary: "Complete passkey authentication.", responses: { "200": jsonResponse("Authenticated") } } },
  },
  components: {
    schemas: {
      AnalyzeRequest: {
        type: "object",
        additionalProperties: false,
        required: ["password"],
        properties: { password: { type: "string", maxLength: 4096 }, userInputs: { type: "array", items: { type: "string" } } },
      },
      CheckBreachRequest: { type: "object", additionalProperties: false, required: ["password"], properties: { password: { type: "string", maxLength: 4096 } } },
      ValidateRequest: {
        type: "object",
        additionalProperties: false,
        required: ["password"],
        properties: { password: { type: "string", maxLength: 4096 }, userInputs: { type: "array", items: { type: "string" } }, mfaEnabled: { type: "boolean" } },
      },
      LoginRequest: { type: "object", additionalProperties: false, required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string" } } },
      MfaRequest: { type: "object", additionalProperties: false, required: ["code"], properties: { code: { type: "string", pattern: "^\\d{6}$" } } },
      StrengthResult: {
        type: "object",
        properties: {
          score: { type: "integer", minimum: 0, maximum: 4 },
          label: { type: "string", enum: ["Weak", "Fair", "Good", "Strong"] },
          guessesLog10: { type: "number" },
          entropyBits: { type: "integer" },
          crackTimeDisplay: { type: "string" },
          reasons: { type: "array", items: { type: "string" } },
          suggestions: { type: "array", items: { type: "string" } },
        },
      },
      BreachResult: {
        type: "object",
        properties: {
          breached: { type: "boolean" },
          count: { type: "integer" },
          status: { type: "string", enum: ["safe", "breached", "unknown"] },
          source: { type: "string", enum: ["online", "cache", "offline", "unavailable"] },
        },
      },
      ValidateResult: {
        type: "object",
        properties: {
          valid: { type: "boolean" },
          score: { type: "integer", minimum: 0, maximum: 4 },
          riskLevel: { type: "string", enum: ["low", "medium", "high", "critical"] },
          strengthLabel: { type: "string", enum: ["Weak", "Fair", "Good", "Strong"] },
          breached: { type: "boolean" },
          breachCount: { type: "integer" },
          reasons: { type: "array", items: { type: "string" } },
          suggestions: { type: "array", items: { type: "string" } },
        },
      },
      PolicySettings: {
        type: "object",
        additionalProperties: false,
        properties: {
          minLength: { type: "integer" },
          minLengthWithMfa: { type: "integer" },
          maxLength: { type: "integer", minimum: 64 },
          allowSpaces: { type: "boolean" },
          allowUnicode: { type: "boolean" },
          requireComposition: { type: "boolean" },
          blockBreached: { type: "boolean" },
          blockCommon: { type: "boolean" },
          forcePeriodicRotation: { type: "boolean" },
          minZxcvbnScore: { type: "integer", minimum: 0, maximum: 4 },
          preventReuse: { type: "boolean" },
          reuseHistoryDepth: { type: "integer" },
        },
      },
      PolicyEnvelope: { type: "object", properties: { policy: { $ref: "#/components/schemas/PolicySettings" } } },
      Health: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["healthy", "unhealthy"] },
          checks: { type: "object", properties: { db: { type: "string" }, redis: { type: "string" }, breachApi: { type: "string" } } },
          time: { type: "string", format: "date-time" },
        },
      },
      Error: { type: "object", properties: { error: { type: "string" }, message: { type: "string" }, details: { type: "object" } } },
    },
  },
} as const;

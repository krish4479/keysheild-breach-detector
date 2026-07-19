import { describe, expect, it } from "vitest";
import { policySettingsSchema } from "@/lib/policy";
import { analyzeRequestSchema, loginRequestSchema, mfaRequestSchema, validateRequestSchema } from "@/lib/validation";

describe("shared Zod schemas", () => {
  it("accepts a valid analyze request", () => {
    expect(analyzeRequestSchema.safeParse({ password: "hunter2", userInputs: ["a@b.com"] }).success).toBe(true);
  });

  it("rejects unknown fields (strict)", () => {
    expect(analyzeRequestSchema.safeParse({ password: "x", evil: true }).success).toBe(false);
  });

  it("validateRequest allows the mfaEnabled context flag", () => {
    const r = validateRequestSchema.safeParse({ password: "x", mfaEnabled: true });
    expect(r.success).toBe(true);
  });

  it("login requires a well-formed email", () => {
    expect(loginRequestSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
    expect(loginRequestSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });

  it("MFA code must be exactly six digits", () => {
    expect(mfaRequestSchema.safeParse({ code: "123456" }).success).toBe(true);
    expect(mfaRequestSchema.safeParse({ code: "12345" }).success).toBe(false);
    expect(mfaRequestSchema.safeParse({ code: "abcdef" }).success).toBe(false);
  });

  it("policy schema applies NIST defaults", () => {
    const p = policySettingsSchema.parse({});
    expect(p.minLength).toBe(15);
    expect(p.minLengthWithMfa).toBe(8);
    expect(p.maxLength).toBeGreaterThanOrEqual(64);
    expect(p.requireComposition).toBe(false);
    expect(p.forcePeriodicRotation).toBe(false);
    expect(p.blockBreached).toBe(true);
  });
});

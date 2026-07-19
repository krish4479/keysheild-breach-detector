import { describe, expect, it } from "vitest";
import { defaultPolicy, evaluatePolicy, passwordLength, type PolicyEvalInput } from "@/lib/policy";

const base: PolicyEvalInput = {
  password: "a-fairly-long-unique-passphrase",
  mfaEnabled: false,
  score: 4,
  breachStatus: "safe",
  breachCount: 0,
  isCommon: false,
};

describe("policy evaluation", () => {
  it("accepts a long, strong, unbreached password", () => {
    const v = evaluatePolicy(base, defaultPolicy);
    expect(v.valid).toBe(true);
    expect(v.riskLevel).toBe("low");
  });

  it("rejects and reasons a breached password (matches documented copy)", () => {
    const v = evaluatePolicy({ ...base, breachStatus: "breached", breachCount: 12345, score: 2 }, defaultPolicy);
    expect(v.valid).toBe(false);
    expect(v.reasons).toContain("Password appears in known breaches");
    expect(v.riskLevel).toBe("high");
  });

  it("escalates to critical when breached AND weak", () => {
    const v = evaluatePolicy({ ...base, breachStatus: "breached", breachCount: 999, score: 0 }, defaultPolicy);
    expect(v.riskLevel).toBe("critical");
  });

  it("enforces the length floor, lowered when MFA is enabled", () => {
    const short = evaluatePolicy({ ...base, password: "short", score: 1 }, defaultPolicy);
    expect(short.valid).toBe(false);
    const withMfa = evaluatePolicy({ ...base, password: "12characters", mfaEnabled: true, score: 3 }, defaultPolicy);
    expect(withMfa.valid).toBe(true); // 12 >= minLengthWithMfa (8)
  });

  it("blocks common passwords when the flag is on", () => {
    const v = evaluatePolicy({ ...base, isCommon: true, score: 1 }, defaultPolicy);
    expect(v.valid).toBe(false);
  });

  it("does not hard-block when breach status is unknown (HIBP degraded)", () => {
    const v = evaluatePolicy({ ...base, breachStatus: "unknown" }, defaultPolicy);
    expect(v.valid).toBe(true);
  });

  it("counts Unicode code points, not UTF-16 units", () => {
    expect(passwordLength("a😀b")).toBe(3);
  });
});

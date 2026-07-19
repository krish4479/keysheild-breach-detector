import { z } from "zod";

/**
 * Password policy — modern NIST SP 800-63B posture:
 * length + uniqueness over forced composition; no periodic rotation;
 * block breached + common. Stored as jsonb in the `policy` table and
 * validated by this schema on every write. Single source of truth for the type.
 */
export const policySettingsSchema = z.strictObject({
  minLength: z.number().int().min(1).max(256).default(15),
  minLengthWithMfa: z.number().int().min(1).max(256).default(8),
  maxLength: z.number().int().min(64).max(1024).default(128),
  allowSpaces: z.boolean().default(true),
  allowUnicode: z.boolean().default(true),
  // NIST advises AGAINST forced composition — default off, but configurable.
  requireComposition: z.boolean().default(false),
  blockBreached: z.boolean().default(true),
  blockCommon: z.boolean().default(true),
  forcePeriodicRotation: z.boolean().default(false),
  minZxcvbnScore: z.number().int().min(0).max(4).default(2),
  preventReuse: z.boolean().default(true),
  reuseHistoryDepth: z.number().int().min(0).max(50).default(5),
});

export type PolicySettings = z.infer<typeof policySettingsSchema>;

export const defaultPolicy: PolicySettings = policySettingsSchema.parse({});

export type BreachStatus = "safe" | "breached" | "unknown";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface PolicyEvalInput {
  password: string;
  mfaEnabled: boolean;
  score: number; // zxcvbn 0-4
  breachStatus: BreachStatus;
  breachCount: number;
  isCommon: boolean;
}

export interface PolicyVerdict {
  valid: boolean;
  riskLevel: RiskLevel;
  reasons: string[];
  suggestions: string[];
}

/** Count Unicode code points, not UTF-16 units — spaces/emoji count fairly, no truncation. */
export function passwordLength(password: string): number {
  return Array.from(password).length;
}

export function evaluatePolicy(input: PolicyEvalInput, policy: PolicySettings): PolicyVerdict {
  const reasons: string[] = [];
  const suggestions: string[] = [];
  const len = passwordLength(input.password);
  const effectiveMin = input.mfaEnabled ? policy.minLengthWithMfa : policy.minLength;

  if (len < effectiveMin) {
    reasons.push(`Too short — needs at least ${effectiveMin} characters${input.mfaEnabled ? " (MFA enabled)" : ""}.`);
    suggestions.push("Use a longer passphrase of several unrelated words.");
  }
  if (len > policy.maxLength) {
    reasons.push(`Too long — the maximum is ${policy.maxLength} characters (nothing is truncated).`);
  }
  if (!policy.allowSpaces && /\s/.test(input.password)) {
    reasons.push("Spaces are not permitted by the current policy.");
  }
  if (policy.blockCommon && input.isCommon) {
    reasons.push("Appears on the common-password blocklist.");
    suggestions.push("Choose something unpredictable that you do not use elsewhere.");
  }
  if (policy.blockBreached && input.breachStatus === "breached") {
    reasons.push("Password appears in known breaches");
    suggestions.push("Choose a unique passphrase that you do not use anywhere else");
  }
  if (input.score < policy.minZxcvbnScore) {
    reasons.push("Strength is below the minimum required by policy.");
    suggestions.push("Add length and avoid predictable words, dates, and keyboard patterns.");
  }
  if (input.breachStatus === "unknown" && policy.blockBreached) {
    // HIBP unreachable — degrade, don't hard-block. Policy allows on other merits.
    reasons.push("Breach status is temporarily unavailable — proceed with caution.");
  }

  const valid = reasons.filter((r) => !r.startsWith("Breach status is temporarily")).length === 0;

  return {
    valid,
    riskLevel: computeRisk(input),
    reasons,
    suggestions: dedupe(suggestions),
  };
}

function computeRisk(input: PolicyEvalInput): RiskLevel {
  let level: RiskLevel = input.score <= 1 ? "high" : input.score === 2 ? "medium" : "low";
  const bump = (to: RiskLevel) => {
    const order: RiskLevel[] = ["low", "medium", "high", "critical"];
    if (order.indexOf(to) > order.indexOf(level)) level = to;
  };
  if (input.isCommon) bump("high");
  if (input.breachStatus === "breached") {
    bump("high");
    if (input.score <= 1 || input.breachCount > 100_000) bump("critical");
  }
  return level;
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}

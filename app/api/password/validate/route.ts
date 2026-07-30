import { checkBreach } from "@/lib/breach";
import { clientIp, json, readJsonBody, route, validate } from "@/lib/http";
import { recordValidation } from "@/lib/metrics";
import { evaluatePolicy } from "@/lib/policy";
import { getActivePolicy, isCommonPassword } from "@/lib/policy/store";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { analyzeStrength, passwordContainsUserToken } from "@/lib/strength";
import { validateRequestSchema } from "@/lib/validation";

// Combined analyze + breach + policy verdict, enforcing the DB-stored policy.
export const POST = route(async (req) => {
  const ip = clientIp(req);
  await enforceRateLimit("password.validate", [{ name: "ip", id: ip, rule: { limit: 60, windowSec: 60 } }], ip);

  const { password, userInputs, mfaEnabled } = validate(validateRequestSchema, await readJsonBody(req));

  const analysis = analyzeStrength(password, userInputs ?? []);
  const [breach, common, policy] = await Promise.all([
    checkBreach(password),
    isCommonPassword(password),
    getActivePolicy(),
  ]);

  const verdict = evaluatePolicy(
    {
      password,
      mfaEnabled: mfaEnabled ?? false,
      score: analysis.score,
      breachStatus: breach.status,
      breachCount: breach.count,
      isCommon: common,
    },
    policy,
  );

  // Hard rule: the password must not reuse the username (or any part of it).
  const usernameConflict = passwordContainsUserToken(password, userInputs ?? []);
  const reasons = [...verdict.reasons, ...analysis.reasons.filter((r) => !verdict.reasons.includes(r))];
  if (usernameConflict) reasons.unshift("Must not contain your username.");
  const suggestions = [...new Set([...verdict.suggestions, ...analysis.suggestions])];
  const valid = verdict.valid && !usernameConflict;

  await recordValidation({
    weakBlocked: analysis.score < policy.minZxcvbnScore || usernameConflict,
    breachedBlocked: breach.breached,
    reasons,
  });

  return json({
    valid,
    score: analysis.score,
    riskLevel: usernameConflict && verdict.riskLevel === "low" ? "medium" : verdict.riskLevel,
    strengthLabel: analysis.label,
    breached: breach.breached,
    breachCount: breach.count,
    reasons,
    suggestions,
  });
});

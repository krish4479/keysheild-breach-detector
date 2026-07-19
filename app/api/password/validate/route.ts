import { checkBreach } from "@/lib/breach";
import { clientIp, json, readJsonBody, route, validate } from "@/lib/http";
import { recordValidation } from "@/lib/metrics";
import { evaluatePolicy } from "@/lib/policy";
import { getActivePolicy, isCommonPassword } from "@/lib/policy/store";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { analyzeStrength } from "@/lib/strength";
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

  const reasons = [...verdict.reasons, ...analysis.reasons.filter((r) => !verdict.reasons.includes(r))];
  const suggestions = [...new Set([...verdict.suggestions, ...analysis.suggestions])];

  await recordValidation({
    weakBlocked: analysis.score < policy.minZxcvbnScore,
    breachedBlocked: breach.breached,
    reasons,
  });

  return json({
    valid: verdict.valid,
    score: analysis.score,
    riskLevel: verdict.riskLevel,
    strengthLabel: analysis.label,
    breached: breach.breached,
    breachCount: breach.count,
    reasons,
    suggestions,
  });
});

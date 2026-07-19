import { clientIp, json, readJsonBody, route, validate } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { analyzeStrength } from "@/lib/strength";
import { analyzeRequestSchema } from "@/lib/validation";

// Local-style strength analysis. The password is used and discarded — never
// logged, stored, or cached.
export const POST = route(async (req) => {
  const ip = clientIp(req);
  await enforceRateLimit("password.analyze", [{ name: "ip", id: ip, rule: { limit: 60, windowSec: 60 } }], ip);

  const { password, userInputs } = validate(analyzeRequestSchema, await readJsonBody(req));
  const result = analyzeStrength(password, userInputs ?? []);
  return json(result);
});

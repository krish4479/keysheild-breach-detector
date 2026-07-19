import { checkBreach } from "@/lib/breach";
import { clientIp, json, readJsonBody, route, validate } from "@/lib/http";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { checkBreachRequestSchema } from "@/lib/validation";

// HIBP k-anonymity breach lookup. Only a 5-char SHA-1 prefix ever leaves the
// server (inside lib/breach); the plaintext/hash/suffix are never logged.
export const POST = route(async (req) => {
  const ip = clientIp(req);
  await enforceRateLimit("password.check-breach", [{ name: "ip", id: ip, rule: { limit: 30, windowSec: 60 } }], ip);

  const { password } = validate(checkBreachRequestSchema, await readJsonBody(req));
  const result = await checkBreach(password);
  return json({
    breached: result.breached,
    count: result.count,
    status: result.status,
    source: result.source,
  });
});

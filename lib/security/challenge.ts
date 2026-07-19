import { getRedis } from "../redis";

// Short-lived WebAuthn challenge store (Redis). One-time use: taking consumes it.
export async function storeChallenge(scope: string, id: string, challenge: string, ttlSec = 300): Promise<void> {
  try {
    await getRedis().set(`webauthn:${scope}:${id}`, challenge, "EX", ttlSec);
  } catch {
    /* if Redis is down the ceremony will fail closed on verify */
  }
}

export async function takeChallenge(scope: string, id: string): Promise<string | null> {
  try {
    const redis = getRedis();
    const key = `webauthn:${scope}:${id}`;
    const value = await redis.get(key);
    if (value) await redis.del(key);
    return value;
  } catch {
    return null;
  }
}

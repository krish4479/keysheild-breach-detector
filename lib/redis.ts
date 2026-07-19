import Redis from "ioredis";
import { env } from "./env";

// Single shared connection. Errors are swallowed at the event level so that a
// Redis outage degrades (cache miss / rate-limit fallback) instead of crashing.
const g = globalThis as unknown as { _redis?: Redis };

export function getRedis(): Redis {
  if (!g._redis) {
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: true,
      lazyConnect: false,
    });
    client.on("error", () => {
      /* handled by callers via try/catch; avoid unhandled 'error' crash */
    });
    g._redis = client;
  }
  return g._redis;
}

export async function pingRedis(): Promise<boolean> {
  try {
    const pong = await getRedis().ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}

import { sql } from "drizzle-orm";
import { breachApiReachable } from "@/lib/breach";
import { db } from "@/lib/db/client";
import { route } from "@/lib/http";
import { pingRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const [dbOk, redisOk, breachOk] = await Promise.all([
    db
      .execute(sql`select 1`)
      .then(() => true)
      .catch(() => false),
    pingRedis(),
    breachApiReachable(),
  ]);

  // Breach-API degradation is non-fatal; DB + Redis are required.
  const healthy = dbOk && redisOk;
  return Response.json(
    {
      status: healthy ? "healthy" : "unhealthy",
      checks: {
        db: dbOk ? "up" : "down",
        redis: redisOk ? "up" : "down",
        breachApi: breachOk ? "up" : "degraded",
      },
      time: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
});

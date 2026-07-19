import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

// Reuse the pool across HMR / serverless invocations.
const globalForDb = globalThis as unknown as { _pg?: ReturnType<typeof postgres> };

const client = globalForDb._pg ?? postgres(env.DATABASE_URL, { max: 10 });
if (env.NODE_ENV !== "production") globalForDb._pg = client;

export const db = drizzle(client, { schema });
export { schema };
export const sqlClient = client;

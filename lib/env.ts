import { z } from "zod";

/**
 * Central, zod-validated environment. Server-only.
 * Defaults match docker-compose so `docker compose up` works with no .env,
 * but production is nudged to override secrets (see refine below).
 * ponytail: single source of truth for config; parsed once at import.
 */
const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? def : v === "true" || v === "1"));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.string().default("postgres://keyshield:keyshield@localhost:5432/keyshield"),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // 32+ bytes; iron-session requires it. Dev default is clearly non-secret.
  SESSION_SECRET: z.string().min(32).default("dev-only-insecure-session-secret-change-me-32b"),
  SESSION_COOKIE_NAME: z.string().default("keyshield_session"),
  SESSION_IDLE_TIMEOUT_MIN: z.coerce.number().int().positive().default(30),
  SESSION_ABSOLUTE_TIMEOUT_MIN: z.coerce.number().int().positive().default(720),

  APP_ORIGIN: z.string().url().default("http://localhost:3000"),
  // Number of trusted reverse proxies in front of the app. The client IP is read
  // from X-Forwarded-For counting this many hops from the right, so a spoofed
  // left-most XFF value can't forge the rate-limit key. Set 0 if directly exposed.
  TRUSTED_PROXY_COUNT: z.coerce.number().int().min(0).max(10).default(1),

  WEBAUTHN_RP_ID: z.string().default("localhost"),
  WEBAUTHN_RP_NAME: z.string().default("KeyShield"),
  WEBAUTHN_ORIGIN: z.string().url().default("http://localhost:3000"),

  HIBP_API_BASE: z.string().url().default("https://api.pwnedpasswords.com"),
  HIBP_ADD_PADDING: bool(true),
  HIBP_TIMEOUT_MS: z.coerce.number().int().positive().default(3500),
  BREACH_MODE: z.enum(["online", "offline"]).default("online"),
  BREACH_CORPUS_PATH: z.string().default("lib/breach/offline-corpus.txt"),
  BREACH_CACHE_TTL_SEC: z.coerce.number().int().positive().default(300),

  RATE_LIMIT_DISABLED: bool(false),

  // Seed-only. Never used to authenticate after seeding except as the demo admin.
  ADMIN_EMAIL: z.string().email().default("admin@keyshield.local"),
  ADMIN_PASSWORD: z.string().min(15).default("correct-horse-battery-staple-42"),
  ADMIN_TOTP_SECRET: z.string().default("KS5DEMOADMINSEEDTOTPBASE32SECRET"),

  // Optional observability seams (no-op unless set).
  SENTRY_DSN: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast with a readable message; never print values.
  const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  throw new Error(`Invalid environment configuration for: ${keys}`);
}

export const env = parsed.data;
export type Env = typeof env;

export const isProd = env.NODE_ENV === "production";

if (isProd && env.SESSION_SECRET.startsWith("dev-only")) {
  // Loud, but do not leak the value.
  console.warn("[keyshield] SESSION_SECRET is the insecure dev default in production — set a strong secret.");
}

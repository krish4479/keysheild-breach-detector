import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "user"]);
export const auditTagEnum = pgEnum("audit_tag", ["admin", "auth", "alert", "info", "system"]);

const tsCol = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("user"),
  // TOTP is the seedable/testable MFA factor; WebAuthn passkeys are an added factor.
  totpSecret: text("totp_secret"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lockedUntil: tsCol("locked_until"),
  passwordChangedAt: tsCol("password_changed_at").notNull().defaultNow(),
  createdAt: tsCol("created_at").notNull().defaultNow(),
});

// Recent password hashes for reuse prevention (never plaintext).
export const passwordHistory = pgTable("password_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  createdAt: tsCol("created_at").notNull().defaultNow(),
});

// Server-side session store — enables rotation, idle/absolute timeout, revoke, "log out all".
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  mfaVerified: boolean("mfa_verified").notNull().default(false),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: tsCol("created_at").notNull().defaultNow(),
  lastSeenAt: tsCol("last_seen_at").notNull().defaultNow(),
  expiresAt: tsCol("expires_at").notNull(),
  revokedAt: tsCol("revoked_at"),
});

export const webauthnCredentials = pgTable("webauthn_credentials", {
  id: text("id").primaryKey(), // credential ID (base64url)
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  publicKey: text("public_key").notNull(), // base64url COSE key
  counter: integer("counter").notNull().default(0),
  transports: jsonb("transports").$type<string[]>(),
  deviceType: text("device_type"),
  backedUp: boolean("backed_up").notNull().default(false),
  createdAt: tsCol("created_at").notNull().defaultNow(),
});

// Single-row policy (id fixed to 1). Settings validated by Zod before write.
export const policy = pgTable("policy", {
  id: integer("id").primaryKey().default(1),
  settings: jsonb("settings").notNull(),
  updatedByEmail: text("updated_by_email"),
  updatedAt: tsCol("updated_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ts: tsCol("ts").notNull().defaultNow(),
  action: text("action").notNull(),
  actorEmail: text("actor_email"),
  targetType: text("target_type"),
  targetId: text("target_id"),
  tag: auditTagEnum("tag").notNull().default("info"),
  detail: jsonb("detail").$type<Record<string, unknown>>(),
  ip: text("ip"),
});

// Aggregate metadata only — never a password, hash, or user identifier tied to a check.
export const metricsDaily = pgTable("metrics_daily", {
  day: date("day").primaryKey(),
  passwordChecks: integer("password_checks").notNull().default(0),
  weakBlocked: integer("weak_blocked").notNull().default(0),
  breachedBlocked: integer("breached_blocked").notNull().default(0),
  rateLimitEvents: integer("rate_limit_events").notNull().default(0),
  suspiciousEvents: integer("suspicious_events").notNull().default(0),
  rejectionReasons: jsonb("rejection_reasons").$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
});

export const commonPasswords = pgTable("common_passwords", {
  value: text("value").primaryKey(), // stored lowercased
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type MetricsDaily = typeof metricsDaily.$inferSelect;
export type WebauthnCredential = typeof webauthnCredentials.$inferSelect;

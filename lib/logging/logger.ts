import pino from "pino";
import { env } from "../env";

/**
 * Structured logger with aggressive redaction. Even if a caller accidentally
 * passes a sensitive field, pino censors it before anything is written.
 * The security test suite asserts plaintext passwords / hashes / suffixes /
 * tokens never appear in log output.
 */
const SENSITIVE = [
  "password",
  "newPassword",
  "currentPassword",
  "hash",
  "passwordHash",
  "prefix",
  "suffix",
  "token",
  "csrf",
  "csrfToken",
  "secret",
  "totp",
  "totpSecret",
  "sessionId",
  "cookie",
  "authorization",
];

// Redact each key at root and one level deep, plus common request header paths.
// Exported so the security test can prove the exact config scrubs secrets.
export const redactPaths = [
  ...SENSITIVE,
  ...SENSITIVE.map((k) => `*.${k}`),
  "req.headers.cookie",
  "req.headers.authorization",
  'headers["set-cookie"]',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: redactPaths, censor: "[redacted]" },
  base: { app: "keyshield" },
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } }
      : undefined,
});

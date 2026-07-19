import { PassThrough } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { redactPaths } from "@/lib/logging/logger";

// Builds a logger with the EXACT redaction config used in production and captures
// its output, proving that sensitive fields never reach the log stream.
function capture(fn: (log: pino.Logger) => void): string {
  const chunks: Buffer[] = [];
  const stream = new PassThrough();
  stream.on("data", (c: Buffer) => chunks.push(c));
  const log = pino({ redact: { paths: redactPaths, censor: "[redacted]" } }, stream);
  fn(log);
  return Buffer.concat(chunks).toString("utf8");
}

describe("log redaction (security invariant)", () => {
  it("scrubs passwords, hashes, suffixes, tokens, and MFA secrets — at root and nested", () => {
    const out = capture((log) =>
      log.info(
        {
          password: "hunter2",
          passwordHash: "$argon2id$secret",
          prefix: "7C4A8",
          suffix: "09CA3762AF61E59520943DC26494F8941B",
          token: "csrf-token-value",
          totpSecret: "KS5DEMOADMINSEEDTOTPBASE32SECRET",
          user: { password: "nested-pw" },
        },
        "sensitive attempt",
      ),
    );

    for (const secret of [
      "hunter2",
      "$argon2id$secret",
      "7C4A8",
      "09CA3762AF61E59520943DC26494F8941B",
      "csrf-token-value",
      "KS5DEMOADMINSEEDTOTPBASE32SECRET",
      "nested-pw",
    ]) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain("[redacted]");
  });
});

/**
 * Regenerates the offline enterprise breach corpus from the common-password
 * blocklist. In production you would replace this with the real downloaded HIBP
 * SHA-1 corpus; this gives offline mode + tests something deterministic to hit.
 * Run: `tsx lib/breach/build-corpus.ts`
 */
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { COMMON_PASSWORDS } from "../db/common-passwords";

async function main(): Promise<void> {
  const lines = [...new Set(COMMON_PASSWORDS)].map((pw) => {
    const hash = createHash("sha1").update(pw, "utf8").digest("hex").toUpperCase();
    const count = 1000 + ((hash.charCodeAt(0) * 7919) % 4_000_000); // deterministic demo count
    return `${hash}:${count}`;
  });
  await writeFile(resolve(process.cwd(), "lib/breach/offline-corpus.txt"), lines.join("\n") + "\n", "utf8");
  console.log(`wrote ${lines.length} hashes to lib/breach/offline-corpus.txt`);
}

void main();

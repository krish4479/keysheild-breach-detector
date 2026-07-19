import { hash, verify, type Algorithm } from "@node-rs/argon2";

// OWASP Password Storage Cheat Sheet baseline for Argon2id: m=19 MiB, t=2, p=1.
// Salt is generated per-hash by the library and encoded into the output string.
// `2` is Algorithm.Argon2id — referenced as a literal to avoid the const-enum
// value access that isolatedModules forbids.
const HASH_OPTS = {
  algorithm: 2 as Algorithm,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, HASH_OPTS);
}

export async function verifyPassword(encoded: string, password: string): Promise<boolean> {
  try {
    return await verify(encoded, password);
  } catch {
    return false;
  }
}

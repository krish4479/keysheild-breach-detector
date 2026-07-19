import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { commonPasswords, policy } from "../db/schema";
import { defaultPolicy, policySettingsSchema, type PolicySettings } from "./index";

/** Load the DB-stored policy, falling back to defaults if unset/invalid/unreachable. */
export async function getActivePolicy(): Promise<PolicySettings> {
  try {
    const rows = await db.select().from(policy).where(eq(policy.id, 1)).limit(1);
    const row = rows[0];
    if (!row) return defaultPolicy;
    const parsed = policySettingsSchema.safeParse(row.settings);
    return parsed.success ? parsed.data : defaultPolicy;
  } catch {
    return defaultPolicy;
  }
}

export async function saveActivePolicy(settings: PolicySettings, updatedByEmail: string): Promise<void> {
  await db
    .insert(policy)
    .values({ id: 1, settings, updatedByEmail })
    .onConflictDoUpdate({ target: policy.id, set: { settings, updatedByEmail, updatedAt: new Date() } });
}

export async function isCommonPassword(password: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ value: commonPasswords.value })
      .from(commonPasswords)
      .where(eq(commonPasswords.value, password.toLowerCase()))
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

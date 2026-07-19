import { expect, test } from "@playwright/test";
import { generate } from "otplib";

const SHOTS = "tests/e2e/screenshots";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@keyshield.local";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "correct-horse-battery-staple-42";
const SECRET = process.env.ADMIN_TOTP_SECRET ?? "KS5DEMOADMINSEEDTOTPBASE32SECRET";

test("unauthenticated admin routes redirect to login", async ({ page }) => {
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("admin signs in with password + TOTP and sees the seeded dashboard", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /continue/i }).click();

  await expect(page.getByLabel("6-digit code")).toBeVisible();
  const code = await generate({ secret: SECRET });
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: /verify/i }).click();

  await expect(page.getByRole("heading", { name: /security dashboard/i })).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `${SHOTS}/admin-dashboard.png`, fullPage: true });

  await page.goto("/admin/policy");
  await expect(page.getByRole("heading", { name: /password policy/i })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/admin-policy.png`, fullPage: true });

  await page.goto("/admin/audit-logs");
  await expect(page.getByRole("heading", { name: /audit log/i })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/admin-audit.png`, fullPage: true });
});

import { expect, test } from "@playwright/test";

const SHOTS = "tests/e2e/screenshots";

test("landing page renders and links to the checker", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /security instrument/i })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/landing.png`, fullPage: true });
});

test("checker does live local strength analysis", async ({ page }) => {
  await page.goto("/checker");
  const input = page.getByLabel("Password to test");

  await input.fill("123456");
  await expect(page.locator(".badge-strength")).toHaveText("Weak");

  await input.fill("correct horse battery staple 9x!");
  await expect(page.locator(".badge-strength")).toHaveText("Strong");

  await page.screenshot({ path: `${SHOTS}/checker.png`, fullPage: true });
});

test("checker flags a breached password after blur", async ({ page }) => {
  await page.goto("/checker");
  const input = page.getByLabel("Password to test");
  await input.fill("password");
  await input.blur();
  await expect(page.locator(".breach.bad")).toContainText(/known breaches/i, { timeout: 15_000 });
});

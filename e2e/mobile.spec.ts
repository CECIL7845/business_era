import { expect, test } from "@playwright/test";

test("demo business works on a phone-sized screen", async ({ page }) => {
  const stamp = Date.now().toString(36);
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Efua Mobile");
  await page.getByLabel("Email").fill(`mobile-${stamp}@example.com`);
  await page.getByLabel("Password").fill("strongpass123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("button", { name: "Explore with sample data" }).click();
  await expect(page).toHaveURL(/\/app$/, { timeout: 45_000 });
  await expect(page.getByText(/demo business with fictional sample data/)).toBeVisible();
  await expect(page.getByText("Who to chase today")).toBeVisible();
  // No horizontal scrolling on a phone
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  // Bottom navigation works
  await page.getByRole("navigation", { name: "Quick" }).getByRole("link", { name: "Customers" }).click();
  await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
  await page.getByRole("link", { name: "Overdue", exact: true }).click();
  await expect(page).toHaveURL(/filter=overdue/);
  await page.locator("main ul li a").first().click();
  await expect(page.getByRole("link", { name: "WhatsApp reminder" })).toHaveAttribute("href", /^https:\/\/wa\.me\/233\d{9}\?text=/);
});

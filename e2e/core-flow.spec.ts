import { expect, test, type Page } from "@playwright/test";

const stamp = Date.now().toString(36);

async function register(page: Page, email: string, name = "Kwame Owner") {
  await page.goto("/register");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Phone (optional)").fill("024 555 0101");
  await page.getByLabel("Password").fill("strongpass123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
}

test("register → onboard → product → customer → credit sale → limit block → payment → statement", async ({ page }) => {
  const email = `owner-${stamp}@example.com`;
  await register(page, email);

  // Onboarding
  await page.getByLabel("Business name").fill(`Asante Distributors ${stamp}`);
  await page.getByLabel("Business phone").fill("0201234567");
  await page.getByLabel("Town / city").fill("Kumasi");
  await page.getByRole("button", { name: "Create my business" }).click();
  await expect(page).toHaveURL(/\/app\?welcome=1/);
  await expect(page.getByText("14-day free trial started")).toBeVisible();

  // Product
  await page.goto("/app/products/new");
  await page.getByLabel("Product name").fill("Rice 25kg");
  await page.getByLabel("Selling unit").fill("bag");
  await page.getByLabel("Selling price per unit (GH₵)").fill("495.00");
  await page.getByLabel("Opening stock (units)").fill("20");
  await page.getByLabel("Low-stock alert at").fill("5");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(page.getByText("20 bag in stock")).toBeVisible();

  // Customer with validation error first (bad phone), then fixed
  await page.goto("/app/customers/new");
  await page.getByLabel("Shop / customer name").fill("Auntie Ama Provisions");
  await page.getByLabel("Phone (MoMo / WhatsApp)").fill("12345");
  await page.getByLabel("Credit limit (GH₵)").fill("1,000");
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(page.getByText("Enter a valid Ghana number")).toBeVisible();
  await expect(page.getByLabel("Shop / customer name")).toHaveValue("Auntie Ama Provisions"); // input kept
  await page.getByLabel("Phone (MoMo / WhatsApp)").fill("024 123 4567");
  await page.getByRole("button", { name: "Save customer" }).click();
  await expect(page.getByRole("heading", { name: "Auntie Ama Provisions" })).toBeVisible();
  const customerUrl = page.url();

  // Credit sale of 2 bags (GH₵990) — within the 1,000 limit
  await page.getByRole("link", { name: "New invoice" }).first().click();
  await page.getByLabel("Product for line 1").selectOption({ label: "Rice 25kg (20 bag)" });
  await page.getByLabel("Quantity for line 1").fill("2");
  await expect(page.getByText("GH₵990.00").first()).toBeVisible();
  await page.getByRole("button", { name: "Save invoice" }).click();
  await expect(page.getByText("Invoice saved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Invoice INV-00001/ })).toBeVisible();
  const invoiceUrl = page.url();

  // Second sale would exceed the limit → blocked, then owner overrides
  await page.goto(`${customerUrl.replace(/\?.*/, "")}`);
  await page.getByRole("link", { name: "New invoice" }).first().click();
  await page.getByLabel("Product for line 1").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Save invoice" }).click();
  await expect(page.getByText(/above their credit limit/)).toBeVisible();
  await page.getByLabel(/Override credit limit/).check();
  await page.getByRole("button", { name: "Save invoice" }).click();
  await expect(page.getByRole("heading", { name: /Invoice INV-00002/ })).toBeVisible();

  // Record a MoMo payment of GH₵1,000
  await page.goto(customerUrl.replace(/\?.*/, ""));
  await page.getByRole("link", { name: "Record payment" }).first().click();
  await page.getByLabel("Amount (GH₵)").fill("1000");
  await page.getByLabel("Method").selectOption("MOMO");
  await page.getByLabel("Transaction ID / reference").fill(`MP${stamp}`);
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/balance is now GH₵485.00/)).toBeVisible();

  // Same MoMo reference again is rejected
  await page.goto(`/app/payments/new`);
  await page.getByLabel("Customer").selectOption({ label: "Auntie Ama Provisions" });
  await page.getByLabel("Amount (GH₵)").fill("10");
  await page.getByLabel("Transaction ID / reference").fill(`MP${stamp}`);
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/was already recorded/).first()).toBeVisible();

  // Invoice 1 is now fully paid
  await page.goto(invoiceUrl.replace(/\?.*/, ""));
  await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();

  // Dashboard shows real numbers
  await page.goto("/app");
  await expect(page.getByText("Owed to you")).toBeVisible();
  await expect(page.getByText("GH₵485.00").first()).toBeVisible();
  await expect(page.getByText("GH₵1,000.00").first()).toBeVisible();

  // Statement
  await page.goto(customerUrl.replace(/\?.*/, "") + "/statement");
  await expect(page.getByText("Closing balance")).toBeVisible();
  await expect(page.locator("td", { hasText: "GH₵485.00" }).last()).toBeVisible();

  // Stock was reduced by 3 bags
  await page.goto("/app/products");
  await expect(page.getByText("17 bag")).toBeVisible();

  // Void the second invoice with a reason
  await page.goto("/app/invoices?status=open");
  await page.getByRole("link", { name: /INV-00002/ }).click();
  await page.getByRole("button", { name: "Void" }).click();
  await page.getByLabel(/Reason/).fill("Customer returned goods");
  await page.getByRole("button", { name: "Void invoice" }).click();
  await expect(page.getByText("This invoice is void")).toBeVisible();

  // Activity log records it
  await page.goto("/app/activity");
  await expect(page.getByText("Voided invoice")).toBeVisible();
  await expect(page.getByText("Created invoice ABOVE credit limit")).toBeVisible();

  // Sign out, then sign in again
  await page.goto("/app/account");
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong-password1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  await page.getByLabel("Password").fill("strongpass123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);

  // Another tenant cannot open this invoice
  const other = await page.context().browser()!.newContext();
  const p2 = await other.newPage();
  await register(p2, `intruder-${stamp}@example.com`, "Intruder");
  await p2.getByLabel("Business name").fill(`Other Co ${stamp}`);
  await p2.getByRole("button", { name: "Create my business" }).click();
  await expect(p2).toHaveURL(/\/app/);
  // Streaming (loading.tsx) means the status may already be 200 when notFound() runs;
  // what matters is that the not-found page renders and no foreign data is present.
  await p2.goto(invoiceUrl.replace(/\?.*/, ""));
  await expect(p2.getByText("We couldn't find that page")).toBeVisible();
  await expect(p2.getByText("Auntie Ama")).toHaveCount(0);
  expect(await p2.content()).not.toContain("Auntie Ama");
  const csv = await p2.request.get("/api/export/customers");
  expect(await csv.text()).not.toContain("Auntie Ama");
  await other.close();
});

test("public pages, security headers and API guards", async ({ page, request }) => {
  const res = await page.goto("/");
  expect(res?.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(res?.headers()["x-frame-options"]).toBe("DENY");
  await expect(page.getByRole("heading", { name: /Stop losing money/ })).toBeVisible();
  await expect(page.getByText("GH₵249.00").first()).toBeVisible();
  await page.goto("/privacy");
  await expect(page.getByText("Draft for legal review")).toBeVisible();

  expect((await request.get("/api/health")).status()).toBe(200);
  expect((await request.post("/api/cron/daily")).status()).toBe(401);
  expect((await request.post("/api/cron/daily", { headers: { authorization: "Bearer e2e-cron-secret-0123456789" } })).status()).toBe(200);
  expect((await request.post("/api/webhooks/paystack", { data: { event: "charge.success", data: { reference: "bz_x" } }, headers: { "x-paystack-signature": "forged" } })).status()).toBe(401);
  expect((await request.get("/api/export/customers")).status()).toBe(401);
});

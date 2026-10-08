import { alertBox, createUser, logout, E2E_GCASH, expect, gcashRef, login, PNG, submitPayment, svc, test } from "./support";

test.describe("agent: plans and payments", () => {
  test("new agent starts on Free with usage meters", async ({ page, agent }) => {
    await login(page, agent);
    await expect(page.getByRole("heading", { name: `Hi, ${agent.name.split(" ")[0]}` })).toBeVisible();
    await expect(page.getByText("You're on the Free plan.")).toBeVisible();
    await expect(page.getByText("0 / 5", { exact: true })).toBeVisible(); // active listings
    await expect(page.getByText("0 / 50", { exact: true })).toBeVisible(); // leads
    await expect(page.getByText("0 / 10", { exact: true })).toBeVisible(); // AI
  });

  test("pricing shows all plans and marks the current one", async ({ page, agent }) => {
    await login(page, agent);
    await page.goto("/pricing");
    for (const price of ["₱0", "₱199", "₱399"]) await expect(page.getByText(price, { exact: true })).toBeVisible();
    await expect(page.getByText("Your current plan")).toBeVisible();
    await page.getByRole("link", { name: "Upgrade to Pro" }).click();
    await expect(page).toHaveURL(/\/payment\?plan=pro/);
  });

  test("payment page shows GCash instructions and server price", async ({ page, agent }) => {
    await login(page, agent);
    await page.goto("/payment?plan=pro");
    await expect(page.getByRole("heading", { name: "Upgrade to Pro" })).toBeVisible();
    const { data: settings } = await svc().from("app_settings").select("gcash_number").single();
    await expect(page.getByText(settings?.gcash_number ?? E2E_GCASH.number)).toBeVisible();
    await expect(page.getByText("Send exactly ₱399 using GCash.")).toBeVisible();
  });

  test("invalid plans redirect to pricing", async ({ page, agent }) => {
    await login(page, agent);
    for (const plan of ["free", "enterprise"]) {
      await page.goto(`/payment?plan=${plan}`);
      await expect(page).toHaveURL(/\/pricing/);
    }
  });

  test("reference number is validated", async ({ page, agent }) => {
    await login(page, agent);
    await page.goto("/payment?plan=starter");
    await page.getByRole("button", { name: "I've paid" }).click();
    await page.getByLabel("GCash reference number").fill("abc");
    await page.getByRole("button", { name: "Submit payment" }).click();
    await expect(alertBox(page)).toContainText("GCash reference number");
  });

  test("non-image screenshots are rejected", async ({ page, agent }) => {
    await login(page, agent);
    await page.goto("/payment?plan=starter");
    await page.getByRole("button", { name: "I've paid" }).click();
    await page.getByLabel("GCash reference number").fill(gcashRef());
    await page.getByLabel("Screenshot (optional)").setInputFiles({
      name: "receipt.png",
      mimeType: "image/png",
      buffer: Buffer.from("<svg onload=alert(1)>not really a png</svg>"),
    });
    await page.getByRole("button", { name: "Submit payment" }).click();
    await expect(alertBox(page)).toHaveText("Screenshots must be JPG, PNG or WebP images.");
    const { count } = await svc().from("payments").select("id", { count: "exact", head: true }).eq("agent_id", agent.id);
    expect(count).toBe(0);
  });

  test("submitting a payment creates a PENDING request with the server price", async ({ page, agent }) => {
    await login(page, agent);
    const ref = await submitPayment(page, "pro", undefined, PNG);
    await expect(page).toHaveURL(/\/payment\/pending/);
    await expect(page.getByText("Waiting for approval")).toBeVisible();
    await expect(page.getByText(ref)).toBeVisible();
    await expect(page.getByText("₱399")).toBeVisible();

    const { data } = await svc().from("payments").select("*").eq("agent_id", agent.id).single();
    expect(data).toMatchObject({ status: "PENDING", amount_centavos: 39900, plan_id: "pro", gcash_reference: ref });
    expect(data!.screenshot_path).toMatch(new RegExp(`^${agent.id}/.+\\.png$`));

    // Plan is not active yet.
    await page.goto("/dashboard");
    await expect(page.getByText("You're on the Free plan.")).toBeVisible();
    await expect(page.getByText("Your Pro payment is waiting for approval.")).toBeVisible();
  });

  test("only one pending payment at a time", async ({ page, agent }) => {
    await login(page, agent);
    await submitPayment(page, "starter");
    await page.goto("/payment?plan=pro");
    await expect(page.getByRole("heading", { name: "Payment already submitted" })).toBeVisible();
  });

  test("payment history lists the agent's own payments only", async ({ page, agent }) => {
    const other = await createUser();
    await login(page, other);
    const otherRef = await submitPayment(page, "starter");
    await logout(page);

    await login(page, agent);
    const ref = await submitPayment(page, "starter");
    await page.goto("/payment/history");
    await expect(page.getByRole("cell", { name: ref })).toBeVisible();
    await expect(page.getByText(otherRef)).toHaveCount(0);
  });
});

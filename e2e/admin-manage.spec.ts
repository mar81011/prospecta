import { alertBox, createUser, expect, login, logout, submitPayment, svc, test } from "./support";

test.describe("admin: management", () => {
  test("overview shows the dashboard numbers and pending queue", async ({ page, agent, admin }) => {
    await login(page, agent);
    const ref = await submitPayment(page, "pro");
    await logout(page);

    await login(page, admin);
    await page.getByRole("link", { name: "Admin" }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    for (const label of ["Agents", "Paid agents", "Free agents", "Pending payments", "Revenue this month", "Expiring in 7 days"]) {
      await expect(page.getByRole("main").getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("row").filter({ hasText: ref })).toBeVisible();
  });

  test("agent list: search and filters", async ({ page, admin }) => {
    const target = await createUser({ name: `Zed Searchable ${Date.now()}` });
    await login(page, admin);
    await page.goto("/admin/agents");
    await page.getByLabel("Search agents").fill(target.email);
    await page.getByLabel("Search agents").press("Enter");
    await expect(page.getByRole("row").filter({ hasText: target.email })).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(2); // header + match
    await page.getByRole("link", { name: "Paid", exact: true }).click();
    await expect(page.getByText("No agents match.")).toBeVisible();
  });

  test("manual plan change is applied and audited", async ({ page, agent, admin }) => {
    await login(page, admin);
    await page.goto(`/admin/agents/${agent.id}`);
    await page.getByLabel("Plan").selectOption("starter");
    const inTenDays = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel("Expires on").fill(inTenDays);
    await page.getByLabel("Note for the audit log").fill("E2E complimentary access");
    await page.getByRole("button", { name: "Save plan" }).click();
    await expect(page.getByText("Plan updated.")).toBeVisible();

    const { data } = await svc().from("profiles").select("plan, plan_status").eq("id", agent.id).single();
    expect(data).toMatchObject({ plan: "starter", plan_status: "active" });

    await page.goto("/admin/audit-logs");
    await expect(page.getByRole("row").filter({ hasText: "ADMIN_CHANGED_PLAN" }).filter({ hasText: "E2E complimentary access" })).toBeVisible();
  });

  test("role management: promote, demote, cannot change own role", async ({ page, agent, admin }) => {
    await login(page, admin);
    await page.goto(`/admin/agents/${agent.id}`);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Make admin" }).click();
    await expect(page.getByRole("button", { name: "Remove admin" })).toBeVisible();
    expect((await svc().from("profiles").select("role").eq("id", agent.id).single()).data!.role).toBe("admin");

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Remove admin" }).click();
    await expect(page.getByRole("button", { name: "Make admin" })).toBeVisible();

    await page.goto(`/admin/agents/${admin.id}`);
    await expect(page.getByRole("button", { name: /admin/i })).toHaveCount(0);
  });

  test("invite: validates and refuses existing accounts", async ({ page, agent, admin }) => {
    // A successful invite sends an email (rate limited), so only the refusal paths run here.
    await login(page, admin);
    await page.goto("/admin/agents");
    await page.getByLabel("Full name").fill("Already Registered");
    await page.getByLabel("Email").fill(agent.email);
    await page.getByRole("button", { name: "Send invitation" }).click();
    await expect(alertBox(page)).toHaveText("An account with this email already exists.");
  });

  test("settings: validation and save change the payment page", async ({ page, agent, admin }) => {
    await login(page, admin);
    await page.goto("/admin/settings");
    // Skip the browser's own email check to exercise server-side validation.
    await page
      .locator("form")
      .filter({ has: page.getByLabel("Support email") })
      .evaluate((f: HTMLFormElement) => (f.noValidate = true));
    await page.getByLabel("Support email").fill("not-an-email");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(alertBox(page)).toHaveText("Enter a valid support email.");

    await page.getByLabel("Support email").fill("help@example.com");
    await page.getByLabel("GCash number").fill("0918 777 1234");
    await page.getByLabel("GCash account name").fill("Prospecta Test Account");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();
    await logout(page);

    await login(page, agent);
    await page.goto("/payment?plan=starter");
    await expect(page.getByText("0918 777 1234")).toBeVisible();
    await expect(page.getByText("Prospecta Test Account")).toBeVisible();
    await expect(page.getByRole("link", { name: "help@example.com" })).toBeVisible();
  });

  test("plans: price change shows on pricing and applies to new payments", async ({ page, agent, admin }) => {
    await login(page, admin);
    await page.goto("/admin/plans");
    const starter = page.locator("form").filter({ hasText: "Starter" });
    await starter.getByLabel("Price (₱)").fill("249");
    await starter.getByRole("button", { name: "Save Starter" }).click();
    await expect(starter.getByText(/Plan saved/)).toBeVisible();

    const free = page.locator("form").filter({ hasText: "Free" });
    await expect(free.getByLabel("Price (₱)")).toHaveAttribute("readonly", "");
    await logout(page);

    await login(page, agent);
    await page.goto("/pricing");
    await expect(page.getByText("₱249", { exact: true })).toBeVisible();
    await submitPayment(page, "starter");
    const { data } = await svc().from("payments").select("amount_centavos").eq("agent_id", agent.id).single();
    expect(data!.amount_centavos).toBe(24900);
  });

  test.afterEach(async () => {
    // Undo the price change right away so later tests see the normal price.
    await svc().from("plans").update({ price_centavos: 19900 } as never).eq("id", "starter").neq("price_centavos", 19900);
  });

  test("audit log records payment activity", async ({ page, agent, admin }) => {
    await login(page, agent);
    await submitPayment(page, "pro");
    await logout(page);
    await login(page, admin);
    await page.goto("/admin/audit-logs");
    await expect(page.getByRole("row").filter({ hasText: "AGENT_SUBMITTED_PAYMENT" }).first()).toBeVisible();
  });
});

import { alertBox, createUser, expect, gcashRef, login, logout, paymentIdFor, PNG, submitPayment, svc, test } from "./support";

test.describe("admin: payment review", () => {
  test("agents cannot see admin pages", async ({ page, agent }) => {
    await login(page, agent);
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
    for (const path of ["/admin", "/admin/payments", "/admin/settings"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(404);
    }
  });

  test("approve: activates the plan for 30 days and notifies the agent", async ({ page, agent, admin }) => {
    await login(page, agent);
    const ref = await submitPayment(page, "pro", undefined, PNG);
    const paymentId = await paymentIdFor(agent.id);
    await logout(page);

    await login(page, admin);
    await page.goto("/admin/payments");
    const row = page.getByRole("row").filter({ hasText: ref });
    await expect(row).toContainText(agent.email);
    await expect(row).toContainText("₱399");
    await row.getByRole("link", { name: "Review" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/payments/${paymentId}`));
    await expect(page.getByText(ref).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /View screenshot/ })).toBeVisible();

    await page.getByRole("button", { name: "Approve payment" }).click();
    await page.getByRole("button", { name: "Yes, approve" }).click();
    await expect(page.getByText("Payment approved and plan activated.")).toBeVisible();
    await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();

    const { data: profile } = await svc().from("profiles").select("plan, plan_status, plan_expires_at").eq("id", agent.id).single();
    expect(profile).toMatchObject({ plan: "pro", plan_status: "active" });
    const days = (new Date(profile!.plan_expires_at!).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    await logout(page);

    await login(page, agent);
    await expect(page.getByText(/Active until/)).toBeVisible();
    await expect(page.getByText("PRO", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/fair use/).first()).toBeVisible(); // Pro has no fixed limits
    await page.goto("/notifications");
    await expect(page.getByText(/Your Pro plan is now active until/)).toBeVisible();
  });

  test("reject: requires a reason and the agent sees it", async ({ page, agent, admin }) => {
    await login(page, agent);
    await submitPayment(page, "starter");
    const paymentId = await paymentIdFor(agent.id);
    await logout(page);

    await login(page, admin);
    await page.goto(`/admin/payments/${paymentId}`);
    await page.getByLabel("Reason").selectOption("Other");
    await page.getByLabel("Details (required)").evaluate((el: HTMLTextAreaElement) => el.removeAttribute("required"));
    await page.getByRole("button", { name: "Reject payment" }).click();
    await expect(alertBox(page)).toHaveText("Describe the reason when choosing Other.");

    await page.getByLabel("Reason").selectOption("Reference not found");
    await page.getByLabel("Details (optional)").fill("No matching transaction on Oct 9");
    await page.getByRole("button", { name: "Reject payment" }).click();
    await expect(page.getByText("Payment rejected.")).toBeVisible();
    await logout(page);

    await login(page, agent);
    await expect(page.getByText(/Your last payment could not be verified: Reference not found: No matching transaction/)).toBeVisible();
    await page.goto("/payment/pending");
    await expect(page.getByText("Payment could not be verified.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Submit a new payment" })).toBeVisible();
    const { data } = await svc().from("profiles").select("plan").eq("id", agent.id).single();
    expect(data!.plan).toBe("free");
  });

  test("a GCash reference cannot be approved twice", async ({ page, admin }) => {
    const a = await createUser();
    const b = await createUser();
    const ref = gcashRef();
    for (const u of [a, b]) {
      await login(page, u);
      await submitPayment(page, "starter", ref);
      await logout(page);
    }
    const [pa, pb] = [await paymentIdFor(a.id), await paymentIdFor(b.id)];

    await login(page, admin);
    await page.goto(`/admin/payments/${pb}`);
    await expect(page.getByText(/also appears on 1 other payment/)).toBeVisible();
    await page.goto(`/admin/payments/${pa}`);
    await page.getByRole("button", { name: "Approve payment" }).click();
    await page.getByRole("button", { name: "Yes, approve" }).click();
    await expect(page.getByText("Payment approved and plan activated.")).toBeVisible();

    await page.goto(`/admin/payments/${pb}`);
    await page.getByRole("button", { name: "Approve payment" }).click();
    await page.getByRole("button", { name: "Yes, approve" }).click();
    await expect(alertBox(page)).toContainText("already been used");
    const { data } = await svc().from("profiles").select("plan").eq("id", b.id).single();
    expect(data!.plan).toBe("free");
  });

  test("renewal extends an active plan by 30 days", async ({ page, agent, admin }) => {
    const approve = async () => {
      const id = await paymentIdFor(agent.id);
      await login(page, admin);
      await page.goto(`/admin/payments/${id}`);
      await page.getByRole("button", { name: "Approve payment" }).click();
      await page.getByRole("button", { name: "Yes, approve" }).click();
      await expect(page.getByText("Payment approved and plan activated.")).toBeVisible();
      await logout(page);
    };
    const expiry = async () =>
      new Date((await svc().from("profiles").select("plan_expires_at").eq("id", agent.id).single()).data!.plan_expires_at!);

    await login(page, agent);
    await submitPayment(page, "starter");
    await logout(page);
    await approve();
    const first = await expiry();

    await login(page, agent);
    await page.goto("/payment?plan=starter");
    await expect(page.getByRole("heading", { name: "Renew Starter" })).toBeVisible();
    await expect(page.getByText(/Renewing adds 30 days on top of that date/)).toBeVisible();
    await submitPayment(page, "starter");
    await logout(page);
    await approve();

    expect(Math.round(((await expiry()).getTime() - first.getTime()) / 86_400_000)).toBe(30);
  });

  test("payment tabs filter by status", async ({ page, agent, admin }) => {
    await login(page, agent);
    const ref = await submitPayment(page, "starter");
    await logout(page);
    await login(page, admin);
    await page.goto("/admin/payments?status=APPROVED");
    await expect(page.getByText(ref)).toHaveCount(0);
    await page.getByRole("link", { name: /^Pending/ }).click();
    await expect(page.getByText(ref)).toBeVisible();
  });
});

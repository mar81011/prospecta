import { expect, login, svc, test } from "./support";

const setPlan = (id: string, plan: string, status: string, expiresInDays: number) =>
  svc()
    .from("profiles")
    .update({
      plan,
      plan_status: status,
      plan_expires_at: new Date(Date.now() + expiresInDays * 86_400_000).toISOString(),
    } as never)
    .eq("id", id);

test.describe("subscriptions and notifications", () => {
  test("renewal banner appears within 5 days of expiry", async ({ page, agent }) => {
    await setPlan(agent.id, "pro", "active", 3.5);
    await login(page, agent);
    await expect(page.getByText(/Your Pro plan expires in 4 days/)).toBeVisible();
    await page.getByRole("link", { name: "Renew Pro" }).click();
    await expect(page).toHaveURL(/\/payment\?plan=pro/);
    await expect(page.getByRole("heading", { name: "Renew Pro" })).toBeVisible();
  });

  test("an expired plan falls back to Free without losing data", async ({ page, agent }) => {
    await setPlan(agent.id, "pro", "active", 10);
    const rows = Array.from({ length: 8 }, (_, i) => ({ agent_id: agent.id, title: `Pro listing ${i}`, city: "Cebu" }));
    await svc().from("listings").insert(rows);
    await setPlan(agent.id, "pro", "active", -1);

    await login(page, agent);
    await expect(page.getByText(/Your paid plan expired on/)).toBeVisible();
    await expect(page.getByText("You're on the Free plan.")).toBeVisible();
    await expect(page.getByText("8 / 5", { exact: true })).toBeVisible();
    await page.goto("/listings");
    await expect(page.getByRole("heading", { name: /Pro listing/ })).toHaveCount(8);
    await page.goto("/listings/new");
    await expect(page.getByText(/reached your plan's limit of 5/)).toBeVisible();
  });

  test("daily cron marks lapsed plans expired and is protected by a secret", async ({ request, agent }) => {
    const denied = await request.get("/api/cron/subscriptions");
    expect(denied.status()).toBe(401);
    const wrong = await request.get("/api/cron/subscriptions", { headers: { authorization: "Bearer wrong" } });
    expect(wrong.status()).toBe(401);

    await setPlan(agent.id, "starter", "active", -0.01);
    const ok = await request.get("/api/cron/subscriptions", {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).ok).toBe(true);

    const { data } = await svc().from("profiles").select("plan, plan_status").eq("id", agent.id).single();
    expect(data).toEqual({ plan: "starter", plan_status: "expired" });
    const { data: notes } = await svc().from("notifications").select("type").eq("user_id", agent.id);
    expect(notes!.map((n) => n.type)).toContain("plan_expired");
  });

  test("notification badge and mark-all-read", async ({ page, agent }) => {
    await svc()
      .from("notifications")
      .insert([
        { user_id: agent.id, type: "test", title: "First notice", body: "Hello" },
        { user_id: agent.id, type: "test", title: "Second notice", body: "World" },
      ] as never);
    await login(page, agent);
    await expect(page.getByRole("link", { name: "Notifications (2 unread)" })).toBeVisible();
    await page.getByRole("link", { name: "Notifications (2 unread)" }).click();
    await expect(page.getByText("First notice")).toBeVisible();
    await page.getByRole("button", { name: "Mark all as read" }).click();
    await expect(page.getByRole("button", { name: "Mark all as read" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Notifications", exact: true })).toBeVisible();
  });
});

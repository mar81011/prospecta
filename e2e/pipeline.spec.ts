import { expect, login, svc, test, type TestUser } from "./support";

async function seedLead(agent: TestUser, fields: Record<string, unknown> = {}) {
  const { data, error } = await svc()
    .from("leads")
    .insert({ agent_id: agent.id, name: "Maria Santos", phone: "0917 123 4567", contact: "0917 123 4567", ...fields })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id;
}

test.describe("lead pipeline", () => {
  test("open a lead, move it through stages, and see the timeline", async ({ page, agent }) => {
    await seedLead(agent);
    await login(page, agent);
    await page.goto("/leads");
    await page.getByTestId("lead-row").filter({ hasText: "Maria Santos" }).getByRole("link").click();
    await page.waitForURL(/\/leads\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: "Maria Santos" })).toBeVisible();
    await expect(page.getByRole("link", { name: "📞 Call" })).toHaveAttribute("href", "tel:09171234567");

    const stages = page.getByRole("radiogroup", { name: "Lead status" });
    await expect(stages.getByRole("radio", { name: "New" })).toHaveAttribute("aria-checked", "true");
    await stages.getByRole("radio", { name: "Contacted" }).click();
    await expect(stages.getByRole("radio", { name: "Contacted" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("activity").filter({ hasText: "Status changed from New to Contacted" })).toBeVisible();

    await stages.getByRole("radio", { name: "Qualified" }).click();
    await expect(page.getByTestId("activity").filter({ hasText: "Contacted to Qualified" })).toBeVisible();
  });

  test("notes can be added and deleted", async ({ page, agent }) => {
    const id = await seedLead(agent);
    await login(page, agent);
    await page.goto(`/leads/${id}`);
    await page.getByLabel("New note").fill("Called — wants a 2BR near IT Park, budget ₱25k/month");
    await page.getByRole("button", { name: "Add note" }).click();
    const note = page.getByTestId("activity").filter({ hasText: "wants a 2BR near IT Park" });
    await expect(note).toBeVisible();
    await expect(page.getByLabel("New note")).toHaveValue("");
    page.once("dialog", (d) => d.accept());
    await note.getByRole("button", { name: "Delete" }).click();
    await expect(note).toHaveCount(0);
  });

  test("follow-ups and site viewings show on the dashboard", async ({ page, agent }) => {
    const id = await seedLead(agent, { name: "Pedro Viewer" });
    await login(page, agent);
    await page.goto(`/leads/${id}`);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    const inTwoDays = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date(Date.now() + 2 * 86_400_000));
    await page.getByLabel("Next follow-up").fill(today);
    await page.getByLabel("Site viewing").fill(`${inTwoDays}T14:30`);
    await page.getByRole("button", { name: "Save schedule" }).click();
    await expect(page.getByText("Schedule saved.")).toBeVisible();
    await expect(page.getByText("Follow-up is due today.")).toBeVisible();
    await expect(page.getByTestId("activity").filter({ hasText: /Site viewing scheduled for .* 2:30 PM/ })).toBeVisible();

    await page.goto("/dashboard");
    const today_ = page.getByTestId("today-card");
    await expect(today_.getByText("⏰ Follow-ups due (1)")).toBeVisible();
    await expect(today_.getByText("🏠 Site viewings this week (1)")).toBeVisible();
    await expect(today_.getByRole("link", { name: "Pedro Viewer" }).first()).toBeVisible();

    await page.goto("/leads");
    const row = page.getByTestId("lead-row").filter({ hasText: "Pedro Viewer" });
    await expect(row).toContainText("⏰ Follow-up due");
    await expect(row).toContainText("🏠 Viewing");
  });

  test("stage tabs filter and count leads", async ({ page, agent }) => {
    await seedLead(agent, { name: "Open One" });
    await seedLead(agent, { name: "Won One" });
    await svc().from("leads").update({ status: "won" }).eq("agent_id", agent.id).eq("name", "Won One");
    await login(page, agent);
    await page.goto("/leads");
    await expect(page.getByRole("link", { name: "Open (1)" })).toBeVisible();
    await expect(page.getByTestId("lead-row")).toHaveCount(1);
    await page.getByRole("link", { name: "Won (1)" }).click();
    await expect(page.getByTestId("lead-row")).toContainText("Won One");
    await page.getByRole("link", { name: "All (2)" }).click();
    await expect(page.getByTestId("lead-row")).toHaveCount(2);
  });

  test("buyer inquiries start the timeline; locked leads can't be opened", async ({ page, agent }) => {
    const { data: l } = await svc().from("listings").insert({ agent_id: agent.id, title: "Condo", city: "Cebu" }).select("slug").single();
    await page.goto(`/p/${l!.slug}`);
    await page.getByLabel("Your name").fill("Ana Buyer");
    await page.getByLabel("Mobile number").fill("0917 222 3333");
    await page.getByLabel("Message").fill("Pwede po viewing this Sunday?");
    await page.getByRole("button", { name: "Send inquiry" }).click();
    await expect(page.getByText("Inquiry sent!")).toBeVisible();

    const locked = await seedLead(agent, { name: "Hidden" });
    await svc().from("leads").update({ locked: true } as never).eq("id", locked);

    await login(page, agent);
    await page.goto("/leads");
    await page.getByTestId("lead-row").filter({ hasText: "Ana Buyer" }).getByRole("link").click();
    await expect(page.getByTestId("activity").filter({ hasText: "Inquiry: Pwede po viewing this Sunday?" })).toBeVisible();
    await expect(page.getByText("Hot").or(page.getByText("Warm")).first()).toBeVisible();

    await page.goto(`/leads/${locked}`);
    await expect(page.getByRole("heading", { name: "🔒 Locked inquiry" })).toBeVisible();
    await expect(page.getByText("Hidden")).toHaveCount(0);
  });
});

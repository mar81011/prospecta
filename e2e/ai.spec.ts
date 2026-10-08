import { alertBox, expect, login, svc, test, type TestUser } from "./support";

// The e2e server runs with AI_PROVIDER=fake (see playwright.config.ts).

const aiUsage = async (agent: TestUser) =>
  (
    await svc()
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agent.id)
      .eq("metric", "ai_generation")
  ).count ?? 0;

async function listing(agent: TestUser) {
  const { data, error } = await svc()
    .from("listings")
    .insert({ agent_id: agent.id, title: "3BR House in Talisay", city: "Talisay City", province: "Cebu", price_centavos: 450_000_000, bedrooms: 3 })
    .select("id, slug")
    .single();
  if (error) throw error;
  return data!;
}

const upgrade = (agent: TestUser, plan = "starter") =>
  svc()
    .from("profiles")
    .update({ plan, plan_status: "active", plan_expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString() } as never)
    .eq("id", agent.id);

async function exhaustAi(agent: TestUser, n = 10) {
  const rows = Array.from({ length: n }, () => ({ agent_id: agent.id, metric: "ai_generation", detail: "seed" }));
  const { error } = await svc().from("usage_events").insert(rows as never);
  if (error) throw error;
}

test.describe("AI writing tools", () => {
  test("Write with AI fills the title and description and uses 1 AI generation", async ({ page, agent }) => {
    await login(page, agent);
    await page.goto("/listings/new");
    await page.getByLabel("Property type").selectOption("condo");
    await page.getByLabel("Selling price (₱)").fill("3,500,000");
    await page.getByLabel("City / municipality").fill("Cebu City");
    await page.getByLabel("Bedrooms").fill("2");
    await page.getByRole("button", { name: "Write with AI" }).click();
    await expect(page.getByText("Draft ready.")).toBeVisible();
    await expect(page.getByLabel("Title")).toHaveValue(/Condominium in .*Cebu City/);
    await expect(page.getByLabel("Description")).toHaveValue(/₱3,500,000/);
    expect(await aiUsage(agent)).toBe(1);

    await page.getByRole("button", { name: "Save listing" }).click();
    await page.waitForURL("**/edit?created=1**");
  });

  test("Write with AI needs some details and respects the AI limit", async ({ page, agent }) => {
    await login(page, agent);
    await page.goto("/listings/new");
    await page.getByRole("button", { name: "Write with AI" }).click();
    await expect(alertBox(page)).toHaveText("Fill in at least the city and some details first.");
    expect(await aiUsage(agent)).toBe(0);

    await exhaustAi(agent);
    await page.getByLabel("City / municipality").fill("Cebu City");
    await page.getByRole("button", { name: "Write with AI" }).click();
    await expect(alertBox(page)).toContainText("AI generations");
  });

  test("AI Facebook caption includes the share link", async ({ page, agent }) => {
    const l = await listing(agent);
    await login(page, agent);
    await page.goto(`/listings/${l.id}/edit`);
    await page.getByRole("button", { name: "Write caption" }).click();
    await expect(page.getByLabel("AI caption")).toHaveValue(new RegExp(`/p/${l.slug}\\?ref=fb`));
    await expect(page.getByLabel("AI caption")).toHaveValue(/FOR SALE: 3BR House in Talisay/);
  });

  test("Analyze lead adds an AI note and can apply the suggested stage", async ({ page, agent }) => {
    const { data: lead } = await svc()
      .from("leads")
      .insert({ agent_id: agent.id, name: "Maria", phone: "0917", message: "Can I schedule a viewing on Saturday?", source: "facebook" })
      .select("id")
      .single();
    await login(page, agent);
    await page.goto(`/leads/${lead!.id}`);
    const panel = page.getByTestId("ai-analysis");
    await panel.getByRole("button", { name: "Analyze lead" }).click();
    await expect(panel).toContainText("hot");
    await expect(panel).toContainText("Confirm the site viewing schedule");
    await panel.getByRole("button", { name: "Move to Site viewing" }).click();
    await expect(page.getByRole("radio", { name: "Site viewing" })).toHaveAttribute("aria-checked", "true");
    await page.reload();
    await expect(page.getByTestId("activity").filter({ hasText: "AI: HOT lead" })).toBeVisible();
  });
});

test.describe("buyer chat on the listing page", () => {
  test("is not offered on the Free plan", async ({ page, agent }) => {
    const l = await listing(agent);
    await page.goto(`/p/${l.slug}`);
    await expect(page.getByTestId("buyer-chat")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send inquiry" })).toBeVisible();
  });

  test("answers buyers and turns them into leads (Starter)", async ({ page, browser, agent }) => {
    await upgrade(agent);
    const l = await listing(agent);
    await page.goto(`/p/${l.slug}?ref=fb`);
    const chat = page.getByTestId("buyer-chat");
    await chat.getByLabel("Your message").fill("Magkano po?");
    await chat.getByRole("button", { name: "Send" }).click();
    await expect(chat.getByTestId("chat-assistant").last()).toContainText("₱4,500,000");

    await chat.getByLabel("Your message").fill("Gusto ko po mag viewing");
    await chat.getByRole("button", { name: "Send" }).click();
    await expect(chat.getByTestId("chat-assistant").last()).toContainText("name and mobile number");

    await chat.getByLabel("Your message").fill("My name is Maria Santos, 0917 123 4567");
    await chat.getByRole("button", { name: "Send" }).click();
    await expect(chat.getByTestId("chat-assistant").last()).toContainText("Thanks, Maria Santos!");

    // Each reply used the agent's AI quota.
    expect(await aiUsage(agent)).toBe(3);

    const agentPage = await (await browser.newContext()).newPage();
    await login(agentPage, agent);
    await agentPage.goto("/leads");
    const row = agentPage.getByTestId("lead-row").filter({ hasText: "Maria Santos" });
    await expect(row).toContainText("Facebook");
    await expect(row).toContainText("[AI chat]");
    await row.getByRole("link").click();
    const transcript = agentPage.getByTestId("chat-transcript");
    await expect(transcript).toContainText("Buyer: Magkano po?");
    await expect(transcript).toContainText("Buyer: My name is Maria Santos, 0917 123 4567");
  });

  test("falls back to the form when the agent's AI quota is used up", async ({ page, agent }) => {
    await upgrade(agent);
    await exhaustAi(agent, 100);
    const l = await listing(agent);
    await page.goto(`/p/${l.slug}`);
    const chat = page.getByTestId("buyer-chat");
    await chat.getByLabel("Your message").fill("Is this available?");
    await chat.getByRole("button", { name: "Send" }).click();
    await expect(chat.getByText(/assistant is unavailable right now/)).toBeVisible();
    // The buyer is never told about the agent's plan.
    await expect(page.getByText(/limit|upgrade/i)).toHaveCount(0);
  });
});

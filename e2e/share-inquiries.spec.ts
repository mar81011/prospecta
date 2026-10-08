import { alertBox, createUser, expect, login, PNG, svc, test, type TestUser } from "./support";

async function createListing(agent: TestUser, overrides: Record<string, unknown> = {}) {
  const { data, error } = await svc()
    .from("listings")
    .insert({
      agent_id: agent.id,
      title: "3BR House in Talisay",
      city: "Talisay City",
      province: "Cebu",
      price_centavos: 450_000_000,
      bedrooms: 3,
      bathrooms: 2,
      description: "Near SRP. Pag-IBIG financing accepted.",
      ...overrides,
    })
    .select("id, slug")
    .single();
  if (error) throw error;
  return data!;
}

test.describe("photos", () => {
  test("upload, set cover and delete listing photos", async ({ page, agent }) => {
    const l = await createListing(agent);
    await login(page, agent);
    await page.goto(`/listings/${l.id}/edit`);
    await expect(page.getByText("No photos yet.")).toBeVisible();

    await page.getByLabel("Add photos").setInputFiles([
      { name: "front.png", mimeType: "image/png", buffer: PNG },
      { name: "kitchen.png", mimeType: "image/png", buffer: PNG },
    ]);
    await expect(page.getByText("2 photos added.")).toBeVisible();
    await expect(page.getByTestId("listing-photo")).toHaveCount(2);
    await expect(page.getByTestId("listing-photo").first()).toContainText("Cover");

    const { data: before } = await svc().from("listing_photos").select("id, path").eq("listing_id", l.id).order("position");
    await page.getByRole("button", { name: "Make cover" }).click();
    await expect.poll(async () => (await svc().from("listing_photos").select("id").eq("listing_id", l.id).order("position")).data![0].id).toBe(before![1].id);

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete" }).first().click();
    await expect(page.getByTestId("listing-photo")).toHaveCount(1);
    // The file is removed from storage too.
    const { data: files } = await svc().storage.from("listing-photos").list(`${agent.id}/${l.id}`);
    expect(files).toHaveLength(1);

    // Cover shows on the listings page.
    await page.goto("/listings");
    await expect(page.getByTestId("listing-card").locator("img")).toHaveCount(1);
  });

  test("non-image files are rejected", async ({ page, agent }) => {
    const l = await createListing(agent);
    await login(page, agent);
    await page.goto(`/listings/${l.id}/edit`);
    await page.getByLabel("Add photos").setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<script>alert(1)</script>") });
    await expect(alertBox(page)).toHaveText("Photos must be JPG, PNG or WebP images.");
  });
});

test.describe("sharing", () => {
  test("share buttons point to the Facebook dialog and public page", async ({ page, agent, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const l = await createListing(agent);
    await login(page, agent);
    await page.goto("/listings");
    const card = page.getByTestId("listing-card").filter({ hasText: "3BR House in Talisay" });
    const href = await card.getByRole("link", { name: "Share to Facebook" }).getAttribute("href");
    expect(href).toContain("https://www.facebook.com/sharer/sharer.php?u=");
    expect(decodeURIComponent(href!.split("u=")[1])).toMatch(new RegExp(`/p/${l.slug}\\?ref=fb$`));

    await card.getByRole("button", { name: "Copy caption" }).click();
    await expect(card.getByRole("button", { name: "Caption copied ✓" })).toBeVisible();
    const caption = await page.evaluate(() => navigator.clipboard.readText());
    expect(caption).toContain("FOR SALE: 3BR House in Talisay");
    expect(caption).toContain("₱4,500,000");
    expect(caption).toContain(`/p/${l.slug}?ref=fb`);
  });

  test("archived listings have no share buttons and no public page", async ({ page, agent }) => {
    const l = await createListing(agent, { status: "archived" });
    await login(page, agent);
    await page.goto("/listings");
    await expect(page.getByRole("link", { name: "Share to Facebook" })).toHaveCount(0);
    const res = await page.goto(`/p/${l.slug}`);
    expect(res?.status()).toBe(404);
  });
});

test.describe("public listing page and inquiries", () => {
  test("anyone can view an active listing with Facebook preview tags", async ({ page, agent }) => {
    await svc().from("profiles").update({ phone: "0918 222 3333" } as never).eq("id", agent.id);
    const l = await createListing(agent);
    const res = await page.goto(`/p/${l.slug}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "3BR House in Talisay" })).toBeVisible();
    await expect(page.getByText("₱4,500,000")).toBeVisible();
    await expect(page.getByText(agent.name)).toBeVisible();
    await expect(page.getByRole("link", { name: /0918 222 3333/ })).toHaveAttribute("href", "tel:09182223333");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "For sale: 3BR House in Talisay");
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", /₱4,500,000/);
    // No app navigation or private data on the public page.
    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
  });

  test("a Facebook visitor's inquiry becomes a lead and notifies the agent", async ({ page, browser, agent }) => {
    const l = await createListing(agent);
    await page.goto(`/p/${l.slug}?ref=fb`);
    await page.getByLabel("Your name").fill("Maria Buyer");
    await page.getByLabel("Mobile number").fill("0917 555 1234");
    await page.getByLabel("Message").fill("Can I view it this Saturday?");
    await page.getByRole("button", { name: "Send inquiry" }).click();
    await expect(page.getByText("Inquiry sent!")).toBeVisible();

    const agentPage = await (await browser.newContext()).newPage();
    await login(agentPage, agent);
    await expect(agentPage.getByRole("link", { name: "Notifications (1 unread)" })).toBeVisible();
    await agentPage.goto("/leads");
    const row = agentPage.getByTestId("lead-row").filter({ hasText: "Maria Buyer" });
    await expect(row).toContainText("0917 555 1234");
    await expect(row).toContainText("Facebook");
    await expect(row).toContainText("Interested in 3BR House in Talisay");
    await expect(row).toContainText("Can I view it this Saturday?");

    await agentPage.goto("/listings");
    await expect(agentPage.getByRole("link", { name: "1 lead" })).toBeVisible();
  });

  test("direct visitors are tagged as listing page", async ({ page, agent }) => {
    const l = await createListing(agent);
    await page.goto(`/p/${l.slug}`);
    await page.getByLabel("Your name").fill("Pedro Direct");
    await page.getByLabel("Email (optional)").fill("pedro@example.com");
    await page.getByRole("button", { name: "Send inquiry" }).click();
    await expect(page.getByText("Inquiry sent!")).toBeVisible();
    const { data } = await svc().from("leads").select("source, email").eq("agent_id", agent.id).single();
    expect(data).toEqual({ source: "website", email: "pedro@example.com" });
  });

  test("inquiry validation", async ({ page, agent }) => {
    const l = await createListing(agent);
    await page.goto(`/p/${l.slug}`);
    await page.getByLabel("Your name").fill("Ana");
    await page.getByRole("button", { name: "Send inquiry" }).click();
    await expect(alertBox(page)).toHaveText("Enter a phone number or email so the agent can reach you.");
    await page.getByLabel("Mobile number").fill("call me maybe");
    await page.getByRole("button", { name: "Send inquiry" }).click();
    await expect(alertBox(page)).toHaveText("Enter a valid phone number.");
    // The name the buyer typed is still there.
    await expect(page.getByLabel("Your name")).toHaveValue("Ana");
  });

  test("inquiries over the Free lead limit are locked until the agent upgrades", async ({ page, browser, agent }) => {
    const l = await createListing(agent);
    const seeded = Array.from({ length: 50 }, (_, i) => ({ agent_id: agent.id, name: `Seeded ${i}` }));
    await svc().from("leads").insert(seeded);

    await page.goto(`/p/${l.slug}?ref=fb`);
    await page.getByLabel("Your name").fill("Locked Buyer");
    await page.getByLabel("Mobile number").fill("0917 999 0000");
    await page.getByRole("button", { name: "Send inquiry" }).click();
    await expect(page.getByText("Inquiry sent!")).toBeVisible();

    const agentPage = await (await browser.newContext()).newPage();
    await login(agentPage, agent);
    await agentPage.goto("/leads");
    await expect(agentPage.getByText(/1 inquiry is locked/)).toBeVisible();
    await expect(agentPage.getByText("🔒 Locked inquiry")).toBeVisible();
    await expect(agentPage.getByText("Locked Buyer")).toHaveCount(0);
    await expect(agentPage.getByText("0917 999 0000")).toHaveCount(0);
  });

  test("agent's phone from the Account page shows on public pages", async ({ page, agent }) => {
    const l = await createListing(agent);
    await login(page, agent);
    await page.goto("/account");
    await page.getByLabel("Mobile number").fill("not a phone");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(alertBox(page)).toContainText("valid mobile number");
    await page.getByLabel("Mobile number").fill("0917 444 5566");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();
    await page.goto(`/p/${l.slug}`);
    await expect(page.getByRole("link", { name: /0917 444 5566/ })).toBeVisible();
  });

  test("unknown slugs return 404", async ({ page }) => {
    const res = await page.goto("/p/does-not-exist-12345678");
    expect(res?.status()).toBe(404);
  });
});

test("another agent's listing photos cannot be managed", async ({ page, agent }) => {
  const other = await createUser();
  const l = await createListing(other);
  await login(page, agent);
  const res = await page.goto(`/listings/${l.id}/edit`);
  expect(res?.status()).toBe(404);
});

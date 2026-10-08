import { alertBox, createUser, expect, login, logout, svc, test, type TestUser } from "./support";

async function fillListing(page: import("@playwright/test").Page, v: Record<string, string>) {
  await page.getByLabel("Title").waitFor();
  if (v.type) await page.getByText(v.type === "rent" ? "For rent" : "For sale", { exact: true }).click();
  if (v.title) await page.getByLabel("Title").fill(v.title);
  if (v.property) await page.getByLabel("Property type").selectOption(v.property);
  if (v.price !== undefined) await page.getByLabel(/price \(₱\)|rent \(₱\)/i).fill(v.price);
  if (v.address) await page.getByLabel("Address / subdivision / building").fill(v.address);
  if (v.city !== undefined) await page.getByLabel("City / municipality").fill(v.city);
  if (v.province) await page.getByLabel("Province").fill(v.province);
  if (v.bedrooms) await page.getByLabel("Bedrooms").fill(v.bedrooms);
  if (v.bathrooms) await page.getByLabel("Bathrooms").fill(v.bathrooms);
  if (v.floor) await page.getByLabel("Floor area (sqm)").fill(v.floor);
  if (v.lot) await page.getByLabel("Lot area (sqm)").fill(v.lot);
  if (v.furnishing) await page.getByLabel("Furnishing").selectOption(v.furnishing);
  if (v.description) await page.getByLabel("Description").fill(v.description);
}

async function seedListings(agent: TestUser, n: number) {
  const rows = Array.from({ length: n }, (_, i) => ({ agent_id: agent.id, title: `Seeded ${i}`, city: "Cebu City" }));
  const { error } = await svc().from("listings").insert(rows);
  if (error) throw error;
}

test.describe("listings", () => {
  test("create a sale listing with full details", async ({ page, agent }) => {
    await login(page, agent);
    await page.goto("/listings");
    await page.getByRole("link", { name: "Add listing" }).click();
    await page.waitForURL("**/listings/new");
    await fillListing(page, {
      type: "sale",
      title: "3BR house and lot in Talisay",
      property: "house_and_lot",
      price: "4,500,000",
      address: "Blk 5 Lot 12, Greenwoods Subd.",
      city: "Talisay City",
      province: "Cebu",
      bedrooms: "3",
      bathrooms: "2",
      floor: "120",
      lot: "150",
      furnishing: "semi_furnished",
      description: "Near SRP. Pag-IBIG financing accepted.",
    });
    await page.getByRole("button", { name: "Save listing" }).click();
    // New listings go straight to the photo step.
    await expect(page).toHaveURL(/\/listings\/[0-9a-f-]+\/edit\?created=1/);
    await expect(page.getByRole("heading", { name: "Listing saved — now add photos" })).toBeVisible();
    await page.goto("/listings");

    const card = page.getByTestId("listing-card").filter({ hasText: "3BR house and lot in Talisay" });
    await expect(card.getByText("For sale", { exact: true })).toBeVisible();
    await expect(card.getByText("House and lot", { exact: true })).toBeVisible();
    await expect(card.getByText("₱4,500,000")).toBeVisible();
    await expect(card.getByText("Blk 5 Lot 12, Greenwoods Subd. · Talisay City, Cebu")).toBeVisible();
    await expect(card.getByText("3 BR · 2 BA · 120 sqm floor · 150 sqm lot · Semi-furnished")).toBeVisible();
    await expect(page.getByText("1 / 5", { exact: true })).toBeVisible();
  });

  test("create a rental shows monthly rent; lot listings hide building fields", async ({ page, agent }) => {
    await login(page, agent);
    await page.goto("/listings/new");
    await fillListing(page, { type: "rent", title: "Studio condo near IT Park", property: "condo", price: "18000", city: "Cebu City", bedrooms: "0", bathrooms: "1", floor: "24", furnishing: "fully_furnished" });
    await expect(page.getByLabel("Monthly rent (₱)")).toBeVisible();
    await page.getByRole("button", { name: "Save listing" }).click();
    await page.waitForURL("**/edit?created=1**");
    await page.goto("/listings");
    await expect(page.getByText("₱18,000 / month")).toBeVisible();
    await expect(page.getByText("Studio · 1 BA · 24 sqm floor · Fully furnished")).toBeVisible();

    await page.goto("/listings/new");
    await page.getByLabel("Property type").selectOption("lot");
    await expect(page.getByLabel("Bedrooms")).toHaveCount(0);
    await expect(page.getByLabel("Floor area (sqm)")).toHaveCount(0);
    await expect(page.getByLabel("Lot area (sqm)")).toBeVisible();
  });

  test("validation errors are shown", async ({ page, agent }) => {
    await login(page, agent);
    await page.goto("/listings/new");
    await page
      .locator("form")
      .filter({ has: page.getByLabel("Title") })
      .evaluate((f: HTMLFormElement) => (f.noValidate = true));
    await fillListing(page, { title: "Nice lot", price: "abc", city: "Lapu-Lapu" });
    await page.getByRole("button", { name: "Save listing" }).click();
    await expect(alertBox(page)).toContainText("Enter a valid price");
    await fillListing(page, { price: "1000000", city: "" });
    await page.getByRole("button", { name: "Save listing" }).click();
    await expect(alertBox(page)).toHaveText("Enter the city or municipality.");
  });

  test("edit, filter, archive and reactivate", async ({ page, agent }) => {
    await login(page, agent);
    await page.goto("/listings/new");
    await fillListing(page, { type: "sale", title: "Townhouse in Mandaue", property: "townhouse", price: "3200000", city: "Mandaue City" });
    await page.getByRole("button", { name: "Save listing" }).click();
    await page.waitForURL("**/edit?created=1**");
    await fillListing(page, { type: "rent", price: "22000", title: "Townhouse in Mandaue (for rent)" });
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Listing updated.")).toBeVisible();
    await expect(page.getByText("₱22,000 / month")).toBeVisible();

    await page.getByRole("link", { name: "For sale", exact: true }).click();
    await expect(page.getByText("No listings yet.")).toBeVisible();
    await page.getByRole("link", { name: "For rent", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Townhouse in Mandaue (for rent)" })).toBeVisible();

    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("Archived", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Reactivate" }).click();
    await expect(page.getByRole("button", { name: "Archive" })).toBeVisible();
  });

  test("Free plan blocks a 6th active listing; archiving frees a slot", async ({ page, agent }) => {
    await seedListings(agent, 5);
    await login(page, agent);
    await page.goto("/listings/new");
    await expect(page.getByText("You've reached your plan's limit of 5 active listings.")).toBeVisible();
    await page.goto("/listings");
    await page.getByRole("button", { name: "Archive" }).first().click();
    await expect(page.getByText("4 / 5", { exact: true })).toBeVisible();
    await page.goto("/listings/new");
    await expect(page.getByRole("button", { name: "Save listing" })).toBeVisible();
  });

  test("reactivating over the limit shows the plan error", async ({ page, agent }) => {
    await seedListings(agent, 5);
    await svc().from("listings").update({ status: "archived" }).eq("agent_id", agent.id).eq("title", "Seeded 0");
    await svc().from("listings").insert({ agent_id: agent.id, title: "Fifth active", city: "Cebu City" });
    await login(page, agent);
    await page.goto("/listings");
    await page.getByRole("button", { name: "Reactivate" }).click();
    await expect(page.getByText(/Your plan allows 5 active listings/)).toBeVisible();
  });

  test("agents cannot open another agent's listing", async ({ page, agent }) => {
    const other = await createUser();
    const { data } = await svc().from("listings").insert({ agent_id: other.id, title: "Private", city: "Cebu" }).select("id").single();
    await login(page, agent);
    const res = await page.goto(`/listings/${data!.id}/edit`);
    expect(res?.status()).toBe(404);
    await page.goto("/listings");
    await expect(page.getByText("Private")).toHaveCount(0);
  });
});

test.describe("leads", () => {
  test("add a lead", async ({ page, agent }) => {
    await login(page, agent);
    await page.goto("/leads");
    await page.getByLabel("Lead name").fill("Maria Santos");
    await page.getByLabel("Phone or email (optional)").fill("0917 123 4567");
    await page.getByRole("button", { name: "Add lead" }).click();
    const row = page.getByTestId("lead-row").filter({ hasText: "Maria Santos" });
    await expect(row).toContainText("0917 123 4567");
    await expect(row).toContainText("Added manually");
    await expect(page.getByText("1 / 50", { exact: true })).toBeVisible();
  });

  test("monthly lead limit is enforced", async ({ page, agent }) => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ agent_id: agent.id, name: `Seeded lead ${i}` }));
    const { error } = await svc().from("leads").insert(rows);
    expect(error).toBeNull();
    await login(page, agent);
    await page.goto("/leads");
    await expect(page.getByText("50 / 50", { exact: true })).toBeVisible();
    await page.getByLabel("Lead name").fill("One too many");
    await page.getByRole("button", { name: "Add lead" }).click();
    await expect(alertBox(page)).toHaveText(/Your plan allows 50 new leads per month/);
  });
});

test("dashboard reflects listing and lead usage", async ({ page }) => {
  const agent = await createUser();
  await seedListings(agent, 2);
  await svc().from("leads").insert([{ agent_id: agent.id, name: "A" }]);
  await login(page, agent);
  await expect(page.getByText("2 / 5", { exact: true })).toBeVisible();
  await expect(page.getByText("1 / 50", { exact: true })).toBeVisible();
  await logout(page);
});

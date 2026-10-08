import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

let db: Db;

async function rejects(p: Promise<unknown>, pattern: RegExp) {
  let err: unknown;
  try {
    await p;
  } catch (e) {
    err = e;
  }
  expect(err, "expected the operation to fail").toBeDefined();
  expect(String((err as Error).message)).toMatch(pattern);
}

async function listing(agent: string, title = "3BR House in Talisay", status = "active") {
  const [row] = await db.as<{ id: string; slug: string }>(
    agent,
    `insert into public.listings (title, city, price_centavos, status) values ($1, 'Talisay City', 450000000, $2) returning id, slug`,
    [title, status],
  );
  return row;
}

const inquire = (slug: string, o: { name?: string; phone?: string; email?: string; source?: string } = {}) =>
  db.anon(`select public.submit_inquiry($1, $2, $3, $4, 'Is this still available?', $5)`, [
    slug,
    o.name ?? "Maria Buyer",
    o.phone ?? "0917 123 4567",
    o.email ?? "",
    o.source ?? "facebook",
  ]);

beforeAll(async () => {
  db = await createDb();
});

describe("slugs", () => {
  it("are generated from the title, unique, and stable when the title changes", async () => {
    const agent = await db.createUser();
    const a = await listing(agent, "3BR House & Lot — Talisay!");
    expect(a.slug).toMatch(/^3br-house-lot-talisay-[0-9a-f]{8}$/);
    const b = await listing(agent, "3BR House & Lot — Talisay!");
    expect(b.slug).not.toBe(a.slug);
    await db.as(agent, `update public.listings set title = 'Renamed' where id = $1`, [a.id]);
    const [row] = await db.root<{ slug: string }>(`select slug from public.listings where id = $1`, [a.id]);
    expect(row.slug).toBe(a.slug);
  });

  it("cannot be changed by agents", async () => {
    const agent = await db.createUser();
    const a = await listing(agent);
    await rejects(db.as(agent, `update public.listings set slug = 'hijack' where id = $1`, [a.id]), /permission denied/);
  });
});

describe("public listing page data", () => {
  it("anonymous visitors can read active listings with agent name, phone and photos", async () => {
    const agent = await db.createUser({ name: "Juan Agent" });
    await db.as(agent, `update public.profiles set phone = '0918 000 1111' where id = $1`, [agent]);
    const l = await listing(agent);
    await db.as(agent, `insert into public.listing_photos (listing_id, agent_id, path, position) values ($1, $2, 'a/b/1.jpg', 0)`, [l.id, agent]);
    const [row] = await db.anon<{ l: Record<string, unknown> }>(`select public.get_public_listing($1) as l`, [l.slug]);
    expect(row.l).toMatchObject({ title: "3BR House in Talisay", agent_name: "Juan Agent", agent_phone: "0918 000 1111", photos: ["a/b/1.jpg"] });
    expect(row.l).not.toHaveProperty("agent_id");
  });

  it("archived listings are not public", async () => {
    const agent = await db.createUser();
    const l = await listing(agent, "Old listing", "archived");
    const [row] = await db.anon<{ l: unknown }>(`select public.get_public_listing($1) as l`, [l.slug]);
    expect(row.l).toBeNull();
  });

  it("anonymous visitors cannot read tables directly", async () => {
    await rejects(db.anon(`select * from public.listings`), /permission denied/);
    await rejects(db.anon(`select * from public.leads`), /permission denied/);
  });
});

describe("photos", () => {
  it("are limited to 10 per listing and only on the agent's own listings", async () => {
    const agent = await db.createUser();
    const other = await db.createUser();
    const l = await listing(agent);
    for (let i = 0; i < 10; i++) {
      await db.as(agent, `insert into public.listing_photos (listing_id, agent_id, path) values ($1, $2, $3)`, [l.id, agent, `${agent}/${l.id}/${i}.jpg`]);
    }
    await rejects(
      db.as(agent, `insert into public.listing_photos (listing_id, agent_id, path) values ($1, $2, 'x.jpg')`, [l.id, agent]),
      /up to 10 photos/,
    );
    const mine = await listing(other);
    await rejects(
      db.as(other, `insert into public.listing_photos (listing_id, agent_id, path) values ($1, $2, 'y.jpg')`, [l.id, other]),
      /Listing not found/,
    );
    expect(mine.id).toBeTruthy();
  });

  it("the photo bucket is public, the payment screenshot bucket is not", async () => {
    const rows = await db.root<{ id: string; public: boolean }>(`select id, public from storage.buckets order by id`);
    expect(rows).toEqual([
      { id: "listing-photos", public: true },
      { id: "payment-screenshots", public: false },
    ]);
  });
});

describe("inquiries", () => {
  it("create a lead for the listing's agent, tagged with the source, and notify the agent", async () => {
    const agent = await db.createUser();
    const l = await listing(agent);
    await inquire(l.slug, { source: "facebook" });
    const leads = await db.as<{ name: string; source: string; listing_id: string; phone: string; message: string; locked: boolean }>(
      agent,
      `select name, source, listing_id, phone, message, locked from public.leads`,
    );
    expect(leads).toEqual([
      { name: "Maria Buyer", source: "facebook", listing_id: l.id, phone: "0917 123 4567", message: "Is this still available?", locked: false },
    ]);
    const notes = await db.as<{ body: string }>(agent, `select body from public.notifications where type = 'new_inquiry'`);
    expect(notes[0].body).toContain("Maria Buyer");
  });

  it("unknown sources are recorded as website", async () => {
    const agent = await db.createUser();
    const l = await listing(agent);
    await inquire(l.slug, { source: "evil'); drop table leads;--" });
    const [row] = await db.as<{ source: string }>(agent, `select source from public.leads`);
    expect(row.source).toBe("website");
  });

  it("validate input and refuse archived listings", async () => {
    const agent = await db.createUser();
    const l = await listing(agent);
    await rejects(inquire(l.slug, { name: "M" }), /Enter your name/);
    await rejects(inquire(l.slug, { phone: "", email: "" }), /phone number or email/);
    await rejects(inquire(l.slug, { phone: "call me" }), /valid phone/);
    await rejects(inquire(l.slug, { phone: "", email: "nope" }), /valid email/);
    const archived = await listing(agent, "Gone", "archived");
    await rejects(inquire(archived.slug), /no longer available/);
  });

  it("limit repeated inquiries from the same contact", async () => {
    const agent = await db.createUser();
    const l = await listing(agent);
    for (let i = 0; i < 3; i++) await inquire(l.slug, { phone: "0999 888 7777" });
    await rejects(inquire(l.slug, { phone: "0999 888 7777" }), /already sent an inquiry/);
  });

  it("over the monthly limit are kept but locked, and unlock when the agent upgrades", async () => {
    const admin = await db.createUser({ admin: true });
    const agent = await db.createUser();
    const l = await listing(agent);
    for (let i = 0; i < 50; i++) await db.as(agent, `insert into public.leads (name) values ($1)`, [`Lead ${i}`]);
    // Manual adds are blocked...
    await rejects(db.as(agent, `insert into public.leads (name) values ('manual')`), /50 new leads/);
    // ...but a buyer's inquiry is never lost.
    await inquire(l.slug, { phone: "0917 000 0001" });
    const [locked] = await db.as<{ locked: boolean }>(agent, `select locked from public.leads where listing_id = $1`, [l.id]);
    expect(locked.locked).toBe(true);
    const [note] = await db.as<{ title: string }>(agent, `select title from public.notifications where type = 'new_inquiry'`);
    expect(note.title).toBe("New inquiry (locked)");

    await rejects(db.as(agent, `update public.leads set locked = false where listing_id = $1`, [l.id]), /permission denied/);

    const [p] = await db.as<{ id: string }>(agent, `select public.submit_payment('starter', '5550001112223', (now() at time zone 'Asia/Manila')::date, null) as id`);
    await db.as(admin, `select public.approve_payment($1)`, [p.id]);
    const [unlocked] = await db.as<{ locked: boolean }>(agent, `select locked from public.leads where listing_id = $1`, [l.id]);
    expect(unlocked.locked).toBe(false);
  });
});

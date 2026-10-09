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

async function listing(agent: string, title = "2BR Condo", status = "active") {
  const [row] = await db.as<{ id: string; slug: string }>(
    agent,
    `insert into public.listings (title, city, status) values ($1, 'Cebu City', $2) returning id, slug`,
    [title, status],
  );
  return row;
}

const slugOf = async (id: string) =>
  (await db.root<{ slug: string }>(`select slug from public.profiles where id = $1`, [id]))[0].slug;

const record = (slug: string, kind: string, channel = "", source = "website") =>
  db.anon(`select public.record_listing_event($1, $2, $3, $4)`, [slug, kind, channel, source]);

beforeAll(async () => {
  db = await createDb();
});

describe("agent profile handles", () => {
  it("are generated from the name and unique", async () => {
    const a = await db.createUser({ name: "Ana Reyes" });
    const b = await db.createUser({ name: "Ana Reyes" });
    expect(await slugOf(a)).toMatch(/^ana-reyes-[0-9a-f]{6}$/);
    expect(await slugOf(b)).not.toBe(await slugOf(a));
    const nameless = await db.createUser({ name: "" });
    expect(await slugOf(nameless)).toMatch(/^agent-[0-9a-f]{6}$/);
  });

  it("can be changed by the agent, but must be well-formed and not taken", async () => {
    const a = await db.createUser({ name: "Ana" });
    const b = await db.createUser({ name: "Ben" });
    await db.as(a, `update public.profiles set slug = 'ana-reyes-realty' where id = $1`, [a]);
    expect(await slugOf(a)).toBe("ana-reyes-realty");
    await rejects(db.as(b, `update public.profiles set slug = 'ana-reyes-realty' where id = $1`, [b]), /duplicate key/);
    await rejects(db.as(b, `update public.profiles set slug = 'Bad Slug!' where id = $1`, [b]), /profiles_slug_format/);
  });

  it("agents can set bio, Messenger and Viber but not role or plan", async () => {
    const a = await db.createUser();
    await db.as(a, `update public.profiles set bio = 'PRC-licensed broker', messenger = 'ana.reyes', viber = true where id = $1`, [a]);
    await rejects(db.as(a, `update public.profiles set messenger = 'https://m.me/x' where id = $1`, [a]), /check constraint/);
    await rejects(db.as(a, `update public.profiles set role = 'admin' where id = $1`, [a]), /permission denied/);
  });
});

describe("public agent page", () => {
  it("shows contact details and only active listings", async () => {
    const a = await db.createUser({ name: "Ana Reyes" });
    await db.as(a, `update public.profiles set phone = '0917 555 0142', messenger = 'ana.reyes', viber = true where id = $1`, [a]);
    const l = await listing(a, "Active one");
    await listing(a, "Archived one", "archived");
    await db.as(a, `insert into public.listing_photos (listing_id, agent_id, path) values ($1, $2, 'c/1.jpg')`, [l.id, a]);

    const [row] = await db.anon<{ p: Record<string, unknown> & { listings: Record<string, unknown>[] } }>(
      `select public.get_public_agent($1) as p`,
      [await slugOf(a)],
    );
    expect(row.p).toMatchObject({ name: "Ana Reyes", phone: "0917 555 0142", messenger: "ana.reyes", viber: true });
    expect(row.p.listings).toHaveLength(1);
    expect(row.p.listings[0]).toMatchObject({ title: "Active one", cover: "c/1.jpg" });
    expect(row.p).not.toHaveProperty("email");
  });

  it("is null for unknown handles, and listing data links to the agent page", async () => {
    const [none] = await db.anon<{ p: unknown }>(`select public.get_public_agent('nobody-here') as p`);
    expect(none.p).toBeNull();

    const a = await db.createUser({ name: "Ana" });
    const l = await listing(a);
    const [row] = await db.anon<{ l: Record<string, unknown> }>(`select public.get_public_listing($1) as l`, [l.slug]);
    expect(row.l).toMatchObject({ agent_slug: await slugOf(a), agent_messenger: "", agent_viber: false });
  });
});

describe("listing stats", () => {
  it("records views and contact taps from visitors, and agents see only their own", async () => {
    const a = await db.createUser();
    const other = await db.createUser();
    const l = await listing(a);
    await record(l.slug, "view");
    await record(l.slug, "view", "", "facebook");
    await record(l.slug, "contact", "messenger");
    await record(l.slug, "contact", "bogus");
    await record(l.slug, "nonsense");

    const [stats] = await db.as<{ views: number; contacts: number }>(
      a,
      `select views::int, contacts::int from public.my_listing_stats(now() - interval '30 days') where listing_id = $1`,
      [l.id],
    );
    expect(stats).toEqual({ views: 2, contacts: 2 });

    const channels = await db.root<{ channel: string }>(
      `select channel from public.listing_events where listing_id = $1 and kind = 'contact' order by id`,
      [l.id],
    );
    expect(channels.map((c) => c.channel)).toEqual(["messenger", ""]);

    expect(await db.as(other, `select * from public.my_listing_stats(now() - interval '30 days')`)).toEqual([]);
    expect(await db.as(other, `select * from public.listing_events where listing_id = $1`, [l.id])).toEqual([]);
  });

  it("ignores the agent's own visits and archived listings", async () => {
    const a = await db.createUser();
    const l = await listing(a);
    await db.as(a, `select public.record_listing_event($1, 'view', '', 'website')`, [l.slug]);
    const archived = await listing(a, "Old", "archived");
    await record(archived.slug, "view");
    const [row] = await db.root<{ n: number }>(`select count(*)::int as n from public.listing_events where agent_id = $1`, [a]);
    expect(row.n).toBe(0);
  });

  it("cannot be written or read directly by visitors", async () => {
    await rejects(db.anon(`select * from public.listing_events`), /permission denied/);
    const a = await db.createUser();
    const l = await listing(a);
    await rejects(
      db.as(a, `insert into public.listing_events (listing_id, agent_id, kind) values ($1, $2, 'view')`, [l.id, a]),
      /permission denied/,
    );
  });
});

describe("phone sign-ups", () => {
  it("create a profile with no email and the number as contact phone", async () => {
    const id = crypto.randomUUID();
    await db.root(`insert into auth.users (id, phone, raw_user_meta_data) values ($1, '639171234567', '{"name":"Ana Reyes"}')`, [id]);
    const [p] = await db.root<{ email: string; phone: string; name: string; slug: string }>(
      `select email, phone, name, slug from public.profiles where id = $1`,
      [id],
    );
    expect(p).toMatchObject({ email: "", phone: "0917 123 4567", name: "Ana Reyes" });
    expect(p.slug).toMatch(/^ana-reyes-[0-9a-f]{6}$/);
  });

  it("leave the phone blank for email sign-ups and unusual numbers", async () => {
    const id = crypto.randomUUID();
    await db.root(`insert into auth.users (id, phone) values ($1, '14155550100')`, [id]);
    const [p] = await db.root<{ phone: string }>(`select phone from public.profiles where id = $1`, [id]);
    expect(p.phone).toBe("");
  });
});

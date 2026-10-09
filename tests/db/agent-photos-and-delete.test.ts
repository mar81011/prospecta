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

async function listing(agent: string) {
  const [row] = await db.as<{ id: string; slug: string }>(
    agent,
    `insert into public.listings (title, city, status) values ('2BR Condo', 'Cebu City', 'active') returning id, slug`,
  );
  return row;
}

beforeAll(async () => {
  db = await createDb();
});

describe("agent profile photos", () => {
  it("appear on the public listing once set by the server", async () => {
    const agent = await db.createUser({ name: "Ana Agent" });
    const l = await listing(agent);
    let [row] = await db.anon<{ l: Record<string, unknown> }>(`select public.get_public_listing($1) as l`, [l.slug]);
    expect(row.l.agent_photo).toBeNull();

    await db.service(`update public.profiles set photo_path = $2 where id = $1`, [agent, `${agent}/me.jpg`]);
    [row] = await db.anon<{ l: Record<string, unknown> }>(`select public.get_public_listing($1) as l`, [l.slug]);
    expect(row.l).toMatchObject({ agent_name: "Ana Agent", agent_photo: `${agent}/me.jpg` });
  });

  it("cannot be set by agents directly", async () => {
    const agent = await db.createUser();
    await rejects(
      db.as(agent, `update public.profiles set photo_path = 'someone-else/x.jpg' where id = $1`, [agent]),
      /permission denied/,
    );
  });
});

describe("deleting listings", () => {
  it("removes the listing and its photos but keeps its leads", async () => {
    const agent = await db.createUser();
    const l = await listing(agent);
    await db.as(agent, `insert into public.listing_photos (listing_id, agent_id, path) values ($1, $2, 'p/1.jpg')`, [l.id, agent]);
    await db.anon(`select public.submit_inquiry($1, 'Maria Buyer', '0917 123 4567', '', 'Still available?', 'website')`, [l.slug]);

    const deleted = await db.as(agent, `delete from public.listings where id = $1 returning id`, [l.id]);
    expect(deleted).toHaveLength(1);

    const [photos] = await db.root<{ n: number }>(`select count(*)::int as n from public.listing_photos where listing_id = $1`, [l.id]);
    expect(photos.n).toBe(0);
    const leads = await db.root<{ listing_id: string | null }>(`select listing_id from public.leads where agent_id = $1`, [agent]);
    expect(leads).toEqual([{ listing_id: null }]);
  });

  it("is limited to the agent's own listings", async () => {
    const owner = await db.createUser();
    const other = await db.createUser();
    const l = await listing(owner);
    const deleted = await db.as(other, `delete from public.listings where id = $1 returning id`, [l.id]);
    expect(deleted).toHaveLength(0);
    const [row] = await db.root<{ n: number }>(`select count(*)::int as n from public.listings where id = $1`, [l.id]);
    expect(row.n).toBe(1);
  });
});

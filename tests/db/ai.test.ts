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

beforeAll(async () => {
  db = await createDb();
});

describe("AI assistant", () => {
  it("buyer chat is a Starter/Pro feature", async () => {
    const free = await db.createUser();
    const [l] = await db.as<{ slug: string }>(free, `insert into public.listings (title, city) values ('A', 'Cebu') returning slug`);
    const has = async () => (await db.anon<{ v: boolean }>(`select public.listing_has_ai_chat($1) as v`, [l.slug]))[0].v;
    expect(await has()).toBe(false);
    await db.root(`update public.profiles set plan = 'starter', plan_status = 'active', plan_expires_at = now() + interval '30 days' where id = $1`, [free]);
    expect(await has()).toBe(true);
    // Expired plan falls back to Free.
    await db.root(`update public.profiles set plan_expires_at = now() - interval '1 day' where id = $1`, [free]);
    expect(await has()).toBe(false);
  });

  it("chat replies count against the agent's AI quota, service role only", async () => {
    const agent = await db.createUser();
    for (let i = 0; i < 10; i++) await db.service(`select public.consume_ai_generation_for($1, 'buyer_chat')`, [agent]);
    await rejects(db.service(`select public.consume_ai_generation_for($1, 'buyer_chat')`, [agent]), /AI limit reached/);
    await rejects(db.anon(`select public.consume_ai_generation_for($1, 'buyer_chat')`, [agent]), /permission denied/);
    await rejects(db.as(agent, `select public.consume_ai_generation_for($1, 'buyer_chat')`, [agent]), /permission denied/);
  });

  it("chats are private: anon has no access, agents read only their own", async () => {
    const a = await db.createUser();
    const b = await db.createUser();
    const [l] = await db.as<{ id: string }>(a, `insert into public.listings (title, city) values ('A', 'Cebu') returning id`);
    await db.service(`insert into public.ai_chats (listing_id, agent_id, messages) values ($1, $2, '[{"role":"user","content":"hi"}]')`, [l.id, a]);
    await rejects(db.anon(`select * from public.ai_chats`), /permission denied/);
    expect(await db.as(a, `select id from public.ai_chats`)).toHaveLength(1);
    expect(await db.as(b, `select id from public.ai_chats`)).toHaveLength(0);
    await rejects(db.as(a, `update public.ai_chats set reply_count = 0`), /permission denied/);
  });
});

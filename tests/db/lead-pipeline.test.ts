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

async function lead(agent: string, name = "Maria") {
  const [row] = await db.as<{ id: string }>(agent, `insert into public.leads (name, phone) values ($1, '0917') returning id`, [name]);
  return row.id;
}

const timeline = (agent: string, leadId: string) =>
  db.as<{ kind: string; body: string }>(
    agent,
    `select kind, body from public.lead_activities where lead_id = $1 order by created_at, kind`,
    [leadId],
  );

beforeAll(async () => {
  db = await createDb();
});

describe("lead pipeline", () => {
  it("status changes are validated and logged to the timeline", async () => {
    const agent = await db.createUser();
    const id = await lead(agent);
    await db.as(agent, `update public.leads set status = 'contacted' where id = $1`, [id]);
    await db.as(agent, `update public.leads set status = 'viewing' where id = $1`, [id]);
    await rejects(db.as(agent, `update public.leads set status = 'maybe' where id = $1`, [id]), /check constraint/);
    const t = await timeline(agent, id);
    expect(t.map((x) => x.body)).toEqual([
      "Status changed from New to Contacted",
      "Status changed from Contacted to Site viewing",
    ]);
  });

  it("follow-ups and site viewings are logged", async () => {
    const agent = await db.createUser();
    const id = await lead(agent);
    await db.as(agent, `update public.leads set next_follow_up_at = '2026-10-12T09:00:00+08', viewing_at = '2026-10-15T14:30:00+08' where id = $1`, [id]);
    const t = await timeline(agent, id);
    expect(t).toEqual(
      expect.arrayContaining([
        { kind: "follow_up", body: "Follow-up set for Oct 12, 2026" },
        { kind: "viewing", body: "Site viewing scheduled for Oct 15, 2026 2:30 PM" },
      ]),
    );
    await db.as(agent, `update public.leads set viewing_at = null where id = $1`, [id]);
    expect((await timeline(agent, id)).map((x) => x.body)).toContain("Site viewing cancelled");
  });

  it("agents can add and delete their own notes, but not system entries", async () => {
    const agent = await db.createUser();
    const id = await lead(agent);
    await db.as(agent, `insert into public.lead_activities (lead_id, agent_id, kind, body) values ($1, $2, 'note', 'Called, no answer')`, [id, agent]);
    await rejects(
      db.as(agent, `insert into public.lead_activities (lead_id, agent_id, kind, body) values ($1, $2, 'ai', 'fake')`, [id, agent]),
      /row-level security/,
    );
    await db.as(agent, `update public.leads set status = 'contacted' where id = $1`, [id]);
    await db.as(agent, `delete from public.lead_activities where lead_id = $1`, [id]);
    expect((await timeline(agent, id)).map((x) => x.kind)).toEqual(["status"]);
  });

  it("agents cannot touch another agent's leads or timeline", async () => {
    const a = await db.createUser();
    const b = await db.createUser();
    const id = await lead(a);
    await db.as(b, `update public.leads set status = 'won' where id = $1`, [id]);
    const [row] = await db.root<{ status: string }>(`select status from public.leads where id = $1`, [id]);
    expect(row.status).toBe("new");
    await rejects(
      db.as(b, `insert into public.lead_activities (lead_id, agent_id, kind, body) values ($1, $2, 'note', 'x')`, [id, b]),
      /row-level security/,
    );
    expect(await db.as(b, `select id from public.lead_activities where lead_id = $1`, [id])).toEqual([]);
  });

  it("locked leads cannot be worked until unlocked", async () => {
    const agent = await db.createUser();
    const id = await lead(agent);
    await db.root(`update public.leads set locked = true where id = $1`, [id]);
    await db.as(agent, `update public.leads set status = 'contacted' where id = $1`, [id]);
    const [row] = await db.root<{ status: string }>(`select status from public.leads where id = $1`, [id]);
    expect(row.status).toBe("new");
    await rejects(
      db.as(agent, `insert into public.lead_activities (lead_id, agent_id, kind, body) values ($1, $2, 'note', 'x')`, [id, agent]),
      /row-level security/,
    );
  });

  it("buyer inquiries start the timeline with their message", async () => {
    const agent = await db.createUser();
    const [l] = await db.as<{ slug: string }>(agent, `insert into public.listings (title, city) values ('Condo', 'Cebu') returning slug`);
    await db.anon(`select public.submit_inquiry($1, 'Pedro', '0917 111 2222', '', 'Pwede po viewing?', 'facebook')`, [l.slug]);
    const [ld] = await db.as<{ id: string }>(agent, `select id from public.leads`);
    expect(await timeline(agent, ld.id)).toEqual([{ kind: "inquiry", body: "Inquiry: Pwede po viewing?" }]);
  });
});

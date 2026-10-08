import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";

let db: Db;
let refSeq = 1000000000000;
const nextRef = () => String(refSeq++);

async function rejects(p: Promise<unknown>, pattern?: RegExp) {
  let err: unknown;
  try {
    await p;
  } catch (e) {
    err = e;
  }
  expect(err, "expected the operation to fail").toBeDefined();
  if (pattern) expect(String((err as Error).message)).toMatch(pattern);
  return err as Error;
}

async function submit(agent: string, plan = "pro", ref = nextRef()) {
  const [row] = await db.as<{ id: string }>(
    agent,
    `select public.submit_payment($1, $2, (now() at time zone 'Asia/Manila')::date, null) as id`,
    [plan, ref],
  );
  return row.id;
}

type ProfileRow = { plan: string; plan_status: string; plan_expires_at: Date | null; role: string };
const profile = async (id: string) =>
  (
    await db.root<ProfileRow>(`select plan, plan_status, plan_expires_at, role from public.profiles where id = $1`, [id])
  )[0];

const effective = async (id: string) =>
  (await db.root<{ p: string }>(`select public.effective_plan($1) as p`, [id]))[0].p;

const approve = (admin: string, paymentId: string) => db.as(admin, `select public.approve_payment($1)`, [paymentId]);

const daysFromNow = (d: Date) => (d.getTime() - Date.now()) / 86_400_000;

beforeAll(async () => {
  db = await createDb();
});

describe("registration", () => {
  it("creates a Free, active agent profile for new auth users", async () => {
    const id = await db.createUser({ name: "Juan Cruz" });
    expect(await profile(id)).toMatchObject({ plan: "free", plan_status: "active", role: "agent", plan_expires_at: null });
  });
});

describe("agents cannot grant themselves anything", () => {
  it("cannot change their own plan, status, expiry or role", async () => {
    const agent = await db.createUser();
    await rejects(db.as(agent, `update public.profiles set plan = 'pro' where id = $1`, [agent]), /permission denied/);
    await rejects(
      db.as(
        agent,
        `update public.profiles set plan_status = 'active', plan_expires_at = now() + interval '1 year' where id = $1`,
        [agent],
      ),
      /permission denied/,
    );
    await rejects(db.as(agent, `update public.profiles set role = 'admin' where id = $1`, [agent]), /permission denied/);
    // Name is the one editable column.
    await db.as(agent, `update public.profiles set name = 'New Name' where id = $1`, [agent]);
    expect((await profile(agent)).plan).toBe("free");
  });

  it("cannot insert or update payments directly", async () => {
    const agent = await db.createUser();
    await rejects(
      db.as(
        agent,
        `insert into public.payments (agent_id, plan_id, amount_centavos, gcash_reference, payment_date, status)
         values ($1, 'pro', 100, '1234567890', current_date, 'APPROVED')`,
        [agent],
      ),
      /permission denied/,
    );
    const id = await submit(agent);
    await rejects(db.as(agent, `update public.payments set status = 'APPROVED' where id = $1`, [id]), /permission denied/);
  });

  it("cannot approve or reject payments, even their own", async () => {
    const agent = await db.createUser();
    const id = await submit(agent);
    await rejects(db.as(agent, `select public.approve_payment($1)`, [id]), /Admin access required/);
    await rejects(db.as(agent, `select public.reject_payment($1, 'x')`, [id]), /Admin access required/);
    await rejects(
      db.as(agent, `select public.admin_set_plan($1, 'pro', 'active', now() + interval '30 days')`, [agent]),
      /Admin access required/,
    );
  });

  it("cannot call internal functions", async () => {
    const agent = await db.createUser();
    await rejects(
      db.as(agent, `select public.activate_subscription($1, 'pro', gen_random_uuid())`, [agent]),
      /permission denied/,
    );
    await rejects(db.as(agent, `select public.run_subscription_maintenance()`), /permission denied/);
    await rejects(db.as(agent, `select public.write_audit($1, 'X', 'y', null, '{}')`, [agent]), /permission denied/);
    await rejects(db.as(agent, `select public.effective_plan($1)`, [agent]), /permission denied/);
  });

  it("cannot write settings, plans or audit logs", async () => {
    const agent = await db.createUser();
    await rejects(db.as(agent, `update public.app_settings set gcash_number = '0999' where id`), /permission denied/);
    await rejects(db.as(agent, `update public.plans set price_centavos = 1 where id = 'pro'`), /permission denied/);
    await rejects(
      db.as(agent, `insert into public.audit_logs (action, entity_type) values ('x', 'y')`),
      /permission denied/,
    );
    await rejects(db.as(agent, `select public.admin_update_settings('1','2','3','4','5',7)`), /Admin access required/);
  });
});

describe("cross-agent isolation", () => {
  it("agents see only their own profile, payments and notifications", async () => {
    const a = await db.createUser();
    const b = await db.createUser();
    await submit(b);
    expect(await db.as(a, `select id from public.profiles`)).toEqual([{ id: a }]);
    expect(await db.as(a, `select id from public.payments where agent_id = $1`, [b])).toEqual([]);
    expect(await db.as(a, `select id from public.notifications where user_id = $1`, [b])).toEqual([]);
    expect(await db.as(a, `select id from public.audit_logs`)).toEqual([]);
  });

  it("payment screenshots are readable only by the owner and admins", async () => {
    const owner = await db.createUser();
    const other = await db.createUser();
    const admin = await db.createUser({ admin: true });
    await db.root(`insert into storage.objects (bucket_id, name) values ('payment-screenshots', $1)`, [
      `${owner}/p1.png`,
    ]);
    const q = `select name from storage.objects where bucket_id = 'payment-screenshots' and name like $1`;
    expect(await db.as(owner, q, [`${owner}/%`])).toHaveLength(1);
    expect(await db.as(other, q, [`${owner}/%`])).toHaveLength(0);
    expect(await db.as(admin, q, [`${owner}/%`])).toHaveLength(1);
    await rejects(
      db.as(owner, `insert into storage.objects (bucket_id, name) values ('payment-screenshots', $1)`, [
        `${owner}/x.png`,
      ]),
      /row-level security/,
    );
  });

  it("the screenshot bucket is private", async () => {
    const [b] = await db.root<{ public: boolean }>(
      `select public from storage.buckets where id = 'payment-screenshots'`,
    );
    expect(b.public).toBe(false);
  });
});

describe("payment submission", () => {
  it("uses the server-side price and starts PENDING", async () => {
    const agent = await db.createUser();
    const id = await submit(agent, "starter", "1234 567 890 123");
    const [p] = await db.as(
      agent,
      `select amount_centavos, status, gcash_reference, currency from public.payments where id = $1`,
      [id],
    );
    expect(p).toEqual({ amount_centavos: 19900, status: "PENDING", gcash_reference: "1234567890123", currency: "PHP" });
    expect((await profile(agent)).plan).toBe("free");
  });

  it("notifies admins and writes an audit entry", async () => {
    const admin = await db.createUser({ admin: true });
    const agent = await db.createUser({ name: "Maria Santos" });
    const id = await submit(agent);
    const notes = await db.as<{ body: string }>(admin, `select body from public.notifications where link = $1`, [
      `/admin/payments/${id}`,
    ]);
    expect(notes[0].body).toContain("Maria Santos");
    const audit = await db.root(
      `select 1 from public.audit_logs where action = 'AGENT_SUBMITTED_PAYMENT' and entity_id = $1`,
      [id],
    );
    expect(audit).toHaveLength(1);
  });

  it("rejects the free plan, bad references and a second pending request", async () => {
    const agent = await db.createUser();
    await rejects(submit(agent, "free"), /Invalid plan/);
    await rejects(submit(agent, "pro", "abc"), /Invalid GCash reference/);
    await rejects(submit(agent, "enterprise"), /Invalid plan/);
    await submit(agent);
    await rejects(submit(agent), /awaiting review/);
  });

  it("requires authentication", async () => {
    await rejects(
      db.root(`select public.submit_payment('pro', '1234567890', current_date, null)`),
      /Not authenticated/,
    );
  });
});

describe("admin approval", () => {
  it("activates the plan for 30 days atomically, with audit and notification", async () => {
    const admin = await db.createUser({ admin: true });
    const agent = await db.createUser();
    const id = await submit(agent, "pro");
    await approve(admin, id);

    const p = await profile(agent);
    expect(p.plan).toBe("pro");
    expect(p.plan_status).toBe("active");
    expect(daysFromNow(p.plan_expires_at!)).toBeGreaterThan(29.9);
    expect(daysFromNow(p.plan_expires_at!)).toBeLessThan(30.1);
    expect(await effective(agent)).toBe("pro");

    const [pay] = await db.root<{ status: string; reviewed_by: string; approved_at: Date }>(
      `select status, reviewed_by, approved_at from public.payments where id = $1`,
      [id],
    );
    expect(pay.status).toBe("APPROVED");
    expect(pay.reviewed_by).toBe(admin);
    expect(pay.approved_at).toBeTruthy();

    const actions = await db.root<{ action: string }>(
      `select action from public.audit_logs where entity_id in ($1, $2)`,
      [id, agent],
    );
    expect(actions.map((a) => a.action)).toEqual(
      expect.arrayContaining(["ADMIN_APPROVED_PAYMENT", "SUBSCRIPTION_ACTIVATED"]),
    );
    const notes = await db.as<{ type: string }>(agent, `select type from public.notifications`);
    expect(notes.map((n) => n.type)).toContain("payment_approved");
  });

  it("cannot approve twice or approve a rejected payment", async () => {
    const admin = await db.createUser({ admin: true });
    const agent = await db.createUser();
    const id = await submit(agent);
    await approve(admin, id);
    await rejects(approve(admin, id), /Only pending/);

    const id2 = await submit(agent);
    await db.as(admin, `select public.reject_payment($1, 'Reference not found')`, [id2]);
    await rejects(approve(admin, id2), /Only pending/);
  });

  it("blocks a GCash reference from being approved twice", async () => {
    const admin = await db.createUser({ admin: true });
    const a = await db.createUser();
    const b = await db.createUser();
    const ref = nextRef();
    const pa = await submit(a, "pro", ref);
    // b submits the same reference before a's payment is approved.
    const pb = await submit(b, "pro", ref);
    await approve(admin, pa);
    await rejects(approve(admin, pb), /already approved/);
    expect((await profile(b)).plan).toBe("free");
    // It cannot be submitted again afterwards either.
    await db.as(admin, `select public.reject_payment($1, 'Duplicate payment')`, [pb]);
    await rejects(submit(b, "pro", ref), /already been used/);
  });

  it("renewing an active plan extends from the current expiry", async () => {
    const admin = await db.createUser({ admin: true });
    const agent = await db.createUser();
    await approve(admin, await submit(agent, "starter"));
    const first = (await profile(agent)).plan_expires_at!;
    await approve(admin, await submit(agent, "starter"));
    const second = (await profile(agent)).plan_expires_at!;
    expect(Math.round((second.getTime() - first.getTime()) / 86_400_000)).toBe(30);
  });

  it("renewing an expired plan starts from now", async () => {
    const admin = await db.createUser({ admin: true });
    const agent = await db.createUser();
    await approve(admin, await submit(agent, "starter"));
    await db.root(`update public.profiles set plan_expires_at = now() - interval '10 days' where id = $1`, [agent]);
    await approve(admin, await submit(agent, "starter"));
    const days = daysFromNow((await profile(agent)).plan_expires_at!);
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });
});

describe("admin rejection", () => {
  it("requires a reason, keeps the record and notifies the agent", async () => {
    const admin = await db.createUser({ admin: true });
    const agent = await db.createUser();
    const id = await submit(agent);
    await rejects(db.as(admin, `select public.reject_payment($1, '  ')`, [id]), /reason is required/);
    await db.as(admin, `select public.reject_payment($1, 'Reference not found')`, [id]);
    const [p] = await db.as<{ status: string; rejection_reason: string; rejected_at: Date }>(
      agent,
      `select status, rejection_reason, rejected_at from public.payments where id = $1`,
      [id],
    );
    expect(p.status).toBe("REJECTED");
    expect(p.rejection_reason).toBe("Reference not found");
    expect(p.rejected_at).toBeTruthy();
    expect((await profile(agent)).plan).toBe("free");
    const notes = await db.as<{ body: string }>(
      agent,
      `select body from public.notifications where type = 'payment_rejected'`,
    );
    expect(notes[0].body).toContain("Reference not found");
  });
});

describe("expiration", () => {
  it("falls back to Free immediately; maintenance marks it expired without deleting data", async () => {
    const admin = await db.createUser({ admin: true });
    const agent = await db.createUser();
    await approve(admin, await submit(agent, "pro"));
    for (let i = 0; i < 8; i++) await db.as(agent, `insert into public.listings (title) values ($1)`, [`L${i}`]);

    await db.root(`update public.profiles set plan_expires_at = now() - interval '1 minute' where id = $1`, [agent]);
    expect(await effective(agent)).toBe("free");

    await db.service(`select public.run_subscription_maintenance()`);
    const p = await profile(agent);
    expect(p.plan).toBe("pro");
    expect(p.plan_status).toBe("expired");
    expect(await db.as(agent, `select id from public.listings`)).toHaveLength(8);
    // Over the Free limit: existing listings stay, new ones are blocked.
    await rejects(db.as(agent, `insert into public.listings (title) values ('one more')`), /5 active listings/);
  });

  it("sends a single expiry warning within 5 days", async () => {
    const admin = await db.createUser({ admin: true });
    const agent = await db.createUser();
    await approve(admin, await submit(agent, "pro"));
    await db.root(`update public.profiles set plan_expires_at = now() + interval '4 days 2 hours' where id = $1`, [
      agent,
    ]);
    await db.service(`select public.run_subscription_maintenance()`);
    await db.service(`select public.run_subscription_maintenance()`);
    const notes = await db.as<{ body: string }>(
      agent,
      `select body from public.notifications where type = 'plan_expiring'`,
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toContain("expires in 5 day(s)");
  });

  it("expires stale pending payment requests", async () => {
    const agent = await db.createUser();
    const id = await submit(agent);
    await db.root(`update public.payments set submitted_at = now() - interval '8 days' where id = $1`, [id]);
    await db.service(`select public.run_subscription_maintenance()`);
    const [p] = await db.root<{ status: string }>(`select status from public.payments where id = $1`, [id]);
    expect(p.status).toBe("EXPIRED");
    // The agent can submit again.
    await submit(agent);
  });
});

describe("plan limits", () => {
  it("enforces active listing limits by plan", async () => {
    const agent = await db.createUser();
    for (let i = 0; i < 5; i++) await db.as(agent, `insert into public.listings (title) values ($1)`, [`L${i}`]);
    await rejects(db.as(agent, `insert into public.listings (title) values ('L6')`), /5 active listings/);
    // Archived listings do not count, and archiving frees a slot.
    await db.as(agent, `insert into public.listings (title, status) values ('old', 'archived')`);
    await db.as(agent, `update public.listings set status = 'archived' where title = 'L0'`);
    await db.as(agent, `insert into public.listings (title) values ('L6')`);
    // Reactivating over the limit is blocked.
    await rejects(
      db.as(agent, `update public.listings set status = 'active' where title = 'old'`),
      /5 active listings/,
    );
  });

  it("enforces monthly lead limits, and deleting leads does not restore quota", async () => {
    const agent = await db.createUser();
    for (let i = 0; i < 50; i++) await db.as(agent, `insert into public.leads (name) values ($1)`, [`Lead ${i}`]);
    await rejects(db.as(agent, `insert into public.leads (name) values ('one more')`), /50 new leads/);
    await db.as(agent, `delete from public.leads where name = 'Lead 0'`);
    await rejects(db.as(agent, `insert into public.leads (name) values ('one more')`), /50 new leads/);
  });

  it("enforces monthly AI generation limits", async () => {
    const agent = await db.createUser();
    for (let i = 0; i < 10; i++) await db.as(agent, `select public.consume_ai_generation('listing_description')`);
    await rejects(
      db.as(agent, `select public.consume_ai_generation('listing_description')`),
      /all 10 AI generations/,
    );
    await rejects(
      db.as(agent, `insert into public.usage_events (agent_id, metric) values ($1, 'ai_generation')`, [agent]),
      /permission denied/,
    );
  });

  it("Pro has no fixed limits and Starter has its own", async () => {
    const admin = await db.createUser({ admin: true });
    const pro = await db.createUser();
    await approve(admin, await submit(pro, "pro"));
    for (let i = 0; i < 30; i++) await db.as(pro, `insert into public.listings (title) values ($1)`, [`P${i}`]);

    const starter = await db.createUser();
    await approve(admin, await submit(starter, "starter"));
    const [row] = await db.as<{ e: { effective_plan: string; limits: Record<string, number> } }>(
      starter,
      `select public.get_my_entitlements() as e`,
    );
    expect(row.e.effective_plan).toBe("starter");
    expect(row.e.limits.max_active_listings).toBe(25);
  });

  it("stores property details and rejects invalid values", async () => {
    const agent = await db.createUser();
    const [row] = await db.as<{ listing_type: string; price_centavos: string; bedrooms: number }>(
      agent,
      `insert into public.listings (title, listing_type, property_type, price_centavos, city, bedrooms, floor_area_sqm)
       values ('Condo for rent', 'rent', 'condo', 2500000, 'Makati', 1, 32.5)
       returning listing_type, price_centavos, bedrooms`,
    );
    expect(row).toMatchObject({ listing_type: "rent", bedrooms: 1 });
    expect(Number(row.price_centavos)).toBe(2500000);
    await rejects(db.as(agent, `insert into public.listings (title, listing_type) values ('x', 'lease')`), /check constraint/);
    await rejects(db.as(agent, `insert into public.listings (title, price_centavos) values ('x', -1)`), /check constraint/);
  });

  it("agents cannot create rows for other agents", async () => {
    const a = await db.createUser();
    const b = await db.createUser();
    await rejects(
      db.as(a, `insert into public.listings (agent_id, title) values ($1, 'x')`, [b]),
      /row-level security/,
    );
  });
});

describe("admin tools", () => {
  it("admin can change plans, settings and roles with audit entries", async () => {
    const admin = await db.createUser({ admin: true });
    const agent = await db.createUser();
    await db.as(admin, `select public.admin_set_plan($1, 'starter', 'active', now() + interval '10 days', 'comp')`, [
      agent,
    ]);
    expect(await effective(agent)).toBe("starter");
    await db.as(admin, `select public.admin_update_settings('0917 123 4567', 'Prospecta', 'Pay exactly', 's@x.com', '', 7)`);
    const [s] = await db.as<{ gcash_number: string }>(agent, `select gcash_number from public.app_settings`);
    expect(s.gcash_number).toBe("0917 123 4567");
    await db.as(admin, `select public.admin_set_role($1, 'admin')`, [agent]);
    await rejects(db.as(admin, `select public.admin_set_role($1, 'agent')`, [admin]), /own role/);
    const actions = await db.root<{ action: string }>(
      `select distinct action from public.audit_logs where actor_id = $1`,
      [admin],
    );
    expect(actions.map((a) => a.action)).toEqual(
      expect.arrayContaining(["ADMIN_CHANGED_PLAN", "ADMIN_UPDATED_SETTINGS", "ADMIN_CHANGED_ROLE"]),
    );
  });

  it("deleting an admin keeps the payments they reviewed", async () => {
    const admin = await db.createUser({ admin: true });
    const agent = await db.createUser();
    const id = await submit(agent);
    await approve(admin, id);
    await db.root(`delete from auth.users where id = $1`, [admin]);
    const [p] = await db.root<{ status: string; reviewed_by: string | null }>(
      `select status, reviewed_by from public.payments where id = $1`,
      [id],
    );
    expect(p).toEqual({ status: "APPROVED", reviewed_by: null });
  });

  it("price changes apply to new submissions only", async () => {
    const admin = await db.createUser({ admin: true });
    await db.as(admin, `select public.admin_update_plan('starter', 24900, 25, 250, 100, 'x', true)`);
    const agent = await db.createUser();
    const id = await submit(agent, "starter");
    const [p] = await db.root<{ amount_centavos: number }>(
      `select amount_centavos from public.payments where id = $1`,
      [id],
    );
    expect(p.amount_centavos).toBe(24900);
    await rejects(db.as(admin, `select public.admin_update_plan('free', 100, 5, 50, 10, 'x', true)`), /must stay free/);
    await db.as(admin, `select public.admin_update_plan('starter', 19900, 25, 250, 100, 'x', true)`);
  });

  it("overview counts revenue from approved payments only", async () => {
    type O = { o: { monthly_revenue_centavos: number } };
    const admin = await db.createUser({ admin: true });
    const [before] = await db.as<O>(admin, `select public.admin_overview() as o`);
    const agent = await db.createUser();
    const id = await submit(agent, "pro");
    const [mid] = await db.as<O>(admin, `select public.admin_overview() as o`);
    expect(mid.o.monthly_revenue_centavos).toBe(before.o.monthly_revenue_centavos);
    await approve(admin, id);
    const [after] = await db.as<O>(admin, `select public.admin_overview() as o`);
    expect(after.o.monthly_revenue_centavos - before.o.monthly_revenue_centavos).toBe(39900);
    const agent2 = await db.createUser();
    await rejects(db.as(agent2, `select public.admin_overview()`), /Admin access required/);
  });
});

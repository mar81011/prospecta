# Prospecta

SaaS for Philippine real-estate agents: listings, leads and AI sales assistance.

This MVP implements **accounts, plans, manual GCash payments with admin approval, and subscription tracking**. There is **no PayMongo integration**. The design lets a payment provider be added later without changing the subscription system (see [Future PayMongo](#future-paymongo)).

Stack: Next.js 16 (App Router) · TypeScript · Tailwind · Supabase (Auth, Postgres, Storage) · Vercel.

## Local setup

Requires Node 20+ and **Docker Desktop**, which the Supabase CLI uses to run the local stack.

```bash
npm install
npx supabase start            # starts Postgres/Auth/Storage, applies migrations + seed
cp .env.example .env.local    # fill in the keys printed by `supabase start`
npm run dev                   # http://localhost:3000
```

- Emails (sign-up confirmation, invites, password resets) appear in Mailpit at http://127.0.0.1:54324.
- Supabase Studio: http://127.0.0.1:54323.
- `npm run db:reset` re-applies all migrations and the seed.

### First admin

There is deliberately no way to become an admin from the app. Register normally, confirm the email, then run this in Studio's SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

After that, admins can promote other users from **Admin → Agents → Manage**.

### Environment variables

| Name | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | All user queries go through RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Screenshot uploads, invites, cron |
| `NEXT_PUBLIC_SITE_URL` | server | Used in auth email links |
| `CRON_SECRET` | server | Bearer token for `/api/cron/subscriptions` |

In production, update the Supabase Auth email templates to match `supabase/templates/*.html`. They link to `/auth/confirm?token_hash=…`, which is required for admin invites to work with server-side auth.

## How it works

### Agent flow
Register (starts on Free) → **Plans** → choose Starter or Pro → GCash instructions → send GCash → **I've paid** → enter the reference number (screenshot optional) → payment is `PENDING` → admin approves → plan is active for 30 days → in-app notification.

Renewing the same plan while it's active adds 30 days to the current expiry. If the plan has expired, or the agent switches plans, a fresh 30-day period starts with no proration.

### Admin flow
**Admin → Payments**: pending payments, oldest first. **Review** opens the details, a duplicate-reference warning and the screenshot (via a 60-second signed URL). **Approve** only after finding the transaction in the GCash app. **Reject** requires a reason, which the agent sees. Records are never deleted.

Other admin pages: Overview (agents, paid/free counts, pending payments, revenue this month from approved payments only, expiring soon), Agents (search, invite, manual plan override, role), Plans (price and limits), Settings (GCash number/name, instructions, support contacts, pending-request TTL), Audit log.

### Security model
The database is the authority; the UI and the proxy are convenience layers.

- **RLS on every table.** Agents can read only their own rows. Agents have no INSERT/UPDATE on `payments`, and on `profiles` they can update only `name` (column-level grant). An agent can't set their own `plan`, `plan_status`, `plan_expires_at` or `role`.
- **All billing state changes are `SECURITY DEFINER` functions** that check `auth.uid()` and `is_admin()`:
  - `submit_payment`: looks up the price itself, so the browser never sends an amount.
  - `approve_payment` and `reject_payment`.
  - `admin_set_plan`, `admin_set_role`, `admin_update_settings`, `admin_update_plan`.
  - Approval is a single transaction: lock the payment, re-check duplicates, mark it approved, activate the plan, write the audit log, notify.
- **Duplicate references.** A partial unique index allows only one APPROVED payment per GCash reference, and both submit and approve check for it. A second partial unique index allows one PENDING request per agent.
- **Screenshots** go in a private bucket at `{agent_id}/{payment_id}.{ext}`. The type is detected from magic bytes (JPEG/PNG/WebP only, ≤5 MB); the browser's MIME type and filename are ignored. Uploads happen server-side with the service role, and the storage read policy allows only the owner and admins.
- **Money** is stored as integer centavos (`39900` = ₱399) with `currency = 'PHP'`.
- **Audit log**: every submission, approval, rejection, plan/role/settings/plan-price change, invite, activation and expiry is recorded. Clients can only read it, and only admins.

### Plans and entitlements
Prices, the billing period and limits live in the `plans` table. Admins edit them at **Admin → Plans**, and the same numbers are used everywhere:

- **Database triggers** enforce active listings and new leads per month. Leads are counted from an append-only `usage_events` log, so deleting a lead doesn't give quota back.
- **`consume_ai_generation(kind)`** must be called before any model call. It atomically checks the monthly quota and records the usage.
- **`effective_plan(user)`** returns `free` the moment a paid plan's expiry passes, even before the daily job runs. Data is never deleted on expiry; only new activity above Free limits is blocked.
- **App code** reads entitlements through `src/lib/plans/entitlements.ts` (`getEntitlements`, `hasFeature`, `consumeAiGeneration`) instead of comparing plan names.

| | Free | Starter | Pro |
| --- | --- | --- | --- |
| Price | ₱0 | ₱199 / 30 days | ₱399 / 30 days |
| Active listings | 5 | 25 | no fixed limit (fair use) |
| Leads / month | 50 | 250 | no fixed limit |
| AI generations / month | 10 | 100 | no fixed limit |

### Daily maintenance
Vercel Cron (`vercel.json`, 00:00 Manila) calls `GET /api/cron/subscriptions` with `Authorization: Bearer $CRON_SECRET`. The job:

- marks lapsed plans `expired`;
- expires `PENDING` requests older than the configured TTL;
- sends "expires in N days" reminders once per expiry date, starting 5 days before.

Locally, run `npm run cron:local` while the dev server is running.

## Code map

```
supabase/migrations/      schema, billing functions, usage limits, RLS, storage
supabase/templates/       auth email templates (token_hash links)
src/proxy.ts              session refresh + signed-out redirects (UX only)
src/lib/auth/require.ts   requireUser / requireAdmin
src/lib/billing/
  subscription.ts         activateSubscription(): provider-agnostic activation
  providers/manual-gcash.ts  submitManualPayment, screenshot upload/signed URLs
  review.ts               approvePayment / rejectPayment (admin)
  expiry.ts               pure date logic mirrored from SQL (unit tested)
src/lib/plans/            plan catalog + entitlements
src/app/(app)/            agent pages: dashboard, payment/*, listings, leads, notifications
src/app/admin/            admin pages + server actions
src/app/api/cron/         daily maintenance endpoint
tests/db/                 RLS + billing tests against the real migrations (PGlite)
tests/unit/               pure TS helpers
```

Mutations use **Server Actions**, which are server-side POST endpoints that re-check auth, rather than separate `/api/*` JSON routes. The only route handlers are the auth callbacks and the cron endpoint.

## Testing

```bash
npm test            # unit tests + database tests
npm run typecheck
npm run lint
npm run build
```

`tests/db` runs every migration in PGlite (in-process Postgres) with small stand-ins for Supabase's `auth`/`storage` schemas, then tests the security rules and billing flows as real `authenticated` and `service_role` users. No Docker needed. Before launch, also walk through the flows above against `supabase start`.

## Future PayMongo

When Prospecta has traction and business verification is done:

1. Create a checkout session server-side from the `plans` price.
2. Record a `payments` row with `provider = 'paymongo'` (the column already exists).
3. In a webhook route, verify the PayMongo signature, mark the payment paid, then call `activateSubscription({ agentId, planId, paymentId })` from `src/lib/billing/subscription.ts`. It's the same SQL function admin approval uses today.

Nothing in the plan, entitlement or expiry logic needs to change.

Manual GCash is an early-validation workflow, not a payment gateway. Before scaling, review the Philippine business, tax and payment-provider requirements.

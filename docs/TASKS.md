# Prospecta — Task Tracker

Source of truth for requirements: [SPEC-manual-gcash-payments.md](SPEC-manual-gcash-payments.md).
Update this file as work is done.

Legend: **Built** = code exists · **Tested** = covered by `npm test` · **Live** = passes `npm run test:e2e` (Playwright) against the real app + Supabase project `hdhjsnpsxgmmwyinwbnv`

_Last updated: 2026-10-09_

## Definition of Done (spec §36)

| # | Item | Built | Tested | Live | Where |
|---|------|:-----:|:------:|:----:|-------|
| 1 | Agent can register | ✅ | ✅ | ✅ | `/register` |
| 2 | Agent starts on Free | ✅ | ✅ | ✅ | `handle_new_user` trigger |
| 3 | Agent can view Starter and Pro plans | ✅ | – | ✅ | `/pricing` |
| 4 | Agent can select a paid plan | ✅ | – | ✅ | `/pricing` → `/payment?plan=` |
| 5 | Agent sees GCash instructions | ✅ | – | ✅ | `/payment` (needs GCash number in Admin → Settings) |
| 6 | Agent can submit GCash reference | ✅ | ✅ | ✅ | `submit_payment()` |
| 7 | Payment becomes PENDING | ✅ | ✅ | ✅ | `/payment/pending` |
| 8 | Agent cannot activate their own payment | ✅ | ✅ | ✅ | RLS + `approve_payment()` admin check |
| 9 | Admin sees pending payments | ✅ | – | ✅ | `/admin/payments` |
| 10 | Admin can inspect payment details | ✅ | – | ✅ | `/admin/payments/[id]` |
| 11 | Admin can approve payment | ✅ | ✅ | ✅ | `approve_payment()` |
| 12 | Admin can reject payment with a reason | ✅ | ✅ | ✅ | `reject_payment()` |
| 13 | Approval activates the correct plan | ✅ | ✅ | ✅ | `activate_subscription()` |
| 14 | Free/Starter/Pro limits enforced server-side | ✅ | ✅ | ✅ | DB triggers + `plans` table |
| 15 | Active listing limits enforced by plan | ✅ | ✅ | ✅ | `enforce_listing_limit` |
| 16 | Monthly lead limits enforced by plan | ✅ | ✅ | ✅ | `enforce_lead_limit` |
| 17 | Monthly AI generation limits enforced by plan | ✅ | ✅ | ⬜ | `consume_ai_generation()` (no AI feature uses it yet) |
| 18 | Feature entitlements centralized | ✅ | ✅ | – | `src/lib/plans/entitlements.ts` |
| 19 | Expired plans fall back to Free, data kept | ✅ | ✅ | ✅ | `effective_plan()` |
| 20 | Subscription expires after 30 days | ✅ | ✅ | ✅ | `plans.billing_period_days` |
| 21 | Renewal works | ✅ | ✅ | ✅ | same plan extends from current expiry |
| 22 | Agent can see payment history | ✅ | – | ✅ | `/payment/history` |
| 23 | Admin can see agent list | ✅ | – | ✅ | `/admin/agents` |
| 24 | Admin can manage GCash payment settings | ✅ | ✅ | ✅ | `/admin/settings` |
| 25 | Duplicate GCash references protected | ✅ | ✅ | ✅ | unique index + checks |
| 26 | Payment actions are logged | ✅ | ✅ | ✅ | `/admin/audit-logs` |
| 27 | RLS prevents cross-agent data access | ✅ | ✅ | ✅ | verified on hosted DB (RLS on all tables) |
| 28 | Payment screenshots are private | ✅ | ✅ | ✅ | private bucket verified on hosted DB |
| 29 | No PayMongo integration exists yet | ✅ | – | – | |
| 30 | Subscription activation abstracted for PayMongo | ✅ | – | – | `src/lib/billing/subscription.ts` |

Not covered by e2e (they send real emails, capped at 2/hour): successful sign-up email confirmation, admin invite link, password-reset link. Check these by hand once SMTP is set up.

## Next up

1. [ ] **Apply migrations `20261010000001` (lead pipeline), `20261010000002` (AI) and `20261011000001` (agent photos)** to the hosted project: `npm run db:apply` with a token (see README → Deploying). Until then the app on the hosted DB will error on Leads, and profile photo uploads fail.
2. [ ] Run `npm run test:e2e` (pipeline + AI specs are written but not yet run against the hosted DB).
3. [ ] Add `ANTHROPIC_API_KEY` to `.env.local` / Netlify to turn on the AI features.
4. [ ] Deploy: finish Netlify setup — connect the GitHub repo for auto-deploys, Supabase Auth URLs (README → Deploying). Site: https://prospectaph.netlify.app
5. [ ] Admin → Settings: real GCash number; Account: your mobile number.

## Product roadmap — lead generation (list → share on Facebook → leads come in)

**Decision (2026-10-09):** no Meta/Messenger automation. Facebook is used only for sharing; automation and AI run in Prospecta's own backend. AI usage is metered by the plan quotas (no AI provider is truly unlimited).

**A. Share & capture** ✅ done 2026-10-09
- [x] Public listing page `/p/[slug]` with photos, details, agent contact, and Open Graph tags for the Facebook preview card.
- [x] "Share to Facebook" (share dialog) + "Copy caption" (ready-made post text) + "Copy link".
- [x] Inquiry form → lead created automatically, linked to the listing, source tagged Facebook / listing page; agent notified.
- [x] Over-limit inquiries are kept but locked until upgrade (buyers are never lost; acts as an upgrade prompt). Note: the lock hides details in the app UI; it's not enforced at the database column level.
- [x] Listing photos (up to 10, compressed in the browser, cover photo), Account page for agent name + mobile.

**B. Lead pipeline** ✅ built 2026-10-10 (unit + DB tests pass; e2e pending hosted migration)
- [x] Lead stages: New → Contacted → Qualified → Site viewing → Negotiating → Won / Lost, with stage tabs and counts.
- [x] Lead page: timeline (auto-logged stage/schedule changes, buyer inquiry, notes), call/text/email buttons, follow-up date, site viewing.
- [x] Dashboard "Today": follow-ups due, viewings this week.
- [x] Rule-based Hot/Warm/Cold score with reasons (`src/lib/leads.ts`). Locked leads can't be worked (enforced by RLS).

**C. AI assistant (in Prospecta's backend)** ✅ built 2026-10-10 (needs `ANTHROPIC_API_KEY`; e2e uses the fake provider)
- [x] "Write with AI" title + description (English / Taglish / Tagalog).
- [x] AI Facebook caption.
- [x] Buyer chat on public listing pages (Starter/Pro): answers from listing facts, collects contact → lead + transcript on the lead page. Capped 12 replies/chat, 100/listing/day; falls back to the form when the agent's quota is used.
- [x] "Analyze lead": summary, hot/warm/cold, suggested stage, next step (saved to the timeline).
- Every AI call is charged to the plan's monthly AI quota (refunded on failure). Model: `claude-opus-5-5` by default; set `AI_MODEL` to change it (e.g. a cheaper model).

**D. Facebook automation** — dropped by decision above. (For reference: it would need a Meta app, business verification and App Review; Meta never allows reading personal-profile or group comments/messages.)

## Open items / known gaps

- [ ] **Email:** Supabase default sender is limited to 2 emails/hour and custom templates are blocked on the free tier. Set up SMTP (e.g. Resend/Brevo) and then apply `supabase/templates/*`.
- [x] **Deploy:** Netlify site `prospectaph` created (2026-10-09), production env vars set (`CRON_SECRET` generated, only stored in Netlify).
- [ ] **Supabase Auth:** set Site URL / redirect URLs to https://prospectaph.netlify.app.
- [ ] **Cron:** confirm the Netlify scheduled function `subscriptions-cron` calls `/api/cron/subscriptions` daily (Netlify → Logs → Functions).
- [x] Supabase access token shared in chat was revoked (2026-10-09). Future migrations need a new token, the Supabase MCP sign-in (`/mcp`), or pasting the SQL into the dashboard SQL editor. All migrations up to `20261009000003` are applied.
- [x] Git repository initialized; pushed to https://github.com/mar81011/prospecta.
- [ ] Property matching (spec §1).
- [ ] **Phase 8 — PayMongo:** only after traction + business verification (spec §28).

## Changelog

- 2026-10-11 — Agents can delete listings (photos removed from storage, leads kept) and upload a profile photo (Account page), shown on public listing pages. Migration `20261011000001_agent_photos.sql`. Homepage demo + "Why upgrade?" section. Tests: 85 passing.

- 2026-10-09 — Hosting moved to Netlify: scheduled function `netlify/functions/subscriptions-cron.mts` replaces Vercel Cron; site `prospectaph` created with env vars; repo pushed to GitHub.

- 2026-10-10 — Roadmap B (lead pipeline) and C (AI assistant) built; `npm run db:apply` script; deploy guide in README; git repo initialized. Tests: 81 unit/DB passing.

- 2026-10-08 — MVP built: auth, plans, manual GCash flow, admin dashboard, subscriptions, notifications, audit log, RLS. Migrations applied to hosted Supabase.
- 2026-10-09 — Roadmap A: public listing pages with Facebook preview tags, Share to Facebook / Copy caption / Copy link, buyer inquiries → leads (source-tagged, locked over limit, unlocked on upgrade), listing photos, Account page. e2e: 58 passing.
- 2026-10-09 — New logo. Playwright e2e suite (46 tests) passing against hosted Supabase. Fixed: forms lost all typed input after a validation error; admins who had reviewed payments could not be deleted.
- 2026-10-09 — Listings now store full property details (sale/rent, type, price, location, rooms, areas, furnishing, description). Owner account promoted to admin.

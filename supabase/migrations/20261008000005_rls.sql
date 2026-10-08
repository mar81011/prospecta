-- Row Level Security and table privileges.
--
-- Supabase grants ALL on new public tables to anon/authenticated by default, so
-- privileges are revoked first and only the minimum is granted back. RLS then
-- restricts which rows the granted privileges apply to. All plan/payment state
-- changes happen through SECURITY DEFINER functions, never direct writes.

alter table public.plans enable row level security;
alter table public.profiles enable row level security;
alter table public.payments enable row level security;
alter table public.app_settings enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.listings enable row level security;
alter table public.leads enable row level security;
alter table public.usage_events enable row level security;

revoke all on public.plans, public.profiles, public.payments, public.app_settings,
  public.notifications, public.audit_logs, public.listings, public.leads,
  public.usage_events
  from anon, authenticated;

-- plans: public price list.
grant select on public.plans to anon, authenticated;
create policy "plans are readable" on public.plans
  for select to anon, authenticated using (true);

-- profiles: read own (admins read all); agents may only change their name.
grant select on public.profiles to authenticated;
grant update (name) on public.profiles to authenticated;
create policy "read own profile or admin" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy "update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- payments: read-only to clients. Writes go through submit/approve/reject functions.
grant select on public.payments to authenticated;
create policy "read own payments or admin" on public.payments
  for select to authenticated using (agent_id = (select auth.uid()) or (select public.is_admin()));

-- app_settings: GCash details are shown to signed-in users. Writes via admin_update_settings().
grant select on public.app_settings to authenticated;
create policy "settings readable by signed-in users" on public.app_settings
  for select to authenticated using (true);

-- notifications: owner can read and mark as read.
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy "read own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "mark own notifications read" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- audit_logs: admins only, read-only.
grant select on public.audit_logs to authenticated;
create policy "admins read audit logs" on public.audit_logs
  for select to authenticated using ((select public.is_admin()));

-- listings / leads: owned by the agent; limits enforced by triggers.
grant select, insert, update, delete on public.listings to authenticated;
create policy "read own listings or admin" on public.listings
  for select to authenticated using (agent_id = (select auth.uid()) or (select public.is_admin()));
create policy "insert own listings" on public.listings
  for insert to authenticated with check (agent_id = (select auth.uid()));
create policy "update own listings" on public.listings
  for update to authenticated using (agent_id = (select auth.uid())) with check (agent_id = (select auth.uid()));
create policy "delete own listings" on public.listings
  for delete to authenticated using (agent_id = (select auth.uid()));

grant select, insert, update, delete on public.leads to authenticated;
create policy "read own leads or admin" on public.leads
  for select to authenticated using (agent_id = (select auth.uid()) or (select public.is_admin()));
create policy "insert own leads" on public.leads
  for insert to authenticated with check (agent_id = (select auth.uid()));
create policy "update own leads" on public.leads
  for update to authenticated using (agent_id = (select auth.uid())) with check (agent_id = (select auth.uid()));
create policy "delete own leads" on public.leads
  for delete to authenticated using (agent_id = (select auth.uid()));

-- usage_events: read-only; written by the lead trigger and consume_ai_generation().
grant select on public.usage_events to authenticated;
create policy "read own usage or admin" on public.usage_events
  for select to authenticated using (agent_id = (select auth.uid()) or (select public.is_admin()));

-- Core schema: plans, profiles, role helpers.

create type public.user_role as enum ('agent', 'admin');
create type public.plan_status as enum ('active', 'pending', 'expired', 'cancelled');
create type public.payment_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- plans: single source of truth for price, billing period and entitlements.
-- A null limit means "no fixed product limit" (fair use, still rate limited).
-- ---------------------------------------------------------------------------
create table public.plans (
  id text primary key,
  name text not null,
  description text not null default '',
  price_centavos integer not null check (price_centavos >= 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  billing_period_days integer not null default 30 check (billing_period_days > 0),
  max_active_listings integer check (max_active_listings >= 0),
  max_leads_per_month integer check (max_leads_per_month >= 0),
  max_ai_generations_per_month integer check (max_ai_generations_per_month >= 0),
  features jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

insert into public.plans
  (id, name, description, price_centavos, max_active_listings, max_leads_per_month, max_ai_generations_per_month, features, sort_order)
values
  ('free', 'Free', 'Try Prospecta and manage a small number of properties and leads.',
    0, 5, 50, 10,
    '{"leadManagement":"basic","leadScoring":"basic","propertyAiTools":"basic","siteViewing":"basic","messenger":"none","propertyMatching":"none","messengerAutomation":false,"advancedLeadScoring":false,"advancedCrm":false}',
    0),
  ('starter', 'Starter', 'For individual agents who actively generate leads and need AI-assisted workflows.',
    19900, 25, 250, 100,
    '{"leadManagement":"full","leadScoring":"standard","propertyAiTools":"standard","siteViewing":"full","messenger":"basic","propertyMatching":"basic","messengerAutomation":false,"advancedLeadScoring":false,"advancedCrm":false}',
    1),
  ('pro', 'Pro', 'For agents who rely on Prospecta for lead management, Messenger automation, AI sales assistance and advanced CRM.',
    39900, null, null, null,
    '{"leadManagement":"advanced","leadScoring":"advanced","propertyAiTools":"advanced","siteViewing":"full","messenger":"advanced","propertyMatching":"advanced","messengerAutomation":true,"advancedLeadScoring":true,"advancedCrm":true}',
    2);

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user. Passwords live only in Supabase Auth.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null,
  role public.user_role not null default 'agent',
  plan text not null default 'free' references public.plans (id),
  plan_status public.plan_status not null default 'active',
  plan_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_plan_expires_at_idx on public.profiles (plan_expires_at)
  where plan <> 'free';

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a Free profile for every new auth user (self sign-up or admin invite).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in sync if the user changes it in Auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- The plan a user is actually entitled to right now. A paid plan that is not
-- active, or whose expiry has passed, falls back to 'free' immediately, even
-- before the maintenance job flips plan_status to 'expired'.
create or replace function public.effective_plan(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.plan = 'free' then 'free'
    when p.plan_status = 'active'
      and (p.plan_expires_at is null or p.plan_expires_at > now()) then p.plan
    else 'free'
  end
  from public.profiles p
  where p.id = p_user_id;
$$;

-- Start of the current calendar month in Philippine time, used for monthly quotas.
create or replace function public.current_month_start()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (date_trunc('month', now() at time zone 'Asia/Manila')) at time zone 'Asia/Manila';
$$;

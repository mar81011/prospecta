-- Minimal listings/leads/usage tables so plan limits are enforced in the
-- database. Full listing and lead features build on these tables.

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index listings_agent_status_idx on public.listings (agent_id, status);
create trigger listings_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  contact text not null default '',
  source text not null default 'manual',
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_agent_created_idx on public.leads (agent_id, created_at);
create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

-- Append-only usage log for monthly quotas. Counting events (rather than rows
-- in leads) means deleting a lead does not give quota back.
create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete cascade,
  metric text not null check (metric in ('lead_created', 'ai_generation')),
  detail text,
  created_at timestamptz not null default now()
);
create index usage_events_agent_metric_idx on public.usage_events (agent_id, metric, created_at);

-- ---------------------------------------------------------------------------
-- Limit enforcement. Uses effective_plan(), so an expired paid plan is held to
-- Free limits. Existing data is never removed; only new activity is blocked.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_listing_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
begin
  if new.status <> 'active' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' and old.agent_id = new.agent_id then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('listings:' || new.agent_id::text));

  select pl.max_active_listings into v_limit
  from public.plans pl where pl.id = public.effective_plan(new.agent_id);

  if v_limit is null then
    return new;
  end if;

  select count(*) into v_count from public.listings
  where agent_id = new.agent_id and status = 'active' and id <> new.id;

  if v_count >= v_limit then
    raise exception 'Your plan allows % active listings. Upgrade or archive a listing to add more.', v_limit
      using errcode = 'P0001', hint = 'LIMIT_LISTINGS';
  end if;
  return new;
end;
$$;

create trigger listings_enforce_limit
  before insert or update of status, agent_id on public.listings
  for each row execute function public.enforce_listing_limit();

create or replace function public.enforce_lead_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('leads:' || new.agent_id::text));

  select pl.max_leads_per_month into v_limit
  from public.plans pl where pl.id = public.effective_plan(new.agent_id);

  select count(*) into v_count from public.usage_events
  where agent_id = new.agent_id and metric = 'lead_created' and created_at >= public.current_month_start();

  if v_limit is not null and v_count >= v_limit then
    raise exception 'Your plan allows % new leads per month. Upgrade to add more.', v_limit
      using errcode = 'P0001', hint = 'LIMIT_LEADS';
  end if;

  insert into public.usage_events (agent_id, metric) values (new.agent_id, 'lead_created');
  return new;
end;
$$;

create trigger leads_enforce_limit
  before insert on public.leads
  for each row execute function public.enforce_lead_limit();

-- Every AI feature must call this before calling the model. It atomically
-- checks the monthly quota and records the usage. Returns remaining quota
-- (null when the plan has no fixed limit).
create or replace function public.consume_ai_generation(p_kind text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'P0001', hint = 'UNAUTHENTICATED';
  end if;
  if p_kind is null or p_kind !~ '^[a-z0-9_]{1,50}$' then
    raise exception 'Invalid usage kind' using errcode = 'P0001', hint = 'INVALID_KIND';
  end if;

  perform pg_advisory_xact_lock(hashtext('ai:' || v_uid::text));

  select pl.max_ai_generations_per_month into v_limit
  from public.plans pl where pl.id = public.effective_plan(v_uid);

  select count(*) into v_count from public.usage_events
  where agent_id = v_uid and metric = 'ai_generation' and created_at >= public.current_month_start();

  if v_limit is not null and v_count >= v_limit then
    raise exception 'You have used all % AI generations for this month. Upgrade for more.', v_limit
      using errcode = 'P0001', hint = 'LIMIT_AI';
  end if;

  insert into public.usage_events (agent_id, metric, detail) values (v_uid, 'ai_generation', p_kind);

  return case when v_limit is null then null else v_limit - v_count - 1 end;
end;
$$;

-- Current user's plan, limits and usage in one call.
create or replace function public.get_my_entitlements()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.plans%rowtype;
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'P0001', hint = 'UNAUTHENTICATED';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  select * into v_plan from public.plans where id = public.effective_plan(v_uid);

  return jsonb_build_object(
    'effective_plan', v_plan.id,
    'effective_plan_name', v_plan.name,
    'subscribed_plan', v_profile.plan,
    'plan_status', v_profile.plan_status,
    'plan_expires_at', v_profile.plan_expires_at,
    'limits', jsonb_build_object(
      'max_active_listings', v_plan.max_active_listings,
      'max_leads_per_month', v_plan.max_leads_per_month,
      'max_ai_generations_per_month', v_plan.max_ai_generations_per_month
    ),
    'features', v_plan.features,
    'usage', jsonb_build_object(
      'active_listings', (select count(*) from public.listings where agent_id = v_uid and status = 'active'),
      'leads_this_month', (select count(*) from public.usage_events
        where agent_id = v_uid and metric = 'lead_created' and created_at >= public.current_month_start()),
      'ai_generations_this_month', (select count(*) from public.usage_events
        where agent_id = v_uid and metric = 'ai_generation' and created_at >= public.current_month_start())
    )
  );
end;
$$;

revoke execute on function public.enforce_listing_limit() from public, anon, authenticated;
revoke execute on function public.enforce_lead_limit() from public, anon, authenticated;
revoke execute on function public.consume_ai_generation(text) from public, anon;
revoke execute on function public.get_my_entitlements() from public, anon;
grant execute on function public.consume_ai_generation(text) to authenticated;
grant execute on function public.get_my_entitlements() to authenticated;

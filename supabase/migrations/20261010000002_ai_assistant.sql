-- AI assistant: buyer chat on public listing pages, quota accounting for it,
-- and the plan feature that enables it.

-- Starter and Pro get the buyer chat; Free keeps the inquiry form only.
update public.plans set features = features || '{"aiChat": false}'::jsonb where id = 'free';
update public.plans set features = features || '{"aiChat": true}'::jsonb where id in ('starter', 'pro');

-- ---------------------------------------------------------------------------
-- Buyer chats. Only the server (service role) reads and writes these; buyers
-- are anonymous and hold an unguessable chat id.
-- ---------------------------------------------------------------------------
create table public.ai_chats (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  agent_id uuid not null references public.profiles (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  messages jsonb not null default '[]'::jsonb,
  reply_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_chats_listing_idx on public.ai_chats (listing_id, created_at);
create trigger ai_chats_updated_at before update on public.ai_chats
  for each row execute function public.set_updated_at();

alter table public.ai_chats enable row level security;
revoke all on public.ai_chats from anon, authenticated;
-- Agents can read chats on their own listings (shown on the lead page).
grant select on public.ai_chats to authenticated;
create policy "agents read chats on own listings" on public.ai_chats
  for select to authenticated using (agent_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Quota accounting for AI work done on an agent's behalf without their
-- session (buyer chat). Service role only; same rules as consume_ai_generation.
-- ---------------------------------------------------------------------------
create or replace function public.consume_ai_generation_for(p_agent_id uuid, p_kind text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
begin
  if p_kind is null or p_kind !~ '^[a-z0-9_]{1,50}$' then
    raise exception 'Invalid usage kind' using errcode = 'P0001', hint = 'INVALID_KIND';
  end if;

  perform pg_advisory_xact_lock(hashtext('ai:' || p_agent_id::text));

  select pl.max_ai_generations_per_month into v_limit
  from public.plans pl where pl.id = public.effective_plan(p_agent_id);

  select count(*) into v_count from public.usage_events
  where agent_id = p_agent_id and metric = 'ai_generation' and created_at >= public.current_month_start();

  if v_limit is not null and v_count >= v_limit then
    raise exception 'AI limit reached' using errcode = 'P0001', hint = 'LIMIT_AI';
  end if;

  insert into public.usage_events (agent_id, metric, detail) values (p_agent_id, 'ai_generation', p_kind);
  return case when v_limit is null then null else v_limit - v_count - 1 end;
end;
$$;

-- Whether a listing's agent currently has the buyer chat (used by the public page).
create or replace function public.listing_has_ai_chat(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((pl.features ->> 'aiChat')::boolean, false)
  from public.listings l
  join public.plans pl on pl.id = public.effective_plan(l.agent_id)
  where l.slug = p_slug and l.status = 'active';
$$;

revoke execute on function public.consume_ai_generation_for(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_ai_generation_for(uuid, text) to service_role;
revoke execute on function public.listing_has_ai_chat(text) from public;
grant execute on function public.listing_has_ai_chat(text) to anon, authenticated;

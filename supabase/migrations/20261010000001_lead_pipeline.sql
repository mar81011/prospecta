-- Lead pipeline: statuses, follow-ups, site viewings, and an activity timeline.

update public.leads set status = 'new'
 where status not in ('new', 'contacted', 'qualified', 'viewing', 'negotiating', 'won', 'lost');

alter table public.leads
  add constraint leads_status_check
    check (status in ('new', 'contacted', 'qualified', 'viewing', 'negotiating', 'won', 'lost')),
  add column next_follow_up_at timestamptz,
  add column viewing_at timestamptz,
  add column status_changed_at timestamptz not null default now();

create index leads_agent_follow_up_idx on public.leads (agent_id, next_follow_up_at) where next_follow_up_at is not null;
create index leads_agent_viewing_idx on public.leads (agent_id, viewing_at) where viewing_at is not null;
create index leads_agent_status_idx on public.leads (agent_id, status);

-- ---------------------------------------------------------------------------
-- Activity timeline: agent notes, automatic status/schedule entries, AI notes.
-- ---------------------------------------------------------------------------
create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  agent_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('note', 'status', 'follow_up', 'viewing', 'ai', 'inquiry')),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);

alter table public.lead_activities enable row level security;
revoke all on public.lead_activities from anon, authenticated;
grant select, insert on public.lead_activities to authenticated;
grant delete on public.lead_activities to authenticated;

create policy "read own lead activity or admin" on public.lead_activities
  for select to authenticated using (agent_id = (select auth.uid()) or (select public.is_admin()));
-- Agents add notes by hand; other kinds are written by triggers and server code.
create policy "add notes to own unlocked leads" on public.lead_activities
  for insert to authenticated with check (
    agent_id = (select auth.uid())
    and kind = 'note'
    and exists (select 1 from public.leads l where l.id = lead_id and l.agent_id = (select auth.uid()) and not l.locked)
  );
create policy "delete own notes" on public.lead_activities
  for delete to authenticated using (agent_id = (select auth.uid()) and kind = 'note');

-- Log status, follow-up and viewing changes automatically.
create or replace function public.log_lead_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  labels constant jsonb := '{"new":"New","contacted":"Contacted","qualified":"Qualified","viewing":"Site viewing","negotiating":"Negotiating","won":"Won","lost":"Lost"}';
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
    insert into public.lead_activities (lead_id, agent_id, kind, body)
    values (new.id, new.agent_id, 'status',
      format('Status changed from %s to %s', labels ->> old.status, labels ->> new.status));
  end if;
  if new.viewing_at is distinct from old.viewing_at then
    insert into public.lead_activities (lead_id, agent_id, kind, body)
    values (new.id, new.agent_id, 'viewing',
      case when new.viewing_at is null then 'Site viewing cancelled'
        else 'Site viewing scheduled for ' || to_char(new.viewing_at at time zone 'Asia/Manila', 'FMMon FMDD, YYYY FMHH12:MI AM') end);
  end if;
  if new.next_follow_up_at is distinct from old.next_follow_up_at and new.next_follow_up_at is not null then
    insert into public.lead_activities (lead_id, agent_id, kind, body)
    values (new.id, new.agent_id, 'follow_up',
      'Follow-up set for ' || to_char(new.next_follow_up_at at time zone 'Asia/Manila', 'FMMon FMDD, YYYY'));
  end if;
  return new;
end;
$$;

create trigger leads_log_changes before update on public.leads
  for each row execute function public.log_lead_changes();

-- The buyer's original inquiry message starts the timeline.
create or replace function public.log_lead_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source in ('website', 'facebook') then
    insert into public.lead_activities (lead_id, agent_id, kind, body)
    values (new.id, new.agent_id, 'inquiry',
      case when new.message <> '' then 'Inquiry: ' || new.message
        else 'Sent an inquiry from the listing page' end);
  end if;
  return new;
end;
$$;

create trigger leads_log_created after insert on public.leads
  for each row execute function public.log_lead_created();

-- Agents can work only unlocked leads, and only these columns.
revoke update on public.leads from authenticated;
grant update (name, contact, phone, email, status, next_follow_up_at, viewing_at) on public.leads to authenticated;

drop policy "update own leads" on public.leads;
create policy "update own unlocked leads" on public.leads
  for update to authenticated
  using (agent_id = (select auth.uid()) and not locked)
  with check (agent_id = (select auth.uid()) and not locked);

revoke execute on function public.log_lead_changes() from public, anon, authenticated;
revoke execute on function public.log_lead_created() from public, anon, authenticated;

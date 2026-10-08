-- Manual GCash payments, admin-managed settings, in-app notifications, audit log.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles (id) on delete cascade,
  plan_id text not null references public.plans (id),
  -- Integer centavos, always looked up server-side from plans.price_centavos.
  amount_centavos integer not null check (amount_centavos > 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  -- Which flow produced this payment. Only 'manual_gcash' exists today; a
  -- future PayMongo integration would add 'paymongo' and reuse the same table.
  provider text not null default 'manual_gcash',
  -- Normalized to digits only.
  gcash_reference text not null check (gcash_reference ~ '^[0-9]{6,20}$'),
  payment_date date not null,
  screenshot_path text,
  notes text check (char_length(notes) <= 1000),
  status public.payment_status not null default 'PENDING',
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_not_free check (plan_id <> 'free'),
  constraint payments_rejection_reason_required
    check (status <> 'REJECTED' or (rejection_reason is not null and rejected_at is not null)),
  constraint payments_approval_fields_required
    check (status <> 'APPROVED' or (approved_at is not null))
);

-- A GCash reference can back at most one approved payment.
create unique index payments_reference_approved_uidx
  on public.payments (gcash_reference) where status = 'APPROVED';

-- One open request per agent keeps the admin queue unambiguous.
create unique index payments_one_pending_per_agent_uidx
  on public.payments (agent_id) where status = 'PENDING';

create index payments_agent_idx on public.payments (agent_id, submitted_at desc);
create index payments_status_idx on public.payments (status, submitted_at);
create index payments_approved_at_idx on public.payments (approved_at) where status = 'APPROVED';

create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- app_settings: single row, edited from /admin/settings.
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id boolean primary key default true check (id),
  gcash_number text not null default '',
  gcash_account_name text not null default '',
  payment_instructions text not null default '',
  support_email text not null default '',
  support_messenger_url text not null default '',
  payment_request_ttl_days integer not null default 7 check (payment_request_ttl_days between 1 and 90),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (payment_instructions)
values ('Send the exact plan amount via GCash, then enter the 13-digit reference number from your GCash receipt.');

-- ---------------------------------------------------------------------------
-- notifications: in-app only for the MVP.
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  link text,
  -- Optional key so recurring jobs do not send the same notice twice.
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create unique index notifications_dedupe_uidx on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

-- ---------------------------------------------------------------------------
-- audit_logs: append-only.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

-- Internal helpers used by the billing functions. Not callable by clients.
create or replace function public.write_audit(
  p_actor uuid, p_action text, p_entity_type text, p_entity_id text, p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;

create or replace function public.notify_user(
  p_user uuid, p_type text, p_title text, p_body text, p_link text default null, p_dedupe_key text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, link, dedupe_key)
  values (p_user, p_type, p_title, p_body, p_link, p_dedupe_key)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
$$;

create or replace function public.notify_admins(p_type text, p_title text, p_body text, p_link text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, link)
  select id, p_type, p_title, p_body, p_link from public.profiles where role = 'admin';
$$;

revoke execute on function public.write_audit(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.notify_user(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.notify_admins(text, text, text, text) from public, anon, authenticated;

-- Billing state machine. Every plan or payment status change goes through these
-- SECURITY DEFINER functions; clients have no direct write access (see RLS migration).
--
-- Errors are raised with errcode P0001 and a machine-readable HINT that the app
-- maps to user-facing messages.

-- ---------------------------------------------------------------------------
-- activate_subscription: the provider-agnostic activation step.
-- Called by approve_payment today. A future PayMongo webhook (running with the
-- service role) calls the same function after verifying the payment.
--
-- Period rules (30-day periods, not calendar months):
--   * Same plan, still active  -> extend from the current expiry (renewal).
--   * Otherwise (free, expired, or switching plans) -> start a fresh period now.
--     Switching plans does not prorate; remaining time on the old plan is dropped.
-- ---------------------------------------------------------------------------
create or replace function public.activate_subscription(
  p_agent_id uuid,
  p_plan_id text,
  p_payment_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_plan public.plans%rowtype;
  v_new_expiry timestamptz;
begin
  select * into v_plan from public.plans where id = p_plan_id;
  if not found or p_plan_id = 'free' then
    raise exception 'Invalid plan for activation' using errcode = 'P0001', hint = 'INVALID_PLAN';
  end if;

  select * into v_profile from public.profiles where id = p_agent_id for update;
  if not found then
    raise exception 'Agent not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;

  if v_profile.plan = p_plan_id
     and v_profile.plan_status = 'active'
     and v_profile.plan_expires_at is not null
     and v_profile.plan_expires_at > now() then
    v_new_expiry := v_profile.plan_expires_at + make_interval(days => v_plan.billing_period_days);
  else
    v_new_expiry := now() + make_interval(days => v_plan.billing_period_days);
  end if;

  update public.profiles
     set plan = p_plan_id,
         plan_status = 'active',
         plan_expires_at = v_new_expiry
   where id = p_agent_id;

  perform public.write_audit(
    auth.uid(), 'SUBSCRIPTION_ACTIVATED', 'profile', p_agent_id::text,
    jsonb_build_object(
      'payment_id', p_payment_id,
      'previous_plan', v_profile.plan,
      'previous_status', v_profile.plan_status,
      'previous_expires_at', v_profile.plan_expires_at,
      'plan', p_plan_id,
      'expires_at', v_new_expiry
    )
  );

  return v_new_expiry;
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_payment: agent reports a manual GCash transfer.
-- The amount is never taken from the client; it comes from plans.price_centavos.
-- ---------------------------------------------------------------------------
create or replace function public.submit_payment(
  p_plan_id text,
  p_reference text,
  p_payment_date date,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.plans%rowtype;
  v_ref text;
  v_payment_id uuid;
  v_agent_name text;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'P0001', hint = 'UNAUTHENTICATED';
  end if;

  select * into v_plan from public.plans where id = p_plan_id and active;
  if not found or v_plan.id = 'free' or v_plan.price_centavos <= 0 then
    raise exception 'Invalid plan' using errcode = 'P0001', hint = 'INVALID_PLAN';
  end if;

  v_ref := regexp_replace(coalesce(p_reference, ''), '[^0-9]', '', 'g');
  if v_ref !~ '^[0-9]{6,20}$' then
    raise exception 'Invalid GCash reference number' using errcode = 'P0001', hint = 'INVALID_REFERENCE';
  end if;

  if p_payment_date is null
     or p_payment_date > (now() at time zone 'Asia/Manila')::date + 1
     or p_payment_date < (now() at time zone 'Asia/Manila')::date - 60 then
    raise exception 'Invalid payment date' using errcode = 'P0001', hint = 'INVALID_DATE';
  end if;

  if p_notes is not null and char_length(p_notes) > 1000 then
    raise exception 'Notes are too long' using errcode = 'P0001', hint = 'INVALID_NOTES';
  end if;

  if exists (select 1 from public.payments where gcash_reference = v_ref and status = 'APPROVED') then
    raise exception 'This GCash reference has already been used' using errcode = 'P0001', hint = 'DUPLICATE_REFERENCE';
  end if;

  if exists (select 1 from public.payments where agent_id = v_uid and status = 'PENDING') then
    raise exception 'You already have a payment awaiting review' using errcode = 'P0001', hint = 'PENDING_EXISTS';
  end if;

  insert into public.payments (agent_id, plan_id, amount_centavos, currency, gcash_reference, payment_date, notes)
  values (v_uid, v_plan.id, v_plan.price_centavos, v_plan.currency, v_ref, p_payment_date, nullif(trim(p_notes), ''))
  returning id into v_payment_id;

  perform public.write_audit(
    v_uid, 'AGENT_SUBMITTED_PAYMENT', 'payment', v_payment_id::text,
    jsonb_build_object('plan', v_plan.id, 'amount_centavos', v_plan.price_centavos, 'gcash_reference', v_ref)
  );

  select coalesce(nullif(name, ''), email) into v_agent_name from public.profiles where id = v_uid;
  perform public.notify_admins(
    'payment_submitted',
    'New payment submitted',
    format('New %s payment submitted by %s.', v_plan.name, v_agent_name),
    '/admin/payments/' || v_payment_id
  );

  return v_payment_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- approve_payment: admin confirms the GCash transfer. Runs as one transaction:
-- payment status, plan activation, audit entry and notification succeed or
-- fail together.
-- ---------------------------------------------------------------------------
create or replace function public.approve_payment(p_payment_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_payment public.payments%rowtype;
  v_plan_name text;
  v_expiry timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = 'P0001', hint = 'FORBIDDEN';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  if v_payment.status <> 'PENDING' then
    raise exception 'Only pending payments can be approved' using errcode = 'P0001', hint = 'NOT_PENDING';
  end if;

  if exists (
    select 1 from public.payments
    where gcash_reference = v_payment.gcash_reference and status = 'APPROVED' and id <> v_payment.id
  ) then
    raise exception 'This GCash reference was already approved for another payment'
      using errcode = 'P0001', hint = 'DUPLICATE_REFERENCE';
  end if;

  update public.payments
     set status = 'APPROVED',
         approved_at = now(),
         reviewed_by = v_uid
   where id = v_payment.id;

  v_expiry := public.activate_subscription(v_payment.agent_id, v_payment.plan_id, v_payment.id);

  perform public.write_audit(
    v_uid, 'ADMIN_APPROVED_PAYMENT', 'payment', v_payment.id::text,
    jsonb_build_object(
      'agent_id', v_payment.agent_id,
      'plan', v_payment.plan_id,
      'amount_centavos', v_payment.amount_centavos,
      'gcash_reference', v_payment.gcash_reference,
      'expires_at', v_expiry
    )
  );

  select name into v_plan_name from public.plans where id = v_payment.plan_id;
  perform public.notify_user(
    v_payment.agent_id,
    'payment_approved',
    'Payment approved',
    format('Your %s plan is now active until %s.', v_plan_name,
      to_char(v_expiry at time zone 'Asia/Manila', 'FMMonth FMDD, YYYY')),
    '/payment/history'
  );

  return v_expiry;
end;
$$;

-- ---------------------------------------------------------------------------
-- reject_payment: the record is kept for auditing, never deleted.
-- ---------------------------------------------------------------------------
create or replace function public.reject_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_payment public.payments%rowtype;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = 'P0001', hint = 'FORBIDDEN';
  end if;
  if v_reason = '' or char_length(v_reason) > 500 then
    raise exception 'A rejection reason is required' using errcode = 'P0001', hint = 'REASON_REQUIRED';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  if v_payment.status <> 'PENDING' then
    raise exception 'Only pending payments can be rejected' using errcode = 'P0001', hint = 'NOT_PENDING';
  end if;

  update public.payments
     set status = 'REJECTED',
         rejected_at = now(),
         rejection_reason = v_reason,
         reviewed_by = v_uid
   where id = v_payment.id;

  perform public.write_audit(
    v_uid, 'ADMIN_REJECTED_PAYMENT', 'payment', v_payment.id::text,
    jsonb_build_object('agent_id', v_payment.agent_id, 'plan', v_payment.plan_id, 'reason', v_reason)
  );

  perform public.notify_user(
    v_payment.agent_id,
    'payment_rejected',
    'Payment could not be verified',
    format('Reason: %s. Please review and submit a new payment.', v_reason),
    '/payment/history'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin overrides
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_plan(
  p_agent_id uuid,
  p_plan_id text,
  p_status public.plan_status,
  p_expires_at timestamptz,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = 'P0001', hint = 'FORBIDDEN';
  end if;
  if not exists (select 1 from public.plans where id = p_plan_id) then
    raise exception 'Invalid plan' using errcode = 'P0001', hint = 'INVALID_PLAN';
  end if;
  if p_plan_id <> 'free' and p_status = 'active' and p_expires_at is null then
    raise exception 'An active paid plan needs an expiry date' using errcode = 'P0001', hint = 'EXPIRY_REQUIRED';
  end if;

  select * into v_before from public.profiles where id = p_agent_id for update;
  if not found then
    raise exception 'Agent not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;

  update public.profiles
     set plan = p_plan_id,
         plan_status = case when p_plan_id = 'free' then 'active' else p_status end,
         plan_expires_at = case when p_plan_id = 'free' then null else p_expires_at end
   where id = p_agent_id;

  perform public.write_audit(
    auth.uid(), 'ADMIN_CHANGED_PLAN', 'profile', p_agent_id::text,
    jsonb_build_object(
      'before', jsonb_build_object('plan', v_before.plan, 'status', v_before.plan_status, 'expires_at', v_before.plan_expires_at),
      'after', jsonb_build_object('plan', p_plan_id, 'status', p_status, 'expires_at', p_expires_at),
      'note', p_note
    )
  );
end;
$$;

create or replace function public.admin_set_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.user_role;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = 'P0001', hint = 'FORBIDDEN';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own role' using errcode = 'P0001', hint = 'SELF_ROLE_CHANGE';
  end if;

  select role into v_before from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'User not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;

  update public.profiles set role = p_role where id = p_user_id;

  perform public.write_audit(
    auth.uid(), 'ADMIN_CHANGED_ROLE', 'profile', p_user_id::text,
    jsonb_build_object('before', v_before, 'after', p_role)
  );
end;
$$;

create or replace function public.admin_update_settings(
  p_gcash_number text,
  p_gcash_account_name text,
  p_payment_instructions text,
  p_support_email text,
  p_support_messenger_url text,
  p_payment_request_ttl_days integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.app_settings%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = 'P0001', hint = 'FORBIDDEN';
  end if;

  select * into v_before from public.app_settings where id for update;

  update public.app_settings
     set gcash_number = trim(p_gcash_number),
         gcash_account_name = trim(p_gcash_account_name),
         payment_instructions = trim(p_payment_instructions),
         support_email = trim(p_support_email),
         support_messenger_url = trim(p_support_messenger_url),
         payment_request_ttl_days = p_payment_request_ttl_days,
         updated_by = auth.uid()
   where id;

  perform public.write_audit(
    auth.uid(), 'ADMIN_UPDATED_SETTINGS', 'app_settings', 'singleton',
    jsonb_build_object('before', to_jsonb(v_before) - 'updated_at' - 'updated_by')
  );
end;
$$;

create or replace function public.admin_update_plan(
  p_plan_id text,
  p_price_centavos integer,
  p_max_active_listings integer,
  p_max_leads_per_month integer,
  p_max_ai_generations_per_month integer,
  p_description text,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.plans%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = 'P0001', hint = 'FORBIDDEN';
  end if;

  select * into v_before from public.plans where id = p_plan_id for update;
  if not found then
    raise exception 'Plan not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  if p_plan_id = 'free' and (p_price_centavos <> 0 or not p_active) then
    raise exception 'The Free plan must stay free and active' using errcode = 'P0001', hint = 'INVALID_PLAN';
  end if;
  if p_plan_id <> 'free' and p_price_centavos <= 0 then
    raise exception 'Paid plans need a price' using errcode = 'P0001', hint = 'INVALID_PRICE';
  end if;

  update public.plans
     set price_centavos = p_price_centavos,
         max_active_listings = p_max_active_listings,
         max_leads_per_month = p_max_leads_per_month,
         max_ai_generations_per_month = p_max_ai_generations_per_month,
         description = coalesce(p_description, description),
         active = p_active
   where id = p_plan_id;

  perform public.write_audit(
    auth.uid(), 'ADMIN_UPDATED_PLAN', 'plan', p_plan_id,
    jsonb_build_object(
      'before', jsonb_build_object(
        'price_centavos', v_before.price_centavos,
        'max_active_listings', v_before.max_active_listings,
        'max_leads_per_month', v_before.max_leads_per_month,
        'max_ai_generations_per_month', v_before.max_ai_generations_per_month,
        'active', v_before.active),
      'after', jsonb_build_object(
        'price_centavos', p_price_centavos,
        'max_active_listings', p_max_active_listings,
        'max_leads_per_month', p_max_leads_per_month,
        'max_ai_generations_per_month', p_max_ai_generations_per_month,
        'active', p_active)
    )
  );
end;
$$;

-- Records an admin-sent invitation (the invite itself goes through Supabase Auth
-- from the server with the service role).
create or replace function public.admin_log_invite(p_user_id uuid, p_email text, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = 'P0001', hint = 'FORBIDDEN';
  end if;
  if p_name is not null and p_name <> '' then
    update public.profiles set name = p_name where id = p_user_id and name = '';
  end if;
  perform public.write_audit(
    auth.uid(), 'ADMIN_CREATED_AGENT', 'profile', p_user_id::text,
    jsonb_build_object('email', p_email, 'name', p_name)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_overview: dashboard numbers. Revenue counts APPROVED payments only.
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = 'P0001', hint = 'FORBIDDEN';
  end if;

  with agents as (
    select p.*, public.effective_plan(p.id) as eff
    from public.profiles p
    where p.role = 'agent'
  )
  select jsonb_build_object(
    'total_agents', (select count(*) from agents),
    'paid_agents', (select count(*) from agents where eff <> 'free'),
    'free_agents', (select count(*) from agents where eff = 'free'),
    'pending_payments', (select count(*) from public.payments where status = 'PENDING'),
    'monthly_revenue_centavos', (
      select coalesce(sum(amount_centavos), 0) from public.payments
      where status = 'APPROVED' and approved_at >= public.current_month_start()
    ),
    'expiring_soon', (
      select count(*) from agents
      where eff <> 'free' and plan_expires_at <= now() + interval '7 days'
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- run_subscription_maintenance: daily job (Vercel Cron -> service role).
-- Never deletes data. Expired plans keep `plan` and only change `plan_status`.
-- ---------------------------------------------------------------------------
create or replace function public.run_subscription_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired_profiles integer := 0;
  v_expired_payments integer := 0;
  v_warnings integer := 0;
  v_ttl integer;
  r record;
begin
  -- 1. Lapsed subscriptions.
  for r in
    update public.profiles p
       set plan_status = 'expired'
     where p.plan <> 'free'
       and p.plan_status = 'active'
       and p.plan_expires_at is not null
       and p.plan_expires_at <= now()
    returning p.id, p.plan, p.plan_expires_at
  loop
    v_expired_profiles := v_expired_profiles + 1;
    perform public.write_audit(null, 'SUBSCRIPTION_EXPIRED', 'profile', r.id::text,
      jsonb_build_object('plan', r.plan, 'expired_at', r.plan_expires_at));
    perform public.notify_user(
      r.id, 'plan_expired', 'Your plan has expired',
      format('Your %s plan has expired. Your data is safe and Free features remain available. Renew any time.',
        (select name from public.plans where id = r.plan)),
      '/pricing',
      'expired:' || r.plan || ':' || r.plan_expires_at::text
    );
  end loop;

  -- 2. Stale pending payment requests.
  select payment_request_ttl_days into v_ttl from public.app_settings where id;
  for r in
    update public.payments
       set status = 'EXPIRED'
     where status = 'PENDING'
       and submitted_at < now() - make_interval(days => coalesce(v_ttl, 7))
    returning id, agent_id
  loop
    v_expired_payments := v_expired_payments + 1;
    perform public.write_audit(null, 'PAYMENT_EXPIRED', 'payment', r.id::text, '{}'::jsonb);
    perform public.notify_user(
      r.agent_id, 'payment_expired', 'Payment request expired',
      'Your payment request was not reviewed in time and has expired. If you already paid, please contact support or submit it again.',
      '/payment/history'
    );
  end loop;

  -- 3. Expiry warnings (once per expiry date).
  for r in
    select p.id, p.plan, p.plan_expires_at, pl.name as plan_name
    from public.profiles p
    join public.plans pl on pl.id = p.plan
    where p.plan <> 'free'
      and p.plan_status = 'active'
      and p.plan_expires_at > now()
      and p.plan_expires_at <= now() + interval '5 days'
  loop
    perform public.notify_user(
      r.id, 'plan_expiring', 'Your plan expires soon',
      format('Your %s plan expires in %s day(s). Renew to keep your features.',
        r.plan_name, greatest(1, ceil(extract(epoch from (r.plan_expires_at - now())) / 86400)::int)),
      '/payment?plan=' || r.plan,
      'expiring:' || r.plan || ':' || r.plan_expires_at::text
    );
    v_warnings := v_warnings + 1;
  end loop;

  return jsonb_build_object(
    'expired_profiles', v_expired_profiles,
    'expired_payments', v_expired_payments,
    'expiry_warnings_checked', v_warnings
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Execute grants. Supabase grants EXECUTE to anon/authenticated by default, so
-- revoke explicitly and re-grant only what clients may call.
-- ---------------------------------------------------------------------------
revoke execute on function public.activate_subscription(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.run_subscription_maintenance() from public, anon, authenticated;
revoke execute on function public.effective_plan(uuid) from public, anon, authenticated;

revoke execute on function public.submit_payment(text, text, date, text) from public, anon;
revoke execute on function public.approve_payment(uuid) from public, anon;
revoke execute on function public.reject_payment(uuid, text) from public, anon;
revoke execute on function public.admin_set_plan(uuid, text, public.plan_status, timestamptz, text) from public, anon;
revoke execute on function public.admin_set_role(uuid, public.user_role) from public, anon;
revoke execute on function public.admin_update_settings(text, text, text, text, text, integer) from public, anon;
revoke execute on function public.admin_update_plan(text, integer, integer, integer, integer, text, boolean) from public, anon;
revoke execute on function public.admin_log_invite(uuid, text, text) from public, anon;
revoke execute on function public.admin_overview() from public, anon;
revoke execute on function public.is_admin() from public, anon;

grant execute on function public.submit_payment(text, text, date, text) to authenticated;
grant execute on function public.approve_payment(uuid) to authenticated;
grant execute on function public.reject_payment(uuid, text) to authenticated;
grant execute on function public.admin_set_plan(uuid, text, public.plan_status, timestamptz, text) to authenticated;
grant execute on function public.admin_set_role(uuid, public.user_role) to authenticated;
grant execute on function public.admin_update_settings(text, text, text, text, text, integer) to authenticated;
grant execute on function public.admin_update_plan(text, integer, integer, integer, integer, text, boolean) to authenticated;
grant execute on function public.admin_log_invite(uuid, text, text) to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.is_admin() to authenticated;

grant execute on function public.activate_subscription(uuid, text, uuid) to service_role;
grant execute on function public.run_subscription_maintenance() to service_role;
grant execute on function public.effective_plan(uuid) to service_role;

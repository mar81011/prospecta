-- Public listing pages, listing photos, and buyer inquiries that become leads.

-- ---------------------------------------------------------------------------
-- Listing slugs for public URLs: /p/{slug}
-- ---------------------------------------------------------------------------
create or replace function public.slugify(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', '-', 'g'));
$$;

alter table public.listings add column slug text;

update public.listings
   set slug = coalesce(nullif(left(public.slugify(title), 60), ''), 'listing') || '-' || substr(replace(id::text, '-', ''), 1, 8)
 where slug is null;

alter table public.listings
  alter column slug set not null,
  add constraint listings_slug_key unique (slug);

-- Set once on insert; the slug stays stable when the title is edited so shared links keep working.
create or replace function public.set_listing_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := coalesce(nullif(left(public.slugify(new.title), 60), ''), 'listing')
      || '-' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  return new;
end;
$$;

create trigger listings_set_slug before insert on public.listings
  for each row execute function public.set_listing_slug();

-- Agents cannot pick or change slugs directly.
revoke update on public.listings from authenticated;
grant update (title, status, listing_type, property_type, price_centavos, address, city, province,
  bedrooms, bathrooms, floor_area_sqm, lot_area_sqm, parking_slots, furnishing, description)
  on public.listings to authenticated;

-- ---------------------------------------------------------------------------
-- Agent contact details shown on public listing pages
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column phone text not null default '' check (char_length(phone) <= 30);

grant update (name, phone) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Listing photos. Files live in the public `listing-photos` bucket so Facebook
-- and buyers can load them; uploads are validated and written server-side.
-- ---------------------------------------------------------------------------
create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  agent_id uuid not null references public.profiles (id) on delete cascade,
  path text not null unique,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index listing_photos_listing_idx on public.listing_photos (listing_id, position, created_at);

create or replace function public.enforce_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.listings where id = new.listing_id and agent_id = new.agent_id) then
    raise exception 'Listing not found' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;
  perform pg_advisory_xact_lock(hashtext('photos:' || new.listing_id::text));
  if (select count(*) from public.listing_photos where listing_id = new.listing_id) >= 10 then
    raise exception 'A listing can have up to 10 photos' using errcode = 'P0001', hint = 'LIMIT_PHOTOS';
  end if;
  return new;
end;
$$;

create trigger listing_photos_enforce_limit before insert on public.listing_photos
  for each row execute function public.enforce_photo_limit();

alter table public.listing_photos enable row level security;
revoke all on public.listing_photos from anon, authenticated;
grant select, insert, delete on public.listing_photos to authenticated;
grant update (position) on public.listing_photos to authenticated;

create policy "read own photos or admin" on public.listing_photos
  for select to authenticated using (agent_id = (select auth.uid()) or (select public.is_admin()));
create policy "insert own photos" on public.listing_photos
  for insert to authenticated with check (agent_id = (select auth.uid()));
create policy "reorder own photos" on public.listing_photos
  for update to authenticated using (agent_id = (select auth.uid())) with check (agent_id = (select auth.uid()));
create policy "delete own photos" on public.listing_photos
  for delete to authenticated using (agent_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Leads from buyer inquiries
-- ---------------------------------------------------------------------------
alter table public.leads
  add column listing_id uuid references public.listings (id) on delete set null,
  add column phone text not null default '' check (char_length(phone) <= 30),
  add column email text not null default '' check (char_length(email) <= 200),
  add column message text not null default '' check (char_length(message) <= 2000),
  -- Inquiries that arrive after the monthly lead limit is used up are kept but
  -- locked until the agent upgrades, so buyers are never silently lost.
  add column locked boolean not null default false,
  add constraint leads_source_check check (source in ('manual', 'website', 'facebook'));

create index leads_listing_idx on public.leads (listing_id);

-- Inbound inquiries over the limit are locked instead of rejected.
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
    if new.source in ('website', 'facebook') then
      new.locked := true;
    else
      raise exception 'Your plan allows % new leads per month. Upgrade to add more.', v_limit
        using errcode = 'P0001', hint = 'LIMIT_LEADS';
    end if;
  end if;

  insert into public.usage_events (agent_id, metric) values (new.agent_id, 'lead_created');
  return new;
end;
$$;

-- Agents cannot unlock leads or reassign them by writing to the table.
revoke update on public.leads from authenticated;
grant update (name, contact, phone, email, status) on public.leads to authenticated;

-- ---------------------------------------------------------------------------
-- Public read of one active listing (anonymous visitors, Facebook's crawler)
-- ---------------------------------------------------------------------------
create or replace function public.get_public_listing(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', l.id,
    'slug', l.slug,
    'title', l.title,
    'listing_type', l.listing_type,
    'property_type', l.property_type,
    'price_centavos', l.price_centavos,
    'address', l.address,
    'city', l.city,
    'province', l.province,
    'bedrooms', l.bedrooms,
    'bathrooms', l.bathrooms,
    'floor_area_sqm', l.floor_area_sqm,
    'lot_area_sqm', l.lot_area_sqm,
    'parking_slots', l.parking_slots,
    'furnishing', l.furnishing,
    'description', l.description,
    'updated_at', l.updated_at,
    'agent_name', p.name,
    'agent_phone', p.phone,
    'photos', coalesce((
      select jsonb_agg(ph.path order by ph.position, ph.created_at)
      from public.listing_photos ph where ph.listing_id = l.id
    ), '[]'::jsonb)
  )
  from public.listings l
  join public.profiles p on p.id = l.agent_id
  where l.slug = p_slug and l.status = 'active';
$$;

-- ---------------------------------------------------------------------------
-- submit_inquiry: a buyer on a public listing page becomes a lead.
-- ---------------------------------------------------------------------------
create or replace function public.submit_inquiry(
  p_slug text,
  p_name text,
  p_phone text,
  p_email text,
  p_message text,
  p_source text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_message text := trim(coalesce(p_message, ''));
  v_source text := case when p_source = 'facebook' then 'facebook' else 'website' end;
  v_locked boolean;
begin
  select * into v_listing from public.listings where slug = p_slug and status = 'active';
  if not found then
    raise exception 'This listing is no longer available' using errcode = 'P0001', hint = 'NOT_FOUND';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'Enter your name' using errcode = 'P0001', hint = 'INVALID_NAME';
  end if;
  if v_phone = '' and v_email = '' then
    raise exception 'Enter a phone number or email' using errcode = 'P0001', hint = 'CONTACT_REQUIRED';
  end if;
  if v_phone <> '' and v_phone !~ '^\+?[0-9 ()-]{7,20}$' then
    raise exception 'Enter a valid phone number' using errcode = 'P0001', hint = 'INVALID_PHONE';
  end if;
  if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email' using errcode = 'P0001', hint = 'INVALID_EMAIL';
  end if;
  if char_length(v_message) > 2000 then
    raise exception 'Message is too long' using errcode = 'P0001', hint = 'INVALID_MESSAGE';
  end if;

  -- Basic flood protection: the same contact can inquire about a listing a few times a day.
  if (
    select count(*) from public.leads
    where listing_id = v_listing.id
      and created_at > now() - interval '1 day'
      and ((v_phone <> '' and phone = v_phone) or (v_email <> '' and email = v_email))
  ) >= 3 then
    raise exception 'You already sent an inquiry for this listing' using errcode = 'P0001', hint = 'TOO_MANY';
  end if;

  insert into public.leads (agent_id, listing_id, name, contact, phone, email, message, source)
  values (
    v_listing.agent_id, v_listing.id, v_name,
    concat_ws(' / ', nullif(v_phone, ''), nullif(v_email, '')),
    v_phone, v_email, v_message, v_source
  )
  returning locked into v_locked;

  perform public.notify_user(
    v_listing.agent_id,
    'new_inquiry',
    case when v_locked then 'New inquiry (locked)' else 'New inquiry' end,
    case when v_locked
      then format('Someone is interested in "%s". You have reached your monthly lead limit; upgrade to see their details.', v_listing.title)
      else format('%s is interested in "%s".', v_name, v_listing.title)
    end,
    '/leads'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Upgrading unlocks inquiries that arrived over the limit.
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

  update public.leads set locked = false where agent_id = p_agent_id and locked;

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

revoke execute on function public.enforce_photo_limit() from public, anon, authenticated;
revoke execute on function public.set_listing_slug() from public, anon, authenticated;
revoke execute on function public.get_public_listing(text) from public;
revoke execute on function public.submit_inquiry(text, text, text, text, text, text) from public;
grant execute on function public.get_public_listing(text) to anon, authenticated;
grant execute on function public.submit_inquiry(text, text, text, text, text, text) to anon, authenticated;
-- activate_subscription keeps its existing grants (service_role only).

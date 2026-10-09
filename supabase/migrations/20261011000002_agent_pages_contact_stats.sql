-- Public agent pages (/a/{slug}), Messenger/Viber contact buttons, and listing
-- stats (page views and contact-button taps).

-- ---------------------------------------------------------------------------
-- Agent profile: public handle, short bio, chat apps
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column slug text,
  add column bio text not null default '' check (char_length(bio) <= 300),
  -- Facebook username or numeric ID, used for https://m.me/{messenger}
  add column messenger text not null default '' check (messenger = '' or messenger ~ '^[A-Za-z0-9.]{3,50}$'),
  -- Buyers can reach the agent on Viber at their mobile number.
  add column viber boolean not null default false;

update public.profiles
   set slug = coalesce(nullif(trim(both '-' from left(public.slugify(name), 30)), ''), 'agent')
     || '-' || substr(replace(id::text, '-', ''), 1, 6)
 where slug is null;

alter table public.profiles
  alter column slug set not null,
  add constraint profiles_slug_key unique (slug),
  add constraint profiles_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$');

create or replace function public.set_profile_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := coalesce(nullif(trim(both '-' from left(public.slugify(new.name), 30)), ''), 'agent')
      || '-' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  return new;
end;
$$;

create trigger profiles_set_slug before insert on public.profiles
  for each row execute function public.set_profile_slug();

grant update (name, phone, slug, bio, messenger, viber) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Public listing data: adds the agent's page and chat apps.
-- Same as 20261011000001 plus agent_slug, agent_messenger, agent_viber.
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
    'agent_photo', p.photo_path,
    'agent_slug', p.slug,
    'agent_messenger', p.messenger,
    'agent_viber', p.viber,
    'photos', coalesce((
      select jsonb_agg(ph.path order by ph.position, ph.created_at)
      from public.listing_photos ph where ph.listing_id = l.id
    ), '[]'::jsonb)
  )
  from public.listings l
  join public.profiles p on p.id = l.agent_id
  where l.slug = p_slug and l.status = 'active';
$$;

-- One agent's public page: contact details and active listings.
create or replace function public.get_public_agent(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'slug', p.slug,
    'name', p.name,
    'phone', p.phone,
    'photo', p.photo_path,
    'bio', p.bio,
    'messenger', p.messenger,
    'viber', p.viber,
    'listings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', l.slug,
        'title', l.title,
        'listing_type', l.listing_type,
        'property_type', l.property_type,
        'price_centavos', l.price_centavos,
        'city', l.city,
        'province', l.province,
        'bedrooms', l.bedrooms,
        'bathrooms', l.bathrooms,
        'floor_area_sqm', l.floor_area_sqm,
        'lot_area_sqm', l.lot_area_sqm,
        'parking_slots', l.parking_slots,
        'cover', (select ph.path from public.listing_photos ph where ph.listing_id = l.id
                  order by ph.position, ph.created_at limit 1)
      ) order by l.created_at desc)
      from public.listings l where l.agent_id = p.id and l.status = 'active'
    ), '[]'::jsonb)
  )
  from public.profiles p
  where p.slug = p_slug;
$$;

-- ---------------------------------------------------------------------------
-- Listing stats
-- ---------------------------------------------------------------------------
create table public.listing_events (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings (id) on delete cascade,
  agent_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('view', 'contact')),
  channel text not null default '' check (channel in ('', 'call', 'messenger', 'viber')),
  source text not null default 'website' check (source in ('website', 'facebook')),
  created_at timestamptz not null default now()
);
create index listing_events_listing_idx on public.listing_events (listing_id, created_at);
create index listing_events_agent_idx on public.listing_events (agent_id, created_at);

alter table public.listing_events enable row level security;
revoke all on public.listing_events from anon, authenticated;
grant select on public.listing_events to authenticated;
create policy "read own listing events or admin" on public.listing_events
  for select to authenticated using (agent_id = (select auth.uid()) or (select public.is_admin()));

-- Called from public listing pages. Visits by the listing's own agent are ignored.
create or replace function public.record_listing_event(p_slug text, p_kind text, p_channel text, p_source text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
begin
  if p_kind not in ('view', 'contact') then return; end if;
  select * into v_listing from public.listings where slug = p_slug and status = 'active';
  if not found or v_listing.agent_id = auth.uid() then return; end if;

  insert into public.listing_events (listing_id, agent_id, kind, channel, source)
  values (
    v_listing.id,
    v_listing.agent_id,
    p_kind,
    case when p_kind = 'contact' and p_channel in ('call', 'messenger', 'viber') then p_channel else '' end,
    case when p_source = 'facebook' then 'facebook' else 'website' end
  );
end;
$$;

-- Per-listing totals since a date, for the signed-in agent (RLS applies).
create or replace function public.my_listing_stats(p_since timestamptz)
returns table (listing_id uuid, views bigint, contacts bigint)
language sql
stable
set search_path = ''
as $$
  select e.listing_id,
         count(*) filter (where e.kind = 'view'),
         count(*) filter (where e.kind = 'contact')
  from public.listing_events e
  where e.agent_id = auth.uid() and e.created_at >= p_since
  group by e.listing_id;
$$;

-- ---------------------------------------------------------------------------
-- Pricing copy: Messenger automation and advanced CRM aren't built yet.
-- Only replaces the original seed text, so an admin's edits are kept.
-- ---------------------------------------------------------------------------
update public.plans
   set description = 'For busy agents who want no fixed limits on listings, leads and AI, plus the AI buyer chat.'
 where id = 'pro'
   and description = 'For agents who rely on Prospecta for lead management, Messenger automation, AI sales assistance and advanced CRM.';

revoke execute on function public.set_profile_slug() from public, anon, authenticated;
revoke execute on function public.get_public_agent(text) from public;
revoke execute on function public.record_listing_event(text, text, text, text) from public;
revoke execute on function public.my_listing_stats(timestamptz) from public, anon;
grant execute on function public.get_public_agent(text) to anon, authenticated;
grant execute on function public.record_listing_event(text, text, text, text) to anon, authenticated;
grant execute on function public.my_listing_stats(timestamptz) to authenticated;

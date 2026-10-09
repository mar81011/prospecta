-- Agent profile photos, shown on public listing pages.
-- Files live in the public `agent-photos` bucket at {agent_id}/{uuid}.{ext}.
-- Like listing photos, uploads are validated and written server-side with the
-- service role, so agents get no column grant on photo_path and no storage
-- write policy.

alter table public.profiles
  add column photo_path text check (char_length(photo_path) <= 300);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agent-photos', 'agent-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Same as 20261009000003, plus agent_photo.
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
    'photos', coalesce((
      select jsonb_agg(ph.path order by ph.position, ph.created_at)
      from public.listing_photos ph where ph.listing_id = l.id
    ), '[]'::jsonb)
  )
  from public.listings l
  join public.profiles p on p.id = l.agent_id
  where l.slug = p_slug and l.status = 'active';
$$;

-- Property details for listings. Existing rows get safe defaults.

alter table public.listings
  add column listing_type text not null default 'sale'
    check (listing_type in ('sale', 'rent')),
  add column property_type text not null default 'house_and_lot'
    check (property_type in ('house_and_lot', 'condo', 'townhouse', 'apartment', 'lot', 'commercial', 'warehouse', 'farm')),
  -- Integer centavos. For rentals this is the monthly rent.
  add column price_centavos bigint check (price_centavos >= 0),
  add column address text not null default '' check (char_length(address) <= 300),
  add column city text not null default '' check (char_length(city) <= 100),
  add column province text not null default '' check (char_length(province) <= 100),
  add column bedrooms smallint check (bedrooms between 0 and 50),
  add column bathrooms smallint check (bathrooms between 0 and 50),
  add column floor_area_sqm numeric(10, 2) check (floor_area_sqm >= 0),
  add column lot_area_sqm numeric(12, 2) check (lot_area_sqm >= 0),
  add column parking_slots smallint check (parking_slots between 0 and 100),
  add column furnishing text check (furnishing in ('unfurnished', 'semi_furnished', 'fully_furnished')),
  add column description text not null default '' check (char_length(description) <= 5000);

create index listings_agent_type_idx on public.listings (agent_id, listing_type, status);

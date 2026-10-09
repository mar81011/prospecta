import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Furnishing, ListingType, PropertyType } from "@/lib/database.types";

export type PublicListing = {
  id: string;
  slug: string;
  title: string;
  listing_type: ListingType;
  property_type: PropertyType;
  price_centavos: number | null;
  address: string;
  city: string;
  province: string;
  bedrooms: number | null;
  bathrooms: number | null;
  floor_area_sqm: number | null;
  lot_area_sqm: number | null;
  parking_slots: number | null;
  furnishing: Furnishing | null;
  description: string;
  updated_at: string;
  agent_name: string;
  agent_phone: string;
  agent_photo: string | null;
  agent_slug?: string;
  agent_messenger?: string;
  agent_viber?: boolean;
  photos: string[];
};

/** An active listing by slug, readable by anyone (null if archived or missing). Deduped per request. */
export const getPublicListing = cache(async (slug: string): Promise<PublicListing | null> => {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_listing", { p_slug: slug });
  return (data as unknown as PublicListing | null) ?? null;
});

export type PublicAgentListing = Pick<
  PublicListing,
  | "slug"
  | "title"
  | "listing_type"
  | "property_type"
  | "price_centavos"
  | "city"
  | "province"
  | "bedrooms"
  | "bathrooms"
  | "floor_area_sqm"
  | "lot_area_sqm"
  | "parking_slots"
> & { cover: string | null };

export type PublicAgent = {
  slug: string;
  name: string;
  phone: string;
  photo: string | null;
  bio: string;
  messenger: string;
  viber: boolean;
  listings: PublicAgentListing[];
};

/** An agent's public page data by handle (null if unknown). Deduped per request. */
export const getPublicAgent = cache(async (slug: string): Promise<PublicAgent | null> => {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_agent", { p_slug: slug });
  return (data as unknown as PublicAgent | null) ?? null;
});

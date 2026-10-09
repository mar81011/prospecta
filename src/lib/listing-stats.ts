import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ListingStats = { views: number; contacts: number };

/**
 * Views and contact-button taps per listing since `days` ago, for the signed-in
 * agent. Null if stats are unavailable (e.g. migration not applied yet).
 */
export async function getMyListingStats(days: number): Promise<Map<string, ListingStats> | null> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase.rpc("my_listing_stats", { p_since: since });
  if (error || !data) return null;
  return new Map(data.map((r) => [r.listing_id, { views: Number(r.views), contacts: Number(r.contacts) }]));
}

export function totalStats(stats: Map<string, ListingStats>): ListingStats {
  let views = 0;
  let contacts = 0;
  for (const s of stats.values()) {
    views += s.views;
    contacts += s.contacts;
  }
  return { views, contacts };
}

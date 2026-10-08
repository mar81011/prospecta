import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Plan } from "@/lib/database.types";

export async function listPlans(opts: { includeInactive?: boolean } = {}): Promise<Plan[]> {
  const supabase = await createClient();
  let query = supabase.from("plans").select("*").order("sort_order");
  if (!opts.includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error("Could not load plans");
  return data;
}

export async function getPlan(id: string): Promise<Plan | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("plans").select("*").eq("id", id).maybeSingle();
  return data;
}

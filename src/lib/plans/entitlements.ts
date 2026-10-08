import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Plan } from "@/lib/database.types";

// Central entitlement access. UI and server code ask this module what the
// current user may do instead of comparing plan names. Limits live in the
// `plans` table, so pricing experiments need no code changes; the same
// numbers are enforced by database triggers and consume_ai_generation().

export type PlanFeatures = {
  leadManagement: "basic" | "full" | "advanced";
  leadScoring: "basic" | "standard" | "advanced";
  propertyAiTools: "basic" | "standard" | "advanced";
  siteViewing: "basic" | "full";
  messenger: "none" | "basic" | "advanced";
  propertyMatching: "none" | "basic" | "advanced";
  messengerAutomation: boolean;
  advancedLeadScoring: boolean;
  advancedCrm: boolean;
};

export type BooleanFeature = {
  [K in keyof PlanFeatures]: PlanFeatures[K] extends boolean ? K : never;
}[keyof PlanFeatures];

export type Limits = {
  max_active_listings: number | null;
  max_leads_per_month: number | null;
  max_ai_generations_per_month: number | null;
};

export type Usage = {
  active_listings: number;
  leads_this_month: number;
  ai_generations_this_month: number;
};

export type Entitlements = {
  effective_plan: string;
  effective_plan_name: string;
  subscribed_plan: string;
  plan_status: string;
  plan_expires_at: string | null;
  limits: Limits;
  features: PlanFeatures;
  usage: Usage;
};

export async function getEntitlements(): Promise<Entitlements> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_entitlements");
  if (error || !data) throw new Error("Could not load plan entitlements");
  return data as unknown as Entitlements;
}

export function hasFeature(e: Entitlements, feature: BooleanFeature): boolean {
  return e.features[feature] === true;
}

/** Remaining quota; null means no fixed limit (fair use). */
export function remaining(limit: number | null, used: number): number | null {
  return limit === null ? null : Math.max(0, limit - used);
}

export function planFeatures(plan: Pick<Plan, "features">): PlanFeatures {
  return plan.features as unknown as PlanFeatures;
}

/** Records one AI generation, or throws a LIMIT_AI error. Call before any model call. */
export async function consumeAiGeneration(kind: string): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_ai_generation", { p_kind: kind });
  if (error) throw error;
  return data;
}

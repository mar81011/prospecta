import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AppSettings } from "@/lib/database.types";

// Read helpers for the signed-in agent. RLS limits every query to the caller's
// own rows, so no agent filter can be forgotten here.

export async function getPaymentSettings(): Promise<AppSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("*").maybeSingle();
  return data;
}

export async function listMyPayments(agentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*, plan:plans(name)")
    .eq("agent_id", agentId)
    .order("submitted_at", { ascending: false });
  return data ?? [];
}

export async function getMyPendingPayment(agentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*, plan:plans(name)")
    .eq("agent_id", agentId)
    .eq("status", "PENDING")
    .maybeSingle();
  return data;
}

export async function getMyLatestPayment(agentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("*, plan:plans(name)")
    .eq("agent_id", agentId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

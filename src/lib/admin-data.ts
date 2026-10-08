import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PaymentStatus } from "@/lib/database.types";

// Admin read queries. They run as the signed-in admin; RLS grants admins read
// access to every agent's rows, and non-admins get empty results.

const PAYMENT_WITH_AGENT = "*, agent:profiles!payments_agent_id_fkey(id, name, email), plan:plans(name)";

export type AdminOverview = {
  total_agents: number;
  paid_agents: number;
  free_agents: number;
  pending_payments: number;
  monthly_revenue_centavos: number;
  expiring_soon: number;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_overview");
  if (error || !data) throw new Error("Could not load overview");
  return data as unknown as AdminOverview;
}

export async function listPaymentsByStatus(status: PaymentStatus, limit = 100) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select(PAYMENT_WITH_AGENT)
    .eq("status", status)
    // Oldest pending first so the queue is worked in order; newest first otherwise.
    .order("submitted_at", { ascending: status === "PENDING" })
    .limit(limit);
  return data ?? [];
}

export async function countPaymentsByStatus(): Promise<Record<PaymentStatus, number>> {
  const supabase = await createClient();
  const statuses: PaymentStatus[] = ["PENDING", "APPROVED", "REJECTED", "EXPIRED"];
  const counts = await Promise.all(
    statuses.map((s) => supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", s)),
  );
  return Object.fromEntries(statuses.map((s, i) => [s, counts[i].count ?? 0])) as Record<PaymentStatus, number>;
}

export async function getPaymentForReview(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select(`${PAYMENT_WITH_AGENT}, reviewer:profiles!payments_reviewed_by_fkey(name, email)`)
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** Other payments that used the same GCash reference, to help spot duplicates. */
export async function findPaymentsWithReference(reference: string, excludeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("id, status, submitted_at, agent:profiles!payments_agent_id_fkey(name, email)")
    .eq("gcash_reference", reference)
    .neq("id", excludeId);
  return data ?? [];
}

export async function listAgents(search?: string) {
  const supabase = await createClient();
  let query = supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
  if (search) {
    const s = search.replace(/[%,()]/g, " ").trim();
    if (s) query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%`);
  }
  const { data } = await query;
  return data ?? [];
}

export async function getAgent(id: string) {
  const supabase = await createClient();
  const [{ data: profile }, { data: payments }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("payments")
      .select("*, plan:plans(name)")
      .eq("agent_id", id)
      .order("submitted_at", { ascending: false }),
  ]);
  return profile ? { profile, payments: payments ?? [] } : null;
}

export async function listAuditLogs(page: number, pageSize = 50) {
  const supabase = await createClient();
  const from = page * pageSize;
  const { data, count } = await supabase
    .from("audit_logs")
    .select("*, actor:profiles!audit_logs_actor_id_fkey(name, email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  return { rows: data ?? [], total: count ?? 0 };
}

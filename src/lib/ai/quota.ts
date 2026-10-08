import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyError } from "@/lib/billing/errors";
import { AiError, getAi, type AiProvider } from "./index";

export type AiResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Removes the most recent usage event of this kind (the call it paid for failed). */
async function refund(agentId: string, kind: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("usage_events")
    .select("id")
    .eq("agent_id", agentId)
    .eq("metric", "ai_generation")
    .eq("detail", kind)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) await admin.from("usage_events").delete().eq("id", data.id);
}

async function run<T>(agentId: string, kind: string, consume: () => Promise<{ error: unknown }>, fn: (ai: AiProvider) => Promise<T>): Promise<AiResult<T>> {
  const ai = getAi();
  if (!ai) return { ok: false, error: "AI isn't set up yet. Ask the administrator to add an AI API key." };

  // Charge the plan quota before calling the model; refund if the call fails.
  const { error } = await consume();
  if (error) return { ok: false, error: friendlyError(error as never) };
  try {
    return { ok: true, data: await fn(ai) };
  } catch (e) {
    await refund(agentId, kind);
    if (e instanceof AiError) return { ok: false, error: e.message };
    console.error(`AI ${kind} failed`, e);
    return { ok: false, error: "The AI service is busy. Please try again in a moment." };
  }
}

/** AI work requested by the signed-in agent. */
export async function withAgentAi<T>(agentId: string, kind: string, fn: (ai: AiProvider) => Promise<T>) {
  const supabase = await createClient();
  return run(agentId, kind, async () => supabase.rpc("consume_ai_generation", { p_kind: kind }), fn);
}

/** AI work done on an agent's behalf without their session (buyer chat). */
export async function withAiFor<T>(agentId: string, kind: string, fn: (ai: AiProvider) => Promise<T>) {
  const admin = createAdminClient();
  return run(agentId, kind, async () => admin.rpc("consume_ai_generation_for", { p_agent_id: agentId, p_kind: kind }), fn);
}

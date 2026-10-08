import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Provider-agnostic subscription activation.
 *
 * Manual GCash approvals reach the same SQL function through approve_payment(),
 * which also flips the payment to APPROVED in the same transaction. A future
 * PayMongo webhook should, after verifying the webhook signature and marking
 * its payment as paid, call this to grant or extend the plan.
 *
 * Runs with the service role, so callers must have already verified the payment.
 */
export async function activateSubscription(params: {
  agentId: string;
  planId: string;
  paymentId: string;
}): Promise<Date> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("activate_subscription", {
    p_agent_id: params.agentId,
    p_plan_id: params.planId,
    p_payment_id: params.paymentId,
  });
  if (error || !data) throw new Error(`activate_subscription failed: ${error?.message ?? "no result"}`);
  return new Date(data);
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/billing/errors";

// Admin review of manual payments. Both calls run as the signed-in admin; the
// database re-checks is_admin() and performs each transition atomically.

export const REJECTION_REASONS = [
  "Reference not found",
  "Incorrect amount",
  "Duplicate payment",
  "Wrong account",
  "Payment screenshot does not match",
  "Other",
] as const;

export type ReviewResult = { ok: true; expiresAt?: string } | { ok: false; error: string };

export async function approvePayment(paymentId: string): Promise<ReviewResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_payment", { p_payment_id: paymentId });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true, expiresAt: data };
}

export async function rejectPayment(paymentId: string, reason: string): Promise<ReviewResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_payment", { p_payment_id: paymentId, p_reason: reason });
  if (error) return { ok: false, error: friendlyError(error) };
  return { ok: true };
}

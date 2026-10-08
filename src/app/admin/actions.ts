"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { approvePayment, rejectPayment, REJECTION_REASONS } from "@/lib/billing/review";
import { friendlyError } from "@/lib/billing/errors";
import { SITE_URL } from "@/lib/env";
import { pesosToCentavos } from "@/lib/format";
import type { FormState } from "@/lib/actions/state";

// Every action re-checks the admin role here, and the database functions check
// is_admin() again, so a forged request from a non-admin fails twice over.

const uuid = z.uuid();

export async function approvePaymentAction(paymentId: string): Promise<FormState> {
  await requireAdmin();
  if (!uuid.safeParse(paymentId).success) return { error: "Invalid payment." };
  const result = await approvePayment(paymentId);
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin", "layout");
  redirect(`/admin/payments/${paymentId}?done=approved`);
}

const rejectSchema = z
  .object({
    reason: z.enum(REJECTION_REASONS),
    details: z.string().trim().max(400).optional(),
  })
  .refine((v) => v.reason !== "Other" || (v.details && v.details.length > 0), {
    message: "Describe the reason when choosing Other.",
  });

export async function rejectPaymentAction(paymentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  if (!uuid.safeParse(paymentId).success) return { error: "Invalid payment." };
  const parsed = rejectSchema.safeParse({
    reason: formData.get("reason"),
    details: formData.get("details") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { reason, details } = parsed.data;
  const text = reason === "Other" ? details! : details ? `${reason}: ${details}` : reason;
  const result = await rejectPayment(paymentId, text);
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin", "layout");
  redirect(`/admin/payments/${paymentId}?done=rejected`);
}

const inviteSchema = z.object({
  name: z.string().trim().min(2, "Enter the agent's name.").max(100),
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
});

/** Invites an agent by email. They set their own password; the admin never sees it. */
export async function inviteAgentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = inviteSchema.safeParse({ name: formData.get("name"), email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { name: parsed.data.name },
    redirectTo: `${SITE_URL()}/auth/set-password`,
  });
  if (error || !data.user) {
    return {
      error:
        error?.code === "email_exists" || error?.status === 422
          ? "An account with this email already exists."
          : "Could not send the invitation. Please try again.",
    };
  }

  const supabase = await createClient();
  await supabase.rpc("admin_log_invite", {
    p_user_id: data.user.id,
    p_email: parsed.data.email,
    p_name: parsed.data.name,
  });
  revalidatePath("/admin/agents");
  return { message: `Invitation sent to ${parsed.data.email}.` };
}

const setPlanSchema = z.object({
  plan: z.string().regex(/^[a-z0-9_]{1,40}$/),
  status: z.enum(["active", "pending", "expired", "cancelled"]),
  expiresAt: z.iso.date().optional(),
  note: z.string().trim().max(500).optional(),
});

export async function setAgentPlanAction(agentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  if (!uuid.safeParse(agentId).success) return { error: "Invalid agent." };
  const parsed = setPlanSchema.safeParse({
    plan: formData.get("plan"),
    status: formData.get("status"),
    expiresAt: formData.get("expiresAt") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_plan", {
    p_agent_id: agentId,
    p_plan_id: parsed.data.plan,
    p_status: parsed.data.status,
    // End of the chosen day in Manila.
    p_expires_at: parsed.data.expiresAt ? `${parsed.data.expiresAt}T23:59:59+08:00` : null,
    p_note: parsed.data.note ?? null,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/admin/agents/${agentId}`);
  return { message: "Plan updated." };
}

export async function setRoleAction(userId: string, role: "agent" | "admin"): Promise<FormState> {
  await requireAdmin();
  if (!uuid.safeParse(userId).success || !["agent", "admin"].includes(role)) return { error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", { p_user_id: userId, p_role: role });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/admin/agents/${userId}`);
  return { message: "Role updated." };
}

const settingsSchema = z.object({
  gcashNumber: z.string().trim().max(30),
  gcashAccountName: z.string().trim().max(100),
  paymentInstructions: z.string().trim().max(2000),
  supportEmail: z.union([z.literal(""), z.email("Enter a valid support email.")]),
  supportMessengerUrl: z.union([z.literal(""), z.url({ protocol: /^https$/, message: "Use an https:// link." })]),
  ttlDays: z.coerce.number().int().min(1).max(90),
});

export async function updateSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse({
    gcashNumber: formData.get("gcashNumber") ?? "",
    gcashAccountName: formData.get("gcashAccountName") ?? "",
    paymentInstructions: formData.get("paymentInstructions") ?? "",
    supportEmail: String(formData.get("supportEmail") ?? "").trim(),
    supportMessengerUrl: String(formData.get("supportMessengerUrl") ?? "").trim(),
    ttlDays: formData.get("ttlDays"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_settings", {
    p_gcash_number: d.gcashNumber,
    p_gcash_account_name: d.gcashAccountName,
    p_payment_instructions: d.paymentInstructions,
    p_support_email: d.supportEmail,
    p_support_messenger_url: d.supportMessengerUrl,
    p_payment_request_ttl_days: d.ttlDays,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { message: "Settings saved." };
}

const optionalLimit = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "Limits must be whole numbers (leave blank for no fixed limit)." });
      return z.NEVER;
    }
    return n;
  });

const planSchema = z.object({
  price: z.string().transform((v, ctx) => {
    const c = pesosToCentavos(v);
    if (c === null) {
      ctx.addIssue({ code: "custom", message: "Enter a valid price in pesos." });
      return z.NEVER;
    }
    return c;
  }),
  maxListings: optionalLimit,
  maxLeads: optionalLimit,
  maxAi: optionalLimit,
  description: z.string().trim().max(300),
  active: z.boolean(),
});

export async function updatePlanAction(planId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = planSchema.safeParse({
    price: String(formData.get("price") ?? ""),
    maxListings: String(formData.get("maxListings") ?? ""),
    maxLeads: String(formData.get("maxLeads") ?? ""),
    maxAi: String(formData.get("maxAi") ?? ""),
    description: String(formData.get("description") ?? ""),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_plan", {
    p_plan_id: planId,
    p_price_centavos: d.price,
    p_max_active_listings: d.maxListings,
    p_max_leads_per_month: d.maxLeads,
    p_max_ai_generations_per_month: d.maxAi,
    p_description: d.description,
    p_active: d.active,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/", "layout");
  return { message: "Plan saved. New prices apply to payments submitted from now on." };
}

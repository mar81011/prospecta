"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require";
import { submitManualPayment } from "@/lib/billing/providers/manual-gcash";
import type { FormState } from "@/lib/actions/state";

const schema = z.object({
  // Only the plan id is accepted from the browser; the amount is looked up server-side.
  plan: z.string().regex(/^[a-z0-9_]{1,40}$/, "Choose a plan."),
  reference: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().regex(/^\d{6,20}$/, "Enter the GCash reference number (digits only).")),
  paymentDate: z.iso.date("Enter the date you sent the payment."),
  notes: z.string().trim().max(1000, "Notes must be 1,000 characters or fewer.").optional(),
});

export async function submitPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = schema.safeParse({
    plan: formData.get("plan"),
    reference: formData.get("reference"),
    paymentDate: formData.get("paymentDate"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const screenshot = formData.get("screenshot");
  const result = await submitManualPayment({
    agentId: user.id,
    planId: parsed.data.plan,
    reference: parsed.data.reference,
    paymentDate: parsed.data.paymentDate,
    notes: parsed.data.notes,
    screenshot: screenshot instanceof File ? screenshot : null,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/", "layout");
  redirect(`/payment/pending${result.warning ? "?upload=failed" : ""}`);
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyError } from "@/lib/billing/errors";
import { SCREENSHOT_BUCKET, screenshotPath, validateScreenshot } from "@/lib/billing/screenshot";

// Manual GCash "provider": the agent pays outside Prospecta and reports the
// reference number. Nothing here activates a plan; activation only happens when
// an admin approves (see review.ts -> approve_payment -> activate_subscription).

export type SubmitManualPaymentInput = {
  agentId: string;
  planId: string;
  reference: string;
  paymentDate: string; // YYYY-MM-DD
  notes?: string | null;
  screenshot?: File | null;
};

export type SubmitResult =
  | { ok: true; paymentId: string; warning?: string }
  | { ok: false; error: string };

export async function submitManualPayment(input: SubmitManualPaymentInput): Promise<SubmitResult> {
  // Validate the screenshot before creating the payment so a bad file does
  // not leave a half-submitted request behind.
  let screenshot: Awaited<ReturnType<typeof validateScreenshot>> | null = null;
  if (input.screenshot && input.screenshot.size > 0) {
    screenshot = await validateScreenshot(input.screenshot);
    if (!screenshot.ok) return { ok: false, error: screenshot.error };
  }

  const supabase = await createClient();
  // The amount is not sent: submit_payment looks up the current plan price.
  const { data: paymentId, error } = await supabase.rpc("submit_payment", {
    p_plan_id: input.planId,
    p_reference: input.reference,
    p_payment_date: input.paymentDate,
    p_notes: input.notes ?? null,
  });
  if (error || !paymentId) return { ok: false, error: friendlyError(error) };

  if (screenshot?.ok) {
    const path = screenshotPath(input.agentId, paymentId, screenshot.kind.ext);
    const admin = createAdminClient();
    const upload = await admin.storage
      .from(SCREENSHOT_BUCKET)
      .upload(path, screenshot.bytes, { contentType: screenshot.kind.contentType, upsert: false });
    if (upload.error) {
      return {
        ok: true,
        paymentId,
        warning: "Your payment was submitted, but the screenshot could not be uploaded. The reference number is enough for review.",
      };
    }
    await admin
      .from("payments")
      .update({ screenshot_path: path })
      .eq("id", paymentId)
      .eq("agent_id", input.agentId);
  }

  return { ok: true, paymentId };
}

/** Short-lived link to a screenshot. Storage RLS limits this to the owner and admins. */
export async function getScreenshotUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(SCREENSHOT_BUCKET).createSignedUrl(path, 60);
  return data?.signedUrl ?? null;
}

"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/billing/errors";
import type { FormState } from "@/lib/actions/state";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100),
  phone: z.string().trim().max(30).default(""),
  email: z.string().trim().max(200).default(""),
  message: z.string().trim().max(2000, "Your message is too long.").default(""),
  source: z.enum(["facebook", "website"]).catch("website"),
});

/** Public, unauthenticated: a buyer's inquiry becomes a lead for the listing's agent. */
export async function submitInquiry(slug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  // Honeypot: real visitors never see or fill this field.
  if (String(formData.get("company") ?? "") !== "") return { message: "sent" };

  const parsed = schema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    message: formData.get("message") ?? "",
    source: formData.get("source"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!parsed.data.phone && !parsed.data.email) {
    return { error: "Enter a phone number or email so the agent can reach you." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_inquiry", {
    p_slug: slug,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone,
    p_email: parsed.data.email,
    p_message: parsed.data.message,
    p_source: parsed.data.source,
  });
  if (error) return { error: friendlyError(error) };
  return { message: "sent" };
}

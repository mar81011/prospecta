"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LANGUAGES, type LeadAnalysis, type ListingCopy } from "@/lib/ai";
import { listingFacts } from "@/lib/ai/facts";
import { withAgentAi, type AiResult } from "@/lib/ai/quota";
import { listingSchema, publicListingUrl } from "@/lib/listings";
import { formatDateTime } from "@/lib/format";
import { leadStatus } from "@/lib/leads";

const language = z.enum(LANGUAGES).catch("English");

/**
 * Drafts a title and description from whatever the agent has filled in so far.
 * Only the details are required; title and description are what the AI writes.
 */
export async function generateListingCopy(formData: FormData): Promise<AiResult<ListingCopy>> {
  const user = await requireUser();
  const draft = listingSchema
    .partial()
    .safeParse({
      listing_type: formData.get("listing_type") || undefined,
      property_type: formData.get("property_type") || undefined,
      price_centavos: String(formData.get("price") ?? "") || undefined,
      address: formData.get("address") ?? "",
      city: formData.get("city") || undefined,
      province: formData.get("province") ?? "",
      bedrooms: formData.get("bedrooms") ?? "",
      bathrooms: formData.get("bathrooms") ?? "",
      floor_area_sqm: formData.get("floor_area_sqm") ?? "",
      lot_area_sqm: formData.get("lot_area_sqm") ?? "",
      parking_slots: formData.get("parking_slots") ?? "",
      furnishing: formData.get("furnishing") ?? "",
      description: String(formData.get("description") ?? "").slice(0, 3000),
    });
  if (!draft.success) return { ok: false, error: draft.error.issues[0].message };
  const d = draft.data;
  if (!d.city && !d.description) return { ok: false, error: "Fill in at least the city and some details first." };

  const facts = listingFacts(
    {
      title: String(formData.get("title") ?? "").slice(0, 200),
      listing_type: d.listing_type ?? "sale",
      property_type: d.property_type ?? "house_and_lot",
      price_centavos: d.price_centavos ?? null,
      address: d.address ?? "",
      city: d.city ?? "",
      province: d.province ?? "",
      bedrooms: d.bedrooms ?? null,
      bathrooms: d.bathrooms ?? null,
      floor_area_sqm: d.floor_area_sqm ?? null,
      lot_area_sqm: d.lot_area_sqm ?? null,
      parking_slots: d.parking_slots ?? null,
      furnishing: d.furnishing ?? null,
      description: d.description ?? "",
    },
    user.profile.name,
  );
  return withAgentAi(user.id, "listing_copy", (ai) => ai.listingCopy(facts, language.parse(formData.get("language"))));
}

export async function generateFacebookCaption(listingId: string, lang: string): Promise<AiResult<string>> {
  const user = await requireUser();
  if (!z.uuid().safeParse(listingId).success) return { ok: false, error: "Invalid listing." };
  const supabase = await createClient();
  const { data: listing } = await supabase.from("listings").select("*").eq("id", listingId).maybeSingle();
  if (!listing) return { ok: false, error: "Listing not found." };
  return withAgentAi(user.id, "facebook_caption", (ai) =>
    ai.facebookCaption(listingFacts(listing, user.profile.name), publicListingUrl(listing.slug, "fb"), language.parse(lang)),
  );
}

export async function analyzeLeadWithAi(leadId: string): Promise<AiResult<LeadAnalysis>> {
  const user = await requireUser();
  if (!z.uuid().safeParse(leadId).success) return { ok: false, error: "Invalid lead." };
  const supabase = await createClient();
  // RLS: only the agent's own leads; locked leads can't be analyzed.
  const [{ data: lead }, { data: activity }] = await Promise.all([
    supabase.from("leads").select("*, listing:listings(title, listing_type, price_centavos, city)").eq("id", leadId).maybeSingle(),
    supabase.from("lead_activities").select("kind, body, created_at").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(30),
  ]);
  if (!lead || lead.locked) return { ok: false, error: "Lead not found." };

  const summary = [
    `Name: ${lead.name}`,
    `Stage: ${leadStatus(lead.status).label}`,
    `Source: ${lead.source}`,
    `Has phone: ${lead.phone || lead.contact ? "yes" : "no"}; has email: ${lead.email ? "yes" : "no"}`,
    lead.listing && `Interested in: ${lead.listing.title} (${lead.listing.listing_type}, ${lead.listing.city})`,
    lead.message && `Inquiry message: ${lead.message}`,
    `Created: ${formatDateTime(lead.created_at)}`,
    lead.viewing_at && `Site viewing: ${formatDateTime(lead.viewing_at)}`,
  ]
    .filter(Boolean)
    .join("\n");
  const log = (activity ?? []).filter((a) => a.kind !== "ai").map((a) => `[${formatDateTime(a.created_at)}] ${a.body}`);

  const result = await withAgentAi(user.id, "lead_analysis", (ai) => ai.analyzeLead({ lead: summary, activity: log }));
  if (result.ok) {
    const a = result.data;
    // AI notes are system entries, written with the service role after the ownership check above.
    await createAdminClient()
      .from("lead_activities")
      .insert({
        lead_id: leadId,
        agent_id: user.id,
        kind: "ai",
        body: `AI: ${a.temperature.toUpperCase()} lead — ${a.summary}\nSuggested stage: ${leadStatus(a.suggested_status).label}\nNext step: ${a.next_step}`,
      });
    revalidatePath(`/leads/${leadId}`);
  }
  return result;
}

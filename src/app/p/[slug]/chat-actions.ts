"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAi, type ChatTurn } from "@/lib/ai";
import { listingFacts } from "@/lib/ai/facts";
import { withAiFor } from "@/lib/ai/quota";
import { getPublicListing } from "@/lib/public-listing";
import type { Json } from "@/lib/database.types";

// Public buyer chat. Runs without a user session: all reads and writes use the
// service role after validating the listing, and every reply is charged to the
// listing agent's AI quota.

const MAX_REPLIES_PER_CHAT = 12;
const MAX_REPLIES_PER_LISTING_PER_DAY = 100;
const MAX_HISTORY = 20;

const input = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,120}$/),
  chatId: z.uuid().nullable(),
  message: z.string().trim().min(1, "Type a message.").max(1000, "Please keep messages under 1,000 characters."),
  source: z.enum(["facebook", "website"]).catch("website"),
});

export type ChatResponse = { ok: true; chatId: string; reply: string; saved: boolean } | { ok: false; error: string };

const UNAVAILABLE = "The assistant is unavailable right now. Please use the form below and the agent will contact you.";

export async function sendChatMessage(raw: { slug: string; chatId: string | null; message: string; source: string }): Promise<ChatResponse> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { slug, chatId, message, source } = parsed.data;

  if (!getAi()) return { ok: false, error: UNAVAILABLE };
  const admin = createAdminClient();

  const [listing, { data: enabled }, { data: row }] = await Promise.all([
    getPublicListing(slug),
    admin.rpc("listing_has_ai_chat", { p_slug: slug }),
    admin.from("listings").select("id, agent_id").eq("slug", slug).eq("status", "active").maybeSingle(),
  ]);
  if (!listing || !row) return { ok: false, error: "This listing is no longer available." };
  if (!enabled) return { ok: false, error: UNAVAILABLE };

  // Load or start the conversation.
  let chat: { id: string; messages: ChatTurn[]; reply_count: number; lead_id: string | null } | null = null;
  if (chatId) {
    const { data } = await admin
      .from("ai_chats")
      .select("id, messages, reply_count, lead_id")
      .eq("id", chatId)
      .eq("listing_id", row.id)
      .maybeSingle();
    if (data) chat = { ...data, messages: data.messages as unknown as ChatTurn[] };
  }
  if (!chat) {
    const { data, error } = await admin
      .from("ai_chats")
      .insert({ listing_id: row.id, agent_id: row.agent_id })
      .select("id, messages, reply_count, lead_id")
      .single();
    if (error || !data) return { ok: false, error: UNAVAILABLE };
    chat = { ...data, messages: [] };
  }

  const history: ChatTurn[] = [...chat.messages, { role: "user" as const, content: message }].slice(-MAX_HISTORY);
  const save = async (reply: string, saved = false) => {
    await admin
      .from("ai_chats")
      .update({ messages: [...history, { role: "assistant", content: reply }] as unknown as Json, reply_count: chat!.reply_count + 1 })
      .eq("id", chat!.id);
    return { ok: true as const, chatId: chat!.id, reply, saved };
  };

  if (chat.reply_count >= MAX_REPLIES_PER_CHAT) {
    return { ok: true, chatId: chat.id, reply: "Thanks for all your questions! Please leave your name and number in the form below so the agent can answer the rest.", saved: false };
  }
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { data: today } = await admin.from("ai_chats").select("reply_count").eq("listing_id", row.id).gte("updated_at", since);
  if ((today ?? []).reduce((n, c) => n + c.reply_count, 0) >= MAX_REPLIES_PER_LISTING_PER_DAY) {
    return { ok: false, error: UNAVAILABLE };
  }

  let leadSaved = false;
  const saveContact = async (c: { name: string; phone: string; email: string; interest_summary: string }) => {
    if (chat!.lead_id) return "Contact already saved.";
    // Same validation and lead rules as the inquiry form.
    const { error } = await admin.rpc("submit_inquiry", {
      p_slug: slug,
      p_name: c.name,
      p_phone: c.phone,
      p_email: c.email,
      p_message: `[AI chat] ${c.interest_summary}`.slice(0, 2000),
      p_source: source,
    });
    if (error) throw new Error(`Could not save: ${error.message}. Ask the buyer to double-check their details.`);
    const { data: lead } = await admin
      .from("leads")
      .select("id")
      .eq("listing_id", row.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lead) {
      chat!.lead_id = lead.id;
      await admin.from("ai_chats").update({ lead_id: lead.id }).eq("id", chat!.id);
    }
    leadSaved = true;
    return "Saved. The agent has been notified and will contact the buyer.";
  };

  const facts = listingFacts(
    {
      ...listing,
      floor_area_sqm: listing.floor_area_sqm === null ? null : Number(listing.floor_area_sqm),
      lot_area_sqm: listing.lot_area_sqm === null ? null : Number(listing.lot_area_sqm),
    },
    listing.agent_name,
  );
  const result = await withAiFor(row.agent_id, "buyer_chat", (ai) => ai.buyerChat(facts, history, saveContact));
  // Never tell the buyer about the agent's plan limits.
  if (!result.ok) return { ok: false, error: UNAVAILABLE };
  return save(result.data.reply, leadSaved);
}

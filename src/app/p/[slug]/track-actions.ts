"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { ContactChannel } from "@/lib/contact";

// Listing stats. Best effort: failures are ignored so tracking never breaks
// the page. record_listing_event() validates input and skips the agent's own
// visits; crawlers (including Facebook's link-preview bot) are skipped here.

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|facebot|embedly|preview|headless|lighthouse/i;

async function record(slug: string, kind: "view" | "contact", channel: string, source: string) {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return;
  const ua = (await headers()).get("user-agent") ?? "";
  if (!ua || BOT.test(ua)) return;
  const supabase = await createClient();
  await supabase.rpc("record_listing_event", { p_slug: slug, p_kind: kind, p_channel: channel, p_source: source });
}

export async function recordListingView(slug: string, source: string): Promise<void> {
  await record(slug, "view", "", source).catch(() => {});
}

export async function recordContactTap(slug: string, channel: ContactChannel, source: string): Promise<void> {
  await record(slug, "contact", channel, source).catch(() => {});
}

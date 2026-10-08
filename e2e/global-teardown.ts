import { existsSync, readFileSync } from "node:fs";
import { cleanupE2EData } from "./cleanup";
import { svc } from "./support";
import { SNAPSHOT } from "./global-setup";
import type { AppSettings, Plan } from "../src/lib/database.types";

export default async function globalTeardown() {
  const s = svc();
  if (existsSync(SNAPSHOT)) {
    const { settings, plans } = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as { settings: AppSettings; plans: Plan[] };
    if (settings) {
      const { gcash_number, gcash_account_name, payment_instructions, support_email, support_messenger_url, payment_request_ttl_days } = settings;
      await s
        .from("app_settings")
        .update({ gcash_number, gcash_account_name, payment_instructions, support_email, support_messenger_url, payment_request_ttl_days } as never)
        .eq("id", true);
    }
    for (const p of plans ?? []) {
      await s
        .from("plans")
        .update({
          price_centavos: p.price_centavos,
          max_active_listings: p.max_active_listings,
          max_leads_per_month: p.max_leads_per_month,
          max_ai_generations_per_month: p.max_ai_generations_per_month,
          description: p.description,
          active: p.active,
        } as never)
        .eq("id", p.id);
    }
  }
  const removed = await cleanupE2EData();
  console.log(`e2e teardown: removed ${removed} test users, restored settings and plans`);
}

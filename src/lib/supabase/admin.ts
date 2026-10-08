import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SUPABASE_URL } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS, so use it only for narrowly scoped server
 * tasks (storage uploads, auth invitations, scheduled jobs, future payment
 * webhooks) after the caller has been authorized.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing environment variable SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(SUPABASE_URL(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

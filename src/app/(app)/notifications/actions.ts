"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require";
import { createClient } from "@/lib/supabase/server";

export async function markAllNotificationsRead() {
  const user = await requireUser();
  const supabase = await createClient();
  // RLS already limits this to the caller's rows; the filter keeps intent explicit.
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  revalidatePath("/", "layout");
}

import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/database.types";

export type CurrentUser = { id: string; email: string; profile: Profile };

/** Verified current user (JWT checked by Supabase Auth) and their profile, deduped per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
  if (!profile) return null;

  return { id: data.user.id, email: data.user.email ?? profile.email, profile };
});

export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

/**
 * Admin gate for pages and server actions. Non-admins get a 404 so admin
 * routes are not discoverable. The database enforces the same rule
 * independently via is_admin() in RLS policies and billing functions.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser("/admin");
  if (user.profile.role !== "admin") notFound();
  return user;
}

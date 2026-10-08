"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/billing/errors";
import { LEAD_STATUSES } from "@/lib/leads";
import type { LeadStatus } from "@/lib/database.types";
import type { FormState } from "@/lib/actions/state";

// RLS limits every query to the agent's own, unlocked leads. A blocked update
// returns zero rows rather than an error, so each action checks the result.

const uuid = z.uuid();

const createSchema = z.object({
  name: z.string().trim().min(1, "Enter the lead's name.").max(200),
  contact: z.string().trim().max(200).default(""),
});

export async function createLead(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = createSchema.safeParse({ name: formData.get("name"), contact: formData.get("contact") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const contact = parsed.data.contact;
  const supabase = await createClient();
  // The monthly lead limit is enforced by a database trigger.
  const { error } = await supabase.from("leads").insert({
    name: parsed.data.name,
    contact,
    phone: /@/.test(contact) ? "" : contact,
    email: /@/.test(contact) ? contact : "",
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/leads");
  return { message: "Lead added." };
}

function done(leadId: string) {
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/dashboard");
}

export async function setLeadStatus(leadId: string, status: LeadStatus): Promise<FormState> {
  await requireUser();
  if (!uuid.safeParse(leadId).success || !LEAD_STATUSES.some((s) => s.value === status)) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").update({ status }).eq("id", leadId).select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "This lead can't be updated." };
  done(leadId);
  return {};
}

const scheduleSchema = z.object({
  followUp: z.union([z.literal(""), z.iso.date()]),
  viewing: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a valid viewing date and time.")]),
});

export async function updateLeadSchedule(leadId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  if (!uuid.safeParse(leadId).success) return { error: "Invalid lead." };
  const parsed = scheduleSchema.safeParse({
    followUp: formData.get("followUp") ?? "",
    viewing: formData.get("viewing") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { followUp, viewing } = parsed.data;
  const supabase = await createClient();
  // Inputs are Philippine local time.
  const { data, error } = await supabase
    .from("leads")
    .update({
      next_follow_up_at: followUp ? `${followUp}T09:00:00+08:00` : null,
      viewing_at: viewing ? `${viewing}:00+08:00` : null,
    })
    .eq("id", leadId)
    .select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "This lead can't be updated." };
  done(leadId);
  return { message: "Schedule saved." };
}

const noteSchema = z.string().trim().min(1, "Write a note first.").max(5000, "Notes can be up to 5,000 characters.");

export async function addLeadNote(leadId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!uuid.safeParse(leadId).success) return { error: "Invalid lead." };
  const body = noteSchema.safeParse(formData.get("body"));
  if (!body.success) return { error: body.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("lead_activities")
    .insert({ lead_id: leadId, agent_id: user.id, kind: "note", body: body.data });
  if (error) return { error: "This lead can't be updated." };
  done(leadId);
  return { message: "Note added." };
}

export async function deleteLeadNote(noteId: string, leadId: string): Promise<FormState> {
  await requireUser();
  if (!uuid.safeParse(noteId).success || !uuid.safeParse(leadId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  await supabase.from("lead_activities").delete().eq("id", noteId).eq("kind", "note");
  done(leadId);
  return {};
}

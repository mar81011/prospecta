"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/actions/state";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || /^\+?[0-9 ()-]{7,20}$/.test(v), "Enter a valid mobile number, e.g. 0917 123 4567."),
});

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = schema.safeParse({ name: formData.get("name"), phone: formData.get("phone") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // Column grants only allow agents to change name and phone.
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return { error: "Could not save your profile. Please try again." };
  revalidatePath("/", "layout");
  return { message: "Profile saved." };
}

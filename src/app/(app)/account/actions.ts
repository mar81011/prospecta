"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateImage } from "@/lib/billing/screenshot";
import { AGENT_PHOTO_BUCKET } from "@/lib/listings";
import { parseMessenger, toPhilippineE164 } from "@/lib/contact";
import type { FormState } from "@/lib/actions/state";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v === "" || /^\+?[0-9 ()-]{7,20}$/.test(v), "Enter a valid mobile number, e.g. 0917 123 4567."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/,
      "Your page link can use 3-40 lowercase letters, numbers and dashes, and can't start or end with a dash.",
    ),
  bio: z.string().trim().max(300, "Keep your bio under 300 characters."),
  messenger: z.string().transform((v, ctx) => {
    const parsed = parseMessenger(v);
    if (parsed === null) {
      ctx.addIssue({ code: "custom", message: "Enter your Facebook username or profile link, e.g. facebook.com/ana.reyes." });
      return z.NEVER;
    }
    return parsed;
  }),
  viber: z.boolean(),
});

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  // The page-link fields only exist after migration 20261011000002; the form
  // leaves them out until then.
  const full = formData.has("slug");
  const parsed = (full ? schema : schema.pick({ name: true, phone: true })).safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    slug: formData.get("slug"),
    bio: formData.get("bio") ?? "",
    messenger: formData.get("messenger") ?? "",
    viber: formData.get("viber") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data as Partial<z.infer<typeof schema>> & { name: string; phone: string };
  if (data.viber && !toPhilippineE164(data.phone)) {
    return { error: "To show a Viber button, enter a Philippine mobile number (e.g. 0917 123 4567)." };
  }

  const supabase = await createClient();
  // Column grants limit agents to these public profile fields.
  const { error } = await supabase.from("profiles").update(data).eq("id", user.id);
  if (error?.code === "23505") return { error: "That page link is already taken. Try another." };
  if (error) return { error: "Could not save your profile. Please try again." };
  revalidatePath("/", "layout");
  return { message: "Profile saved." };
}

// Profile photo. Agents have no grant on photo_path, so after validating the
// bytes the service role writes the file and the column, scoped to this user.

export async function uploadAgentPhoto(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo." };
  const img = await validateImage(file, "Photos");
  if (!img.ok) return { error: img.error };

  const admin = createAdminClient();
  const path = `${user.id}/${randomUUID()}.${img.kind.ext}`;
  const upload = await admin.storage
    .from(AGENT_PHOTO_BUCKET)
    .upload(path, img.bytes, { contentType: img.kind.contentType, upsert: false });
  if (upload.error) return { error: "Your photo could not be uploaded. Please try again." };

  const { error } = await admin.from("profiles").update({ photo_path: path }).eq("id", user.id);
  if (error) {
    await admin.storage.from(AGENT_PHOTO_BUCKET).remove([path]);
    return { error: "Could not save your photo. Please try again." };
  }
  if (user.profile.photo_path) await admin.storage.from(AGENT_PHOTO_BUCKET).remove([user.profile.photo_path]);
  revalidatePath("/", "layout");
  return { message: "Photo updated." };
}

export async function removeAgentPhoto(): Promise<FormState> {
  const user = await requireUser();
  if (!user.profile.photo_path) return {};
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ photo_path: null }).eq("id", user.id);
  if (error) return { error: "Could not remove your photo. Please try again." };
  await admin.storage.from(AGENT_PHOTO_BUCKET).remove([user.profile.photo_path]);
  revalidatePath("/", "layout");
  return { message: "Photo removed." };
}

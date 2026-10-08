"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyError } from "@/lib/billing/errors";
import { validateImage } from "@/lib/billing/screenshot";
import { LISTING_PHOTO_BUCKET, MAX_LISTING_PHOTOS, parseListingForm } from "@/lib/listings";
import type { FormState } from "@/lib/actions/state";

// Plan limits are enforced by a database trigger; these actions only surface
// its error message. RLS limits every query to the agent's own listings.

const uuid = z.uuid();

export async function createListing(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = parseListingForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.from("listings").insert(parsed.data).select("id").single();
  if (error || !data) return { error: friendlyError(error) };
  revalidatePath("/listings");
  // Next step: photos.
  redirect(`/listings/${data.id}/edit?created=1#photos`);
}

export async function updateListing(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  if (!uuid.safeParse(id).success) return { error: "Invalid listing." };
  const parsed = parseListingForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.from("listings").update(parsed.data).eq("id", id).select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "Listing not found." };
  revalidatePath("/listings");
  redirect("/listings?saved=updated");
}

export async function setListingStatus(id: string, status: "active" | "archived"): Promise<FormState> {
  await requireUser();
  if (!uuid.safeParse(id).success || !["active", "archived"].includes(status)) return { error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.from("listings").update({ status }).eq("id", id);
  if (error) return { error: friendlyError(error) };
  revalidatePath("/listings");
  return {};
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export async function uploadListingPhotos(listingId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!uuid.safeParse(listingId).success) return { error: "Invalid listing." };

  const supabase = await createClient();
  // RLS: only finds the listing if it belongs to this agent.
  const { data: listing } = await supabase.from("listings").select("id").eq("id", listingId).maybeSingle();
  if (!listing) return { error: "Listing not found." };

  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Choose at least one photo." };

  const { count } = await supabase
    .from("listing_photos")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);
  const existing = count ?? 0;
  if (existing + files.length > MAX_LISTING_PHOTOS) {
    return { error: `A listing can have up to ${MAX_LISTING_PHOTOS} photos. You can add ${MAX_LISTING_PHOTOS - existing} more.` };
  }

  // Validate everything before uploading anything.
  const checked = [];
  for (const file of files) {
    const result = await validateImage(file, "Photos");
    if (!result.ok) return { error: result.error };
    checked.push(result);
  }

  const admin = createAdminClient();
  for (const [i, img] of checked.entries()) {
    const path = `${user.id}/${listingId}/${randomUUID()}.${img.kind.ext}`;
    const upload = await admin.storage
      .from(LISTING_PHOTO_BUCKET)
      .upload(path, img.bytes, { contentType: img.kind.contentType, upsert: false });
    if (upload.error) return { error: "A photo could not be uploaded. Please try again." };

    const { error } = await supabase
      .from("listing_photos")
      .insert({ listing_id: listingId, agent_id: user.id, path, position: existing + i });
    if (error) {
      await admin.storage.from(LISTING_PHOTO_BUCKET).remove([path]);
      return { error: friendlyError(error) };
    }
  }

  revalidatePath(`/listings/${listingId}/edit`);
  revalidatePath("/listings");
  return { message: `${checked.length} photo${checked.length === 1 ? "" : "s"} added.` };
}

export async function deleteListingPhoto(photoId: string): Promise<FormState> {
  await requireUser();
  if (!uuid.safeParse(photoId).success) return { error: "Invalid photo." };
  const supabase = await createClient();
  const { data: photo } = await supabase.from("listing_photos").select("path, listing_id").eq("id", photoId).maybeSingle();
  if (!photo) return { error: "Photo not found." };

  const { error } = await supabase.from("listing_photos").delete().eq("id", photoId);
  if (error) return { error: friendlyError(error) };
  await createAdminClient().storage.from(LISTING_PHOTO_BUCKET).remove([photo.path]);

  revalidatePath(`/listings/${photo.listing_id}/edit`);
  revalidatePath("/listings");
  return {};
}

/** Makes a photo the cover (first photo, used in the Facebook preview). */
export async function makeCoverPhoto(photoId: string): Promise<FormState> {
  await requireUser();
  if (!uuid.safeParse(photoId).success) return { error: "Invalid photo." };
  const supabase = await createClient();
  const { data: photo } = await supabase.from("listing_photos").select("listing_id").eq("id", photoId).maybeSingle();
  if (!photo) return { error: "Photo not found." };

  const { data: photos } = await supabase
    .from("listing_photos")
    .select("id")
    .eq("listing_id", photo.listing_id)
    .order("position")
    .order("created_at");
  const order = [photoId, ...(photos ?? []).map((p) => p.id).filter((id) => id !== photoId)];
  for (const [position, id] of order.entries()) {
    await supabase.from("listing_photos").update({ position }).eq("id", id);
  }

  revalidatePath(`/listings/${photo.listing_id}/edit`);
  revalidatePath("/listings");
  return {};
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card, PageHeader } from "@/components/ui";
import { ShareButtons } from "@/components/share-buttons";
import { createClient } from "@/lib/supabase/server";
import { facebookCaption, facebookShareUrl, listingPhotoUrl, publicListingUrl } from "@/lib/listings";
import { updateListing } from "../../actions";
import { ListingForm } from "../../listing-form";
import { PhotoManager } from "./photo-manager";
import { AiCaption } from "./ai-caption";
import { isAiConfigured } from "@/lib/ai";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListingPage({ params, searchParams }: PageProps<"/listings/[id]/edit">) {
  const { id } = await params;
  const { created } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  // RLS returns nothing for another agent's listing.
  const [{ data: listing }, { data: photos }] = await Promise.all([
    supabase.from("listings").select("*").eq("id", id).maybeSingle(),
    supabase.from("listing_photos").select("id, path").eq("listing_id", id).order("position").order("created_at"),
  ]);
  if (!listing) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={created ? "Listing saved — now add photos" : "Edit listing"}
        description={
          listing.status === "active" ? (
            <Link href={`/p/${listing.slug}`} target="_blank" className="text-brand-600 hover:underline">
              View public page ↗
            </Link>
          ) : (
            "Archived listings are hidden from the public."
          )
        }
      />
      {created && <Alert tone="success">Listing added. Add photos, then share it on Facebook.</Alert>}

      <PhotoManager listingId={listing.id} photos={(photos ?? []).map((p) => ({ id: p.id, url: listingPhotoUrl(p.path) }))} />

      {listing.status === "active" && (
        <Card className="space-y-3">
          <div>
            <h2 className="font-semibold">Share</h2>
            <p className="text-sm text-zinc-600">
              Copy the caption, then click Share to Facebook and paste it. Buyers who click the link can send you an inquiry,
              and it shows up in Leads automatically.
            </p>
          </div>
          <ShareButtons
            shareUrl={facebookShareUrl(listing.slug)}
            publicUrl={publicListingUrl(listing.slug)}
            caption={facebookCaption(listing)}
          />
          {isAiConfigured() && <AiCaption listingId={listing.id} />}
        </Card>
      )}

      <ListingForm
        action={updateListing.bind(null, listing.id)}
        listing={listing}
        submitLabel="Save changes"
        aiEnabled={isAiConfigured()}
      />
    </div>
  );
}

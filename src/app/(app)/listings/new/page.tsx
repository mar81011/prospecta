import type { Metadata } from "next";
import { Alert, ButtonLink, PageHeader } from "@/components/ui";
import { getEntitlements } from "@/lib/plans/entitlements";
import { isAiConfigured } from "@/lib/ai";
import { createListing } from "../actions";
import { ListingForm } from "../listing-form";

export const metadata: Metadata = { title: "Add listing" };

export default async function NewListingPage() {
  const ent = await getEntitlements();
  const limit = ent.limits.max_active_listings;
  const atLimit = limit !== null && ent.usage.active_listings >= limit;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Add listing" />
      {atLimit ? (
        <Alert tone="warning">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              You&apos;ve reached your plan&apos;s limit of {limit} active listings. Archive a listing or upgrade to add more.
            </span>
            <ButtonLink href="/pricing">See plans</ButtonLink>
          </div>
        </Alert>
      ) : (
        <ListingForm action={createListing} submitLabel="Save listing" aiEnabled={isAiConfigured()} />
      )}
    </div>
  );
}

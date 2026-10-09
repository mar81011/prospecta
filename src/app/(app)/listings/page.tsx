import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, ButtonLink, Card, cx, EmptyState, PageHeader } from "@/components/ui";
import { UsageMeter } from "@/components/usage-meter";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/plans/entitlements";
import { formatDate } from "@/lib/format";
import { ShareButtons } from "@/components/share-buttons";
import {
  facebookCaption,
  facebookShareUrl,
  formatListingPrice,
  listingPhotoUrl,
  publicListingUrl,
  LISTING_TYPES,
  listingLocation,
  listingSpecs,
  listingTypeLabel,
  propertyTypeLabel,
} from "@/lib/listings";
import { ListingStatusButton } from "./listing-status-button";
import { requireUser } from "@/lib/auth/require";
import { getMyListingStats } from "@/lib/listing-stats";
import { DeleteListingButton } from "./delete-listing-button";

export const metadata: Metadata = { title: "Listings" };

const FILTERS = [{ value: "all", label: "All" }, ...LISTING_TYPES] as const;

export default async function ListingsPage({ searchParams }: PageProps<"/listings">) {
  const { type, saved } = await searchParams;
  const filter = FILTERS.find((f) => f.value === type)?.value ?? "all";

  const supabase = await createClient();
  let query = supabase
    .from("listings")
    .select("*, listing_photos(path, position), leads(count)")
    .order("status")
    .order("created_at", { ascending: false });
  if (filter !== "all") query = query.eq("listing_type", filter);
  const [user, ent, { data: listings }, stats] = await Promise.all([
    requireUser(),
    getEntitlements(),
    query,
    getMyListingStats(30),
  ]);

  return (
    <>
      <PageHeader
        title="Listings"
        description="Views and contact taps cover the last 30 days; leads are all-time. Archived listings don't count toward your plan's limit."
        actions={
          <div className="flex flex-wrap gap-2">
            {user.profile.slug && (
              <ButtonLink href={`/a/${user.profile.slug}`} target="_blank" variant="secondary">
                My agent page
              </ButtonLink>
            )}
            <ButtonLink href="/listings/new">Add listing</ButtonLink>
          </div>
        }
      />
      {saved && (
        <div className="mb-4">
          <Alert tone="success">{saved === "created" ? "Listing added." : "Listing updated."}</Alert>
        </div>
      )}
      <Card className="mb-6">
        <UsageMeter label="Active listings" used={ent.usage.active_listings} limit={ent.limits.max_active_listings} />
      </Card>

      <div className="mb-4 flex gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? "/listings" : `/listings?type=${f.value}`}
            className={cx(
              "rounded-full px-3 py-1 text-sm",
              f.value === filter ? "bg-brand-600 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {!listings?.length ? (
        <EmptyState>
          No listings yet.{" "}
          <Link href="/listings/new" className="font-medium text-brand-600 hover:underline">
            Add your first property
          </Link>
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {listings.map((l) => {
            const specs = listingSpecs(l);
            const location = listingLocation(l);
            const cover = [...l.listing_photos].sort((a, b) => a.position - b.position)[0];
            const inquiries = l.leads[0]?.count ?? 0;
            const s = stats?.get(l.id) ?? { views: 0, contacts: 0 };
            return (
              <Card key={l.id} data-testid="listing-card" className={cx("flex flex-col gap-3 overflow-hidden", l.status === "archived" && "opacity-70")}>
                <Link href={`/listings/${l.id}/edit#photos`} className="-mx-5 -mt-5 block bg-zinc-100">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Supabase public URL, sized by CSS
                    <img src={listingPhotoUrl(cover.path)} alt="" className="aspect-[16/9] w-full object-cover" />
                  ) : (
                    <span className="flex aspect-[16/9] items-center justify-center text-sm text-zinc-500">+ Add photos</span>
                  )}
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={l.listing_type === "rent" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}>
                    {listingTypeLabel(l.listing_type)}
                  </Badge>
                  <Badge className="bg-zinc-100 text-zinc-700">{propertyTypeLabel(l.property_type)}</Badge>
                  {l.status === "archived" && <Badge className="bg-zinc-200 text-zinc-600">Archived</Badge>}
                </div>
                <div>
                  <h2 className="font-semibold text-zinc-900">{l.title}</h2>
                  <p className="text-lg font-bold text-brand-700">{formatListingPrice(l)}</p>
                </div>
                {(location || l.address) && (
                  <p className="text-sm text-zinc-600">{[l.address, location].filter(Boolean).join(" · ")}</p>
                )}
                {specs && <p className="text-sm text-zinc-700">{specs}</p>}
                {l.description && <p className="line-clamp-3 whitespace-pre-line text-sm text-zinc-600">{l.description}</p>}
                {stats && l.status === "active" && (
                  <dl className="grid grid-cols-3 divide-x divide-zinc-200 rounded-lg bg-zinc-50 py-2 text-center" title="Last 30 days">
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-zinc-500">Views</dt>
                      <dd className="font-semibold text-zinc-900">{s.views.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-zinc-500">Contact taps</dt>
                      <dd className="font-semibold text-zinc-900">{s.contacts.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-zinc-500">Leads</dt>
                      <dd className="font-semibold text-zinc-900">{inquiries.toLocaleString()}</dd>
                    </div>
                  </dl>
                )}
                {l.status === "active" && (
                  <ShareButtons
                    compact
                    shareUrl={facebookShareUrl(l.slug)}
                    publicUrl={publicListingUrl(l.slug)}
                    caption={facebookCaption(l)}
                  />
                )}
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 text-sm">
                  <span className="text-xs text-zinc-500">
                    Added {formatDate(l.created_at)}
                    {inquiries > 0 && (
                      <>
                        {" · "}
                        <Link href={`/leads?listing=${l.id}`} className="font-medium text-brand-600 hover:underline">
                          {inquiries} lead{inquiries === 1 ? "" : "s"}
                        </Link>
                      </>
                    )}
                  </span>
                  <div className="flex flex-wrap items-start justify-end gap-x-4 gap-y-2">
                    {l.status === "active" && (
                      <Link href={`/p/${l.slug}`} target="_blank" className="text-brand-600 hover:underline">
                        View
                      </Link>
                    )}
                    <Link href={`/listings/${l.id}/edit`} className="text-brand-600 hover:underline">
                      Edit
                    </Link>
                    <ListingStatusButton id={l.id} status={l.status} />
                    <DeleteListingButton
                      id={l.id}
                      title={l.title}
                      coverUrl={cover ? listingPhotoUrl(cover.path) : undefined}
                      photoCount={l.listing_photos.length}
                      leadCount={inquiries}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

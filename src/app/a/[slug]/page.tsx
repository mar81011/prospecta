import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, EmptyState, Logo } from "@/components/ui";
import { ContactButtons } from "@/components/contact-buttons";
import { getPublicAgent } from "@/lib/public-listing";
import type { Listing } from "@/lib/database.types";
import {
  agentPhotoUrl,
  formatListingPrice,
  listingLocation,
  listingPhotoUrl,
  listingSpecs,
  listingTypeLabel,
  propertyTypeLabel,
  publicAgentUrl,
} from "@/lib/listings";

export async function generateMetadata({ params }: PageProps<"/a/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublicAgent(slug);
  if (!a) return { title: "Agent not found" };
  const name = a.name || "Real estate agent";
  const count = a.listings.length;
  const title = `${name} · Property listings`;
  const description =
    a.bio || `${count} propert${count === 1 ? "y" : "ies"} for sale and rent. Message ${name.split(" ")[0]} directly.`;
  const image = a.photo ? agentPhotoUrl(a.photo) : a.listings[0]?.cover ? listingPhotoUrl(a.listings[0].cover) : null;
  return {
    title,
    description,
    alternates: { canonical: publicAgentUrl(a.slug) },
    openGraph: { type: "profile", title, description, url: publicAgentUrl(a.slug), siteName: "Prospecta", images: image ? [image] : [] },
  };
}

export default async function AgentPage({ params }: PageProps<"/a/[slug]">) {
  const { slug } = await params;
  const a = await getPublicAgent(slug);
  if (!a) notFound();
  const name = a.name || "Prospecta agent";
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/">
            <Logo />
          </Link>
          <span className="text-xs text-zinc-500">Agent profile</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Card className="mb-8 flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:text-left">
          {a.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase public URL
            <img src={agentPhotoUrl(a.photo)} alt={name} className="h-28 w-28 shrink-0 rounded-full object-cover ring-4 ring-brand-50" />
          ) : (
            <span className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-brand-50 text-3xl font-semibold text-brand-700">
              {initials}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
            <p className="text-sm text-zinc-500">Real estate agent</p>
            {a.bio && <p className="mt-2 whitespace-pre-line text-zinc-700">{a.bio}</p>}
          </div>
          <ContactButtons phone={a.phone} messenger={a.messenger} viber={a.viber} className="w-full sm:w-64" />
        </Card>

        <h2 className="mb-4 text-lg font-semibold">
          Listings <span className="font-normal text-zinc-500">({a.listings.length})</span>
        </h2>
        {a.listings.length === 0 ? (
          <EmptyState>No active listings right now. Message {name.split(" ")[0]} to ask what&apos;s coming up.</EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {a.listings.map((l) => {
              const specs = listingSpecs(l as unknown as Listing);
              return (
                <Link key={l.slug} href={`/p/${l.slug}`} className="group">
                  <Card className="h-full overflow-hidden p-0 transition-shadow group-hover:shadow-md">
                    {l.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Supabase public URL
                      <img src={listingPhotoUrl(l.cover)} alt="" className="aspect-[4/3] w-full object-cover" />
                    ) : (
                      <span className="flex aspect-[4/3] items-center justify-center bg-zinc-100 text-sm text-zinc-500">
                        No photo yet
                      </span>
                    )}
                    <div className="space-y-1.5 p-4">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge className={l.listing_type === "rent" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}>
                          {listingTypeLabel(l.listing_type)}
                        </Badge>
                        <Badge className="bg-zinc-100 text-zinc-700">{propertyTypeLabel(l.property_type)}</Badge>
                      </div>
                      <p className="font-semibold text-zinc-900 group-hover:text-brand-700">{l.title}</p>
                      <p className="font-bold text-brand-700">{formatListingPrice(l)}</p>
                      {listingLocation(l) && <p className="text-sm text-zinc-600">📍 {listingLocation(l)}</p>}
                      {specs && <p className="text-sm text-zinc-600">{specs}</p>}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

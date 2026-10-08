import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Logo } from "@/components/ui";
import { getPublicListing } from "@/lib/public-listing";
import type { Listing } from "@/lib/database.types";
import {
  formatListingPrice,
  listingLocation,
  listingPhotoUrl,
  listingSpecs,
  listingTypeLabel,
  propertyTypeLabel,
  publicListingUrl,
} from "@/lib/listings";
import { InquiryForm } from "./inquiry-form";
import { ChatWidget } from "./chat-widget";
import { isAiConfigured } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

// Open Graph tags drive the Facebook preview card (title, price, cover photo).
export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const l = await getPublicListing(slug);
  if (!l) return { title: "Listing not available" };
  const title = `${l.listing_type === "rent" ? "For rent" : "For sale"}: ${l.title}`;
  const description = [formatListingPrice(l), listingLocation(l), listingSpecs(l as unknown as Listing)]
    .filter(Boolean)
    .join(" · ");
  const images = l.photos.length ? [{ url: listingPhotoUrl(l.photos[0]), width: 1200, height: 900 }] : [];
  return {
    title,
    description,
    alternates: { canonical: publicListingUrl(l.slug) },
    openGraph: { type: "website", title, description, url: publicListingUrl(l.slug), images, siteName: "Prospecta" },
    twitter: { card: images.length ? "summary_large_image" : "summary", title, description },
  };
}

export default async function PublicListingPage({ params, searchParams }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const { ref, fbclid } = await searchParams;
  const l = await getPublicListing(slug);
  if (!l) notFound();
  const supabase = await createClient();
  const { data: chatEnabled } = await supabase.rpc("listing_has_ai_chat", { p_slug: slug });
  const showChat = Boolean(chatEnabled) && isAiConfigured();

  // Facebook adds fbclid to outbound links; our share links also carry ?ref=fb.
  const source = ref === "fb" || fbclid ? "facebook" : "website";
  const specs = listingSpecs(l as unknown as Listing);
  const [cover, ...rest] = l.photos;

  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/">
            <Logo />
          </Link>
          <span className="text-xs text-zinc-500">Property listing</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            {cover ? (
              <div className="space-y-2">
                <a href={listingPhotoUrl(cover)} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Supabase public URL */}
                  <img src={listingPhotoUrl(cover)} alt={l.title} className="aspect-[4/3] w-full rounded-xl object-cover" />
                </a>
                {rest.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {rest.map((p, i) => (
                      <a key={p} href={listingPhotoUrl(p)} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- Supabase public URL */}
                        <img src={listingPhotoUrl(p)} alt={`${l.title} photo ${i + 2}`} className="aspect-square w-full rounded-lg object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-zinc-100 text-sm text-zinc-500">
                No photos yet
              </div>
            )}

            <Card className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge className={l.listing_type === "rent" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}>
                  {listingTypeLabel(l.listing_type)}
                </Badge>
                <Badge className="bg-zinc-100 text-zinc-700">{propertyTypeLabel(l.property_type)}</Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{l.title}</h1>
              <p className="text-2xl font-bold text-brand-700">{formatListingPrice(l)}</p>
              {(l.address || listingLocation(l)) && (
                <p className="text-zinc-600">📍 {[l.address, listingLocation(l)].filter(Boolean).join(", ")}</p>
              )}
              {specs && <p className="text-zinc-800">{specs}</p>}
            </Card>

            {l.description && (
              <Card>
                <h2 className="mb-2 font-semibold">About this property</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700">{l.description}</p>
              </Card>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Card>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Listed by</p>
              <p className="font-semibold">{l.agent_name || "Prospecta agent"}</p>
              {l.agent_phone && (
                <a href={`tel:${l.agent_phone.replace(/[^\d+]/g, "")}`} className="mt-1 inline-block text-brand-600 hover:underline">
                  📞 {l.agent_phone}
                </a>
              )}
            </Card>
            {showChat && <ChatWidget slug={l.slug} source={source} agentName={l.agent_name} />}
            <InquiryForm slug={l.slug} source={source} title={l.title} />
          </aside>
        </div>
      </main>
    </>
  );
}

import { z } from "zod";
import type { Furnishing, Listing, ListingType, PropertyType } from "@/lib/database.types";
import { formatPHP, pesosToCentavos } from "@/lib/format";

export const LISTING_TYPES: { value: ListingType; label: string }[] = [
  { value: "sale", label: "For sale" },
  { value: "rent", label: "For rent" },
];

export const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "house_and_lot", label: "House and lot" },
  { value: "condo", label: "Condominium" },
  { value: "townhouse", label: "Townhouse" },
  { value: "apartment", label: "Apartment" },
  { value: "lot", label: "Lot only" },
  { value: "commercial", label: "Commercial space" },
  { value: "warehouse", label: "Warehouse" },
  { value: "farm", label: "Farm / agricultural" },
];

export const FURNISHING: { value: Furnishing; label: string }[] = [
  { value: "unfurnished", label: "Unfurnished" },
  { value: "semi_furnished", label: "Semi-furnished" },
  { value: "fully_furnished", label: "Fully furnished" },
];

const label = <T extends string>(list: { value: T; label: string }[], v: T | null) =>
  list.find((o) => o.value === v)?.label ?? "";

export const listingTypeLabel = (v: ListingType) => label(LISTING_TYPES, v);
export const propertyTypeLabel = (v: PropertyType) => label(PROPERTY_TYPES, v);
export const furnishingLabel = (v: Furnishing | null) => label(FURNISHING, v);

/** Property types with no building, where rooms and floor area don't apply. */
export const LAND_ONLY: PropertyType[] = ["lot", "farm"];

export function formatListingPrice(l: Pick<Listing, "price_centavos" | "listing_type">): string {
  if (l.price_centavos === null) return "Price on request";
  return l.listing_type === "rent" ? `${formatPHP(l.price_centavos)} / month` : formatPHP(l.price_centavos);
}

export function listingLocation(l: Pick<Listing, "city" | "province">): string {
  return [l.city, l.province].filter(Boolean).join(", ");
}

/** e.g. "3 BR · 2 BA · 120 sqm floor · 1 parking" */
export function listingSpecs(l: Listing): string {
  const parts: string[] = [];
  if (l.bedrooms !== null) parts.push(l.bedrooms === 0 ? "Studio" : `${l.bedrooms} BR`);
  if (l.bathrooms !== null) parts.push(`${l.bathrooms} BA`);
  if (l.floor_area_sqm !== null) parts.push(`${Number(l.floor_area_sqm).toLocaleString()} sqm floor`);
  if (l.lot_area_sqm !== null) parts.push(`${Number(l.lot_area_sqm).toLocaleString()} sqm lot`);
  if (l.parking_slots) parts.push(`${l.parking_slots} parking`);
  if (l.furnishing) parts.push(furnishingLabel(l.furnishing));
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// Form parsing (shared by create and edit server actions)
// ---------------------------------------------------------------------------

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const optionalInt = (max: number, name: string) =>
  z.preprocess(
    blankToNull,
    z.coerce.number().int(`${name} must be a whole number.`).min(0).max(max, `${name} is too large.`).nullable(),
  );

const optionalArea = (name: string) =>
  z.preprocess(
    (v) => blankToNull(typeof v === "string" ? v.replace(/,/g, "") : v),
    z.coerce.number().min(0, `${name} can't be negative.`).max(10_000_000).nullable(),
  );

export const listingSchema = z.object({
  title: z.string().trim().min(3, "Enter a title of at least 3 characters.").max(200),
  listing_type: z.enum(["sale", "rent"], "Choose For sale or For rent."),
  property_type: z.enum(PROPERTY_TYPES.map((p) => p.value) as [PropertyType, ...PropertyType[]], "Choose a property type."),
  price_centavos: z.string().transform((v, ctx) => {
    const c = pesosToCentavos(v);
    if (c === null) {
      ctx.addIssue({ code: "custom", message: "Enter a valid price in pesos, e.g. 4,500,000." });
      return z.NEVER;
    }
    return c;
  }),
  address: z.string().trim().max(300).default(""),
  city: z.string().trim().min(2, "Enter the city or municipality.").max(100),
  province: z.string().trim().max(100).default(""),
  bedrooms: optionalInt(50, "Bedrooms"),
  bathrooms: optionalInt(50, "Bathrooms"),
  floor_area_sqm: optionalArea("Floor area"),
  lot_area_sqm: optionalArea("Lot area"),
  parking_slots: optionalInt(100, "Parking slots"),
  furnishing: z.preprocess(blankToNull, z.enum(["unfurnished", "semi_furnished", "fully_furnished"]).nullable()),
  description: z.string().trim().max(5000, "Description must be 5,000 characters or fewer.").default(""),
});

export type ListingInput = z.infer<typeof listingSchema>;

export function parseListingForm(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const parsed = listingSchema.safeParse({
    title: get("title"),
    listing_type: get("listing_type"),
    property_type: get("property_type"),
    price_centavos: get("price") ?? "",
    address: get("address"),
    city: get("city"),
    province: get("province"),
    bedrooms: get("bedrooms") ?? "",
    bathrooms: get("bathrooms") ?? "",
    floor_area_sqm: get("floor_area_sqm") ?? "",
    lot_area_sqm: get("lot_area_sqm") ?? "",
    parking_slots: get("parking_slots") ?? "",
    furnishing: get("furnishing") ?? "",
    description: get("description"),
  });
  if (!parsed.success) return parsed;
  // Land has no rooms, floor area or furnishing.
  if (LAND_ONLY.includes(parsed.data.property_type)) {
    Object.assign(parsed.data, { bedrooms: null, bathrooms: null, floor_area_sqm: null, furnishing: null });
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Public pages and sharing
// ---------------------------------------------------------------------------

export const LISTING_PHOTO_BUCKET = "listing-photos";
export const MAX_LISTING_PHOTOS = 10;

/** Public URL of a listing photo (the bucket is public so Facebook can load previews). */
export function listingPhotoUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${LISTING_PHOTO_BUCKET}/${path}`;
}

export const AGENT_PHOTO_BUCKET = "agent-photos";

/** Public URL of an agent profile photo. */
export function agentPhotoUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${AGENT_PHOTO_BUCKET}/${path}`;
}

export function publicListingUrl(slug: string, ref?: "fb"): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base}/p/${slug}${ref ? `?ref=${ref}` : ""}`;
}

/** Facebook's share dialog. Facebook reads the title, description and photo from the page's Open Graph tags. */
export function facebookShareUrl(slug: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicListingUrl(slug, "fb"))}`;
}

/**
 * Ready-to-paste post text. Facebook no longer lets websites pre-fill the post
 * text, so agents copy this and paste it into the share dialog.
 */
export function facebookCaption(l: Listing): string {
  const lines = [
    `${l.listing_type === "rent" ? "FOR RENT" : "FOR SALE"}: ${l.title}`,
    `💰 ${formatListingPrice(l)}`,
    listingLocation(l) && `📍 ${[l.address, listingLocation(l)].filter(Boolean).join(", ")}`,
    listingSpecs(l) && `🏠 ${propertyTypeLabel(l.property_type)} · ${listingSpecs(l)}`,
    l.description && `\n${l.description.length > 500 ? `${l.description.slice(0, 500).trimEnd()}…` : l.description}`,
    `\nInterested? Send an inquiry here 👉 ${publicListingUrl(l.slug, "fb")}`,
  ];
  return lines.filter(Boolean).join("\n");
}

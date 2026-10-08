import type { Listing } from "@/lib/database.types";
import { formatListingPrice, listingLocation, listingSpecs, propertyTypeLabel } from "@/lib/listings";
import type { ListingFacts } from "./types";

type ListingLike = Pick<
  Listing,
  | "title"
  | "listing_type"
  | "property_type"
  | "price_centavos"
  | "address"
  | "city"
  | "province"
  | "bedrooms"
  | "bathrooms"
  | "floor_area_sqm"
  | "lot_area_sqm"
  | "parking_slots"
  | "furnishing"
  | "description"
>;

export function listingFacts(l: ListingLike, agentName = ""): ListingFacts {
  return {
    title: l.title,
    listingType: l.listing_type,
    propertyType: propertyTypeLabel(l.property_type),
    price: formatListingPrice(l),
    location: [l.address, listingLocation(l)].filter(Boolean).join(", "),
    specs: listingSpecs(l as Listing),
    description: l.description,
    agentName,
  };
}

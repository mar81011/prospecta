import { describe, expect, it } from "vitest";
import { formatListingPrice, listingSpecs, parseListingForm } from "@/lib/listings";
import type { Listing } from "@/lib/database.types";

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

const base = {
  title: "3BR house and lot in Talisay",
  listing_type: "sale",
  property_type: "house_and_lot",
  price: "4,500,000",
  city: "Talisay City",
  province: "Cebu",
  bedrooms: "3",
  bathrooms: "2",
  floor_area_sqm: "120.5",
  lot_area_sqm: "150",
  parking_slots: "1",
  furnishing: "semi_furnished",
  description: "Near SRP.",
};

describe("parseListingForm", () => {
  it("parses a full sale listing with price in centavos", () => {
    const r = parseListingForm(form(base));
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      listing_type: "sale",
      price_centavos: 450_000_000,
      bedrooms: 3,
      floor_area_sqm: 120.5,
      furnishing: "semi_furnished",
    });
  });

  it("treats blank optional fields as null", () => {
    const r = parseListingForm(form({ ...base, bedrooms: "", floor_area_sqm: "", furnishing: "" }));
    expect(r.data).toMatchObject({ bedrooms: null, floor_area_sqm: null, furnishing: null });
  });

  it("clears building fields for lot-only listings", () => {
    const r = parseListingForm(form({ ...base, property_type: "lot" }));
    expect(r.data).toMatchObject({ bedrooms: null, bathrooms: null, floor_area_sqm: null, furnishing: null, lot_area_sqm: 150 });
  });

  it("rejects invalid input", () => {
    expect(parseListingForm(form({ ...base, listing_type: "lease" })).success).toBe(false);
    expect(parseListingForm(form({ ...base, price: "" })).success).toBe(false);
    expect(parseListingForm(form({ ...base, price: "abc" })).success).toBe(false);
    expect(parseListingForm(form({ ...base, city: "" })).success).toBe(false);
    expect(parseListingForm(form({ ...base, bedrooms: "-1" })).success).toBe(false);
    expect(parseListingForm(form({ ...base, bedrooms: "2.5" })).success).toBe(false);
  });
});

describe("listing display", () => {
  const listing = {
    listing_type: "rent",
    price_centavos: 2_500_000,
    bedrooms: 0,
    bathrooms: 1,
    floor_area_sqm: 24,
    lot_area_sqm: null,
    parking_slots: 0,
    furnishing: "fully_furnished",
  } as unknown as Listing;

  it("shows monthly rent and specs", () => {
    expect(formatListingPrice(listing)).toBe("₱25,000 / month");
    expect(listingSpecs(listing)).toBe("Studio · 1 BA · 24 sqm floor · Fully furnished");
  });
});

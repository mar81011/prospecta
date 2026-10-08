"use client";

import { useRef, useState } from "react";
import { Alert, ButtonLink, Card, cx, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/lib/actions/use-form-action";
import type { FormState } from "@/lib/actions/state";
import type { Listing, ListingType, PropertyType } from "@/lib/database.types";
import { FURNISHING, LAND_ONLY, LISTING_TYPES, PROPERTY_TYPES } from "@/lib/listings";
import { AiWriter } from "./ai-writer";

export function ListingForm({
  action,
  listing,
  submitLabel,
  aiEnabled = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  listing?: Listing;
  submitLabel: string;
  aiEnabled?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, formActionPending] = useFormAction(action);
  const [listingType, setListingType] = useState<ListingType>(listing?.listing_type ?? "sale");
  const [propertyType, setPropertyType] = useState<PropertyType>(listing?.property_type ?? "house_and_lot");
  const landOnly = LAND_ONLY.includes(propertyType);
  const num = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

  return (
    <form ref={formRef} onSubmit={formAction} className="space-y-6">
      <Card className="space-y-4">
        <h2 className="font-semibold">Basics</h2>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-zinc-800">Listing type</legend>
          <div className="flex gap-2">
            {LISTING_TYPES.map((t) => (
              <label
                key={t.value}
                className={cx(
                  "flex-1 cursor-pointer rounded-lg border px-4 py-2 text-center text-sm font-medium",
                  listingType === t.value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-zinc-300 text-zinc-700",
                )}
              >
                <input
                  type="radio"
                  name="listing_type"
                  value={t.value}
                  checked={listingType === t.value}
                  onChange={() => setListingType(t.value)}
                  className="sr-only"
                />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Title" htmlFor="title" hint="e.g. 3BR house and lot near SM City, with garage">
          <Input id="title" name="title" defaultValue={listing?.title} required minLength={3} maxLength={200} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Property type" htmlFor="property_type">
            <Select
              id="property_type"
              name="property_type"
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value as PropertyType)}
            >
              {PROPERTY_TYPES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={listingType === "rent" ? "Monthly rent (₱)" : "Selling price (₱)"} htmlFor="price">
            <Input
              id="price"
              name="price"
              inputMode="decimal"
              placeholder={listingType === "rent" ? "25,000" : "4,500,000"}
              defaultValue={listing?.price_centavos != null ? String(listing.price_centavos / 100) : ""}
              required
            />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Location</h2>
        <Field label="Address / subdivision / building" htmlFor="address">
          <Input id="address" name="address" defaultValue={listing?.address} maxLength={300} placeholder="e.g. Blk 5 Lot 12, Greenwoods Subd., Brgy. San Isidro" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City / municipality" htmlFor="city">
            <Input id="city" name="city" defaultValue={listing?.city} required maxLength={100} placeholder="e.g. Cebu City" />
          </Field>
          <Field label="Province" htmlFor="province">
            <Input id="province" name="province" defaultValue={listing?.province} maxLength={100} placeholder="e.g. Cebu" />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Property details</h2>
        {!landOnly && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Bedrooms" htmlFor="bedrooms" hint="0 for studio">
              <Input id="bedrooms" name="bedrooms" type="number" min={0} max={50} defaultValue={num(listing?.bedrooms)} />
            </Field>
            <Field label="Bathrooms" htmlFor="bathrooms">
              <Input id="bathrooms" name="bathrooms" type="number" min={0} max={50} defaultValue={num(listing?.bathrooms)} />
            </Field>
            <Field label="Parking slots" htmlFor="parking_slots">
              <Input id="parking_slots" name="parking_slots" type="number" min={0} max={100} defaultValue={num(listing?.parking_slots)} />
            </Field>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          {!landOnly && (
            <Field label="Floor area (sqm)" htmlFor="floor_area_sqm">
              <Input id="floor_area_sqm" name="floor_area_sqm" inputMode="decimal" defaultValue={num(listing?.floor_area_sqm)} />
            </Field>
          )}
          <Field label="Lot area (sqm)" htmlFor="lot_area_sqm">
            <Input id="lot_area_sqm" name="lot_area_sqm" inputMode="decimal" defaultValue={num(listing?.lot_area_sqm)} />
          </Field>
          {landOnly && (
            <Field label="Parking slots" htmlFor="parking_slots">
              <Input id="parking_slots" name="parking_slots" type="number" min={0} max={100} defaultValue={num(listing?.parking_slots)} />
            </Field>
          )}
          {!landOnly && (
            <Field label="Furnishing" htmlFor="furnishing">
              <Select id="furnishing" name="furnishing" defaultValue={listing?.furnishing ?? ""}>
                <option value="">Not specified</option>
                {FURNISHING.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        {aiEnabled && <AiWriter formRef={formRef} />}
        <Field label="Description" htmlFor="description" hint="Features, nearby landmarks, terms (e.g. bank financing, Pag-IBIG, 1 month advance + 2 months deposit).">
          <Textarea id="description" name="description" rows={6} maxLength={5000} defaultValue={listing?.description} />
        </Field>
      </Card>

      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="flex gap-2">
        <SubmitButton pending={formActionPending} pendingText="Saving…">{submitLabel}</SubmitButton>
        <ButtonLink href="/listings" variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}

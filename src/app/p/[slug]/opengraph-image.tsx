import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getPublicListing } from "@/lib/public-listing";
import type { Listing } from "@/lib/database.types";
import {
  agentPhotoUrl,
  formatListingPrice,
  listingLocation,
  listingPhotoUrl,
  listingSpecs,
  listingTypeLabel,
  propertyTypeLabel,
} from "@/lib/listings";

// Facebook preview image for a listing: the cover photo with price, title,
// specs, location and the agent's name laid over it. Facebook shows only one
// line of text under a link, so the details live on the image.

export const alt = "Property listing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#1f5bd6"/><path d="M16 6.5c-4.4 0-8 3.4-8 7.7 0 5.3 6.6 10.7 7.3 11.3.4.3 1 .3 1.4 0 .7-.6 7.3-6 7.3-11.3 0-4.3-3.6-7.7-8-7.7Z" fill="#fff"/><path d="M16 10.3 11.6 14v4.3h2.9v-2.6h3v2.6h2.9V14L16 10.3Z" fill="#1f5bd6"/></svg>',
)}`;

// Geist has no ₱ glyph; the price is drawn as an SVG peso sign + the number.
const PESO = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32"><path d="M5 30V4h8a8 8 0 0 1 0 16H5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linejoin="round"/><path d="M1 10h22M1 15h22" stroke="#fff" stroke-width="2.6"/></svg>',
)}`;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [l, bold, regular] = await Promise.all([
    getPublicListing(slug),
    readFile(join(process.cwd(), "assets/fonts/Geist-Bold.ttf")),
    readFile(join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf")).catch(() => null),
  ]);
  const fonts = [
    { name: "Geist", data: bold, weight: 700 as const, style: "normal" as const },
    ...(regular ? [{ name: "Geist", data: regular, weight: 400 as const, style: "normal" as const }] : []),
  ];

  if (!l) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1f5bd6", color: "white", fontSize: 56, fontWeight: 700 }}>
          Listing not available
        </div>
      ),
      { ...size, fonts },
    );
  }

  const cover = l.photos[0] ? listingPhotoUrl(l.photos[0]) : null;
  const specs = listingSpecs(l as unknown as Listing);
  const location = listingLocation(l);
  const agent = l.agent_name || "Prospecta agent";
  const initials = agent.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const isRent = l.listing_type === "rent";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", fontFamily: "Geist", color: "white", background: "#1a4aad" }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- rendered by ImageResponse
          <img src={cover} width={1200} height={630} alt="" style={{ position: "absolute", inset: 0, width: 1200, height: 630, objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", background: "linear-gradient(135deg, #1a4aad 0%, #1f5bd6 55%, #2f6fed 100%)" }} />
        )}
        {/* Darken the bottom so the text is readable on any photo. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.8) 35%, rgba(0,0,0,0.35) 62%, rgba(0,0,0,0) 80%)",
          }}
        />

        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", padding: "40px 52px" }}>
          {/* Top: sale/rent + property type, and the Prospecta mark */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 12 }}>
              <span style={{ display: "flex", padding: "8px 18px", borderRadius: 999, fontSize: 24, fontWeight: 700, background: isRent ? "#0284c7" : "#059669" }}>
                {listingTypeLabel(l.listing_type).toUpperCase()}
              </span>
              <span style={{ display: "flex", padding: "8px 18px", borderRadius: 999, fontSize: 24, fontWeight: 700, background: "rgba(255,255,255,0.92)", color: "#18181b" }}>
                {propertyTypeLabel(l.property_type)}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px 8px 8px", borderRadius: 999, background: "rgba(255,255,255,0.92)", color: "#18181b", fontSize: 24, fontWeight: 700 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- rendered by ImageResponse */}
              <img src={LOGO} width={36} height={36} alt="" />
              Prospecta
            </div>
          </div>

          {/* Bottom: price, title, details, location, agent */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 32 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 700 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 64, fontWeight: 700, lineHeight: 1.05 }}>
                {formatListingPrice(l).startsWith("₱") && (
                  // eslint-disable-next-line @next/next/no-img-element -- rendered by ImageResponse
                  <img src={PESO} width={36} height={48} alt="" />
                )}
                <span>{formatListingPrice(l).replace(/^₱/, "")}</span>
              </div>
              <span style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.2 }}>{clip(l.title, 72)}</span>
              {specs && <span style={{ fontSize: 28, fontWeight: 400, color: "#e4e4e7" }}>{clip(specs, 70)}</span>}
              {location && <span style={{ fontSize: 28, fontWeight: 400, color: "#e4e4e7" }}>📍 {clip(location, 60)}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 22px 10px 10px", borderRadius: 999, background: "rgba(255,255,255,0.95)", color: "#18181b", maxWidth: 360 }}>
              {l.agent_photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- rendered by ImageResponse
                <img src={agentPhotoUrl(l.agent_photo)} width={64} height={64} alt="" style={{ width: 64, height: 64, borderRadius: 999, objectFit: "cover" }} />
              ) : (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 999, background: "#d9eaff", color: "#1a4aad", fontSize: 26, fontWeight: 700 }}>
                  {initials}
                </span>
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 20, fontWeight: 400, color: "#71717a" }}>Listed by</span>
                <span style={{ fontSize: 26, fontWeight: 700 }}>{clip(agent, 20)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}

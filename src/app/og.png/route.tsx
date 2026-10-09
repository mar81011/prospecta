import { ImageResponse } from "next/og";

// Default Facebook/social preview image (1200x630) for pages that don't set
// their own, such as the homepage. Listing and agent pages use their photos.
// Served as a route, not app/opengraph-image, because a file-based OG image
// would take priority over the listing pages' own photos.

export const dynamic = "force-static";

const LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#ffffff"/><path d="M16 6.5c-4.4 0-8 3.4-8 7.7 0 5.3 6.6 10.7 7.3 11.3.4.3 1 .3 1.4 0 .7-.6 7.3-6 7.3-11.3 0-4.3-3.6-7.7-8-7.7Z" fill="#1f5bd6"/><path d="M16 10.3 11.6 14v4.3h2.9v-2.6h3v2.6h2.9V14L16 10.3Z" fill="#ffffff"/></svg>',
)}`;

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #1a4aad 0%, #1f5bd6 55%, #2f6fed 100%)",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by ImageResponse, not the browser */}
          <img src={LOGO} width={72} height={72} alt="" />
          <span style={{ fontSize: 48, fontWeight: 700 }}>Prospecta</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, maxWidth: 960 }}>
            Your AI sales assistant for real estate
          </span>
          <span style={{ fontSize: 32, color: "#d9eaff" }}>
            Listings, leads and site viewings in one place. Built for Filipino agents.
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#d9eaff" }}>
          <span>Share on Facebook · Capture leads · Close deals</span>
          <span>Start free</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

"use client";

import { useEffect } from "react";
import { cx } from "@/components/ui";
import { messengerUrl, telUrl, viberUrl, type ContactChannel } from "@/lib/contact";
import { recordContactTap, recordListingView } from "@/app/p/[slug]/track-actions";

type Props = {
  phone: string;
  messenger: string;
  viber: boolean;
  /** When set, taps are counted in this listing's stats. */
  listingSlug?: string;
  source?: "facebook" | "website";
  className?: string;
};

/** Call / Messenger / Viber buttons. Renders nothing if the agent shared no contact details. */
export function ContactButtons({ phone, messenger, viber, listingSlug, source = "website", className }: Props) {
  const viberHref = viber && phone ? viberUrl(phone) : null;
  const links: { channel: ContactChannel; href: string; label: string; style: string; icon: React.ReactNode }[] = [];

  if (messenger) {
    links.push({
      channel: "messenger",
      href: messengerUrl(messenger),
      label: "Messenger",
      style: "bg-[#0866FF] text-white hover:bg-[#0759E0]",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
          <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.14.26.35.27.57l.05 1.78a.8.8 0 0 0 1.12.71l1.99-.88c.17-.07.36-.09.53-.04.91.25 1.89.39 2.9.39 5.64 0 10-4.13 10-9.7S17.64 2 12 2Zm6 7.46-2.94 4.66a1.5 1.5 0 0 1-2.17.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.63l2.94-4.66a1.5 1.5 0 0 1 2.17-.4l2.34 1.75c.21.16.51.16.72 0l3.16-2.4c.42-.32.97.18.69.63Z" />
        </svg>
      ),
    });
  }
  if (viberHref) {
    links.push({
      channel: "viber",
      href: viberHref,
      label: "Viber",
      style: "bg-[#7360F2] text-white hover:bg-[#6350E0]",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
          <path d="M12 2C6.48 2 2 5.92 2 10.75c0 2.62 1.32 4.97 3.4 6.57L5 21.5a.5.5 0 0 0 .76.44l4.17-2.57c.67.11 1.36.13 2.07.13 5.52 0 10-3.92 10-8.75S17.52 2 12 2Zm-2.6 5.2c.26 0 .5.14.62.37l.82 1.47a.7.7 0 0 1-.12.84l-.42.42s.38 1.53 2.06 2.06l.42-.42a.7.7 0 0 1 .84-.12l1.47.82c.23.13.37.36.37.62v.53c0 .55-.4 1.03-.95 1.1-3.03.37-6.28-2.88-5.91-5.91.07-.55.55-.95 1.1-.95h-.3Z" />
        </svg>
      ),
    });
  }
  if (phone) {
    links.push({
      channel: "call",
      href: telUrl(phone),
      label: "Call",
      style: "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50",
      icon: (
        <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4 fill-current">
          <path
            fillRule="evenodd"
            d="M2 3.5A1.5 1.5 0 0 1 3.5 2h1.15c.86 0 1.6.6 1.78 1.43l.6 2.73a1.5 1.5 0 0 1-.6 1.55l-.82.6a11.06 11.06 0 0 0 5.08 5.08l.6-.82a1.5 1.5 0 0 1 1.55-.6l2.73.6c.84.19 1.43.92 1.43 1.78v1.15A1.5 1.5 0 0 1 16.5 18H15C7.82 18 2 12.18 2 5V3.5Z"
            clipRule="evenodd"
          />
        </svg>
      ),
    });
  }
  if (!links.length) return null;

  return (
    <div className={cx("grid gap-2", links.length > 1 && "grid-cols-2", links.length === 3 && "sm:grid-cols-3 lg:grid-cols-2", className)}>
      {links.map((l) => (
        <a
          key={l.channel}
          href={l.href}
          target={l.channel === "messenger" ? "_blank" : undefined}
          rel={l.channel === "messenger" ? "noopener noreferrer" : undefined}
          onClick={() => {
            if (listingSlug) void recordContactTap(listingSlug, l.channel, source);
          }}
          className={cx(
            "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
            l.channel === "call" && links.length === 3 && "col-span-2 sm:col-span-1 lg:col-span-2",
            l.style,
          )}
        >
          {l.icon}
          {l.label}
        </a>
      ))}
      {phone && <p className="col-span-full text-center text-xs text-zinc-500">{phone}</p>}
    </div>
  );
}

/** Counts one view per browser session for a public listing page. */
export function ViewTracker({ slug, source }: { slug: string; source: "facebook" | "website" }) {
  useEffect(() => {
    const key = `viewed:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked: still count the view.
    }
    void recordListingView(slug, source);
  }, [slug, source]);
  return null;
}

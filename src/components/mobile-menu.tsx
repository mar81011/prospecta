"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";
import { signOut } from "@/app/(auth)/actions";

export type MenuLink = { href: string; label: string; accent?: boolean };

/** Burger button + dropdown panel for small screens (hidden from `lg` up, where the full nav shows). */
export function MobileMenu({
  links,
  footerLinks = [],
  signedIn,
  header,
  className,
}: {
  links: MenuLink[];
  /** Secondary links under a divider (e.g. Account). */
  footerLinks?: MenuLink[];
  signedIn: boolean;
  /** Shown at the top of the panel, e.g. the signed-in user's name. */
  header?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  // Close when the page changes, on Escape, and on a tap outside.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
  const item = (l: MenuLink) => (
    <Link
      key={l.href}
      href={l.href}
      aria-current={isActive(l.href) ? "page" : undefined}
      className={cx(
        "block rounded-lg px-3 py-2.5 text-base",
        isActive(l.href)
          ? "bg-brand-50 font-semibold text-brand-700"
          : l.accent
            ? "font-medium text-brand-700 hover:bg-brand-50"
            : "text-zinc-800 hover:bg-zinc-100",
      )}
    >
      {l.label}
    </Link>
  );

  return (
    <div ref={ref} className={cx("lg:hidden", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden className="h-6 w-6">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open && (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-full z-50 border-b border-zinc-200 bg-white px-4 pt-2 pb-4 shadow-lg"
        >
          {header && <div className="border-b border-zinc-100 px-3 pt-1 pb-3">{header}</div>}
          <nav aria-label="Main" className="mt-2 space-y-0.5">
            {links.map(item)}
          </nav>
          {(footerLinks.length > 0 || signedIn) && (
            <div className="mt-3 space-y-0.5 border-t border-zinc-100 pt-3">
              {footerLinks.map(item)}
              {signedIn && (
                <form action={signOut}>
                  <button
                    type="submit"
                    className="block w-full rounded-lg px-3 py-2.5 text-left text-base text-zinc-500 hover:bg-zinc-100"
                  >
                    Sign out
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

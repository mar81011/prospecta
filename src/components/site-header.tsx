import Link from "next/link";
import { Avatar, Logo, ButtonLink } from "@/components/ui";
import { signOut } from "@/app/(auth)/actions";
import type { CurrentUser } from "@/lib/auth/require";
import { agentPhotoUrl } from "@/lib/listings";

const AGENT_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/listings", label: "Listings" },
  { href: "/leads", label: "Leads" },
  { href: "/pricing", label: "Plans" },
  { href: "/payment/history", label: "Payments" },
] as const;

export function SiteHeader({ user, unread = 0 }: { user: CurrentUser | null; unread?: number }) {
  return (
    <header className="border-b border-zinc-200 bg-white">
      {/* Phones: logo + account controls on top, menu on its own scrollable row below.
          Wide screens: one row (logo, menu, controls). */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href={user ? "/dashboard" : "/"}>
          <Logo />
        </Link>
        {user ? (
          <>
            <nav className="order-3 -mx-4 flex w-full items-center gap-1 overflow-x-auto px-3 text-sm whitespace-nowrap lg:order-2 lg:mx-0 lg:w-auto lg:flex-1 lg:overflow-visible lg:px-0">
              {AGENT_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="rounded-md px-3 py-1.5 text-zinc-700 hover:bg-zinc-100">
                  {l.label}
                </Link>
              ))}
              {user.profile.role === "admin" && (
                <Link href="/admin" className="rounded-md px-3 py-1.5 font-medium text-brand-700 hover:bg-brand-50">
                  Admin
                </Link>
              )}
            </nav>
            <div className="ml-auto flex items-center gap-1 text-sm sm:gap-2 lg:order-3 lg:ml-0">
              <Link
                href="/notifications"
                className="relative inline-flex items-center rounded-md px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 sm:px-3"
                aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="h-5 w-5 sm:hidden">
                  <path
                    fillRule="evenodd"
                    d="M10 2a6 6 0 0 0-6 6c0 1.89-.45 3.67-1.24 5.24a.75.75 0 0 0 .55 1.08 32.9 32.9 0 0 0 3.26.41 3.5 3.5 0 0 0 6.86 0c1.11-.08 2.2-.22 3.26-.41a.75.75 0 0 0 .55-1.08A11.44 11.44 0 0 1 16 8a6 6 0 0 0-6-6Zm0 14.5c-.88 0-1.62-.57-1.88-1.36a33.3 33.3 0 0 0 3.76 0c-.26.79-1 1.36-1.88 1.36Z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="hidden sm:inline">Notifications</span>
                {unread > 0 && (
                  <span className="ml-1 rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white sm:ml-1.5">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
              <Link
                href="/account"
                title="Your account"
                aria-label="Your account"
                className="rounded-full p-0.5 transition-shadow hover:ring-2 hover:ring-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                <Avatar
                  src={user.profile.photo_path ? agentPhotoUrl(user.profile.photo_path) : null}
                  name={user.profile.name || user.email || user.profile.phone}
                />
              </Link>
              <form action={signOut}>
                <button type="submit" className="rounded-md px-2 py-1.5 text-zinc-500 hover:bg-zinc-100 sm:px-3">
                  Sign out
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <Link href="/pricing" className="rounded-md px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100">
              Pricing
            </Link>
            <Link href="/login" className="rounded-md px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100">
              Sign in
            </Link>
            <ButtonLink href="/register">Get started free</ButtonLink>
          </div>
        )}
      </div>
    </header>
  );
}

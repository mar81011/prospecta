import Link from "next/link";
import { Avatar, Logo, ButtonLink } from "@/components/ui";
import { MobileMenu, type MenuLink } from "@/components/mobile-menu";
import { signOut } from "@/app/(auth)/actions";
import type { CurrentUser } from "@/lib/auth/require";
import { agentPhotoUrl } from "@/lib/listings";
import { effectivePlan } from "@/lib/billing/expiry";

const AGENT_LINKS: MenuLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/listings", label: "Listings" },
  { href: "/leads", label: "Leads" },
  { href: "/pricing", label: "Plans" },
  { href: "/payment/history", label: "Payments" },
];

function BellLink({ unread }: { unread: number }) {
  return (
    <Link
      href="/notifications"
      className="relative inline-flex items-center rounded-md px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 lg:px-3"
      aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="h-5 w-5 lg:hidden">
        <path
          fillRule="evenodd"
          d="M10 2a6 6 0 0 0-6 6c0 1.89-.45 3.67-1.24 5.24a.75.75 0 0 0 .55 1.08 32.9 32.9 0 0 0 3.26.41 3.5 3.5 0 0 0 6.86 0c1.11-.08 2.2-.22 3.26-.41a.75.75 0 0 0 .55-1.08A11.44 11.44 0 0 1 16 8a6 6 0 0 0-6-6Zm0 14.5c-.88 0-1.62-.57-1.88-1.36a33.3 33.3 0 0 0 3.76 0c-.26.79-1 1.36-1.88 1.36Z"
          clipRule="evenodd"
        />
      </svg>
      <span className="hidden lg:inline">Notifications</span>
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-white lg:static lg:ml-1.5 lg:text-xs">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

// Phones and tablets: logo, then bell + avatar + burger menu. From `lg` up: the
// full one-row menu bar.
export function SiteHeader({ user, unread = 0 }: { user: CurrentUser | null; unread?: number }) {
  const links = user
    ? [...AGENT_LINKS, ...(user.profile.role === "admin" ? [{ href: "/admin", label: "Admin", accent: true }] : [])]
    : [];
  const name = user ? user.profile.name || user.email || user.profile.phone : "";

  return (
    <header className="relative border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href={user ? "/dashboard" : "/"} className="shrink-0">
          <Logo />
        </Link>
        {user ? (
          <>
            <nav aria-label="Main" className="hidden flex-1 items-center gap-1 text-sm lg:flex">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={
                    l.accent
                      ? "rounded-md px-3 py-1.5 font-medium text-brand-700 hover:bg-brand-50"
                      : "rounded-md px-3 py-1.5 text-zinc-700 hover:bg-zinc-100"
                  }
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-1 text-sm lg:ml-0 lg:gap-2">
              <BellLink unread={unread} />
              <Link
                href="/account"
                title="Your account"
                aria-label="Your account"
                className="rounded-full p-0.5 transition-shadow hover:ring-2 hover:ring-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                <Avatar src={user.profile.photo_path ? agentPhotoUrl(user.profile.photo_path) : null} name={name} />
              </Link>
              <form action={signOut} className="hidden lg:block">
                <button type="submit" className="rounded-md px-3 py-1.5 text-zinc-500 hover:bg-zinc-100">
                  Sign out
                </button>
              </form>
              <MobileMenu
                links={links}
                footerLinks={[{ href: "/account", label: "Account" }]}
                signedIn
                header={
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={user.profile.photo_path ? agentPhotoUrl(user.profile.photo_path) : null}
                      name={name}
                      className="h-10 w-10 text-sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-zinc-900">{name}</p>
                      <p className="truncate text-xs text-zinc-500">{effectivePlan(user.profile).toUpperCase()} plan</p>
                    </div>
                  </div>
                }
              />
            </div>
          </>
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <Link href="/pricing" className="hidden rounded-md px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 sm:inline-block">
              Pricing
            </Link>
            <Link href="/login" className="hidden rounded-md px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 sm:inline-block">
              Sign in
            </Link>
            <ButtonLink href="/register">Get started free</ButtonLink>
            <MobileMenu
              className="sm:hidden"
              signedIn={false}
              links={[
                { href: "/pricing", label: "Pricing" },
                { href: "/login", label: "Sign in" },
              ]}
            />
          </div>
        )}
      </div>
    </header>
  );
}

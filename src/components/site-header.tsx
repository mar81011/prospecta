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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href={user ? "/dashboard" : "/"}>
          <Logo />
        </Link>
        {user ? (
          <>
            <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
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
            <div className="flex items-center gap-2 text-sm">
              <Link
                href="/notifications"
                className="relative rounded-md px-3 py-1.5 text-zinc-700 hover:bg-zinc-100"
                aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
              >
                Notifications
                {unread > 0 && (
                  <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white">
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
                <button type="submit" className="rounded-md px-3 py-1.5 text-zinc-500 hover:bg-zinc-100">
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

import type { ReactNode } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireAdmin } from "@/lib/auth/require";
import { unreadNotificationCount } from "@/lib/notifications";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/agents", label: "Agents" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/audit-logs", label: "Audit log" },
] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const unread = await unreadNotificationCount();
  return (
    <>
      <SiteHeader user={user} unread={unread} />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:flex-row">
        <nav aria-label="Admin" className="md:w-48 md:shrink-0">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Admin</p>
          <ul className="flex flex-wrap gap-1 md:flex-col">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block rounded-md px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  );
}

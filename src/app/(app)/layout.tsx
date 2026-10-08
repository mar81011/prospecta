import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { requireUser } from "@/lib/auth/require";
import { unreadNotificationCount } from "@/lib/notifications";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const unread = await unreadNotificationCount();
  return (
    <>
      <SiteHeader user={user} unread={unread} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}

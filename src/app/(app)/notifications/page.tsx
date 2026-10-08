import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { listNotifications } from "@/lib/notifications";
import { formatDateTime } from "@/lib/format";
import { markAllNotificationsRead } from "./actions";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const notifications = await listNotifications(100);
  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          hasUnread && (
            <form action={markAllNotificationsRead}>
              <SubmitButton variant="secondary" pendingText="Marking…">
                Mark all as read
              </SubmitButton>
            </form>
          )
        }
      />
      {notifications.length === 0 ? (
        <EmptyState>No notifications yet.</EmptyState>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-zinc-100">
            {notifications.map((n) => (
              <li key={n.id} className="flex gap-3 px-5 py-4">
                <span
                  aria-hidden
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-brand-500"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className={n.read_at ? "text-zinc-700" : "font-semibold"}>{n.title}</p>
                  <p className="text-sm text-zinc-600">{n.body}</p>
                  <div className="mt-1 flex gap-3 text-xs text-zinc-400">
                    <span>{formatDateTime(n.created_at)}</span>
                    {n.link && (
                      <Link href={n.link} className="text-brand-600 hover:underline">
                        Open
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

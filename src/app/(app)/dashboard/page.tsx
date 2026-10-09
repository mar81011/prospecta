import type { Metadata } from "next";
import Link from "next/link";
import { Alert, ButtonLink, Card, PageHeader, PlanBadge } from "@/components/ui";
import { UsageMeter } from "@/components/usage-meter";
import { PaymentSummary } from "@/components/payment-summary";
import { requireUser } from "@/lib/auth/require";
import { getEntitlements } from "@/lib/plans/entitlements";
import { getMyLatestPayment } from "@/lib/payments";
import { listNotifications } from "@/lib/notifications";
import { daysUntilExpiry, RENEWAL_WARNING_DAYS } from "@/lib/billing/expiry";
import { formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { isFollowUpDue, OPEN_STATUSES, weekWindow } from "@/lib/leads";
import { getMyListingStats, totalStats } from "@/lib/listing-stats";

function WeekStats({ views, contacts, leads }: { views: number; contacts: number; leads: number }) {
  const items = [
    { label: "Listing views", value: views, hint: "People who opened your listing pages" },
    { label: "Contact taps", value: contacts, hint: "Call, Messenger and Viber button taps" },
    { label: "New leads", value: leads, hint: "Inquiries and leads you added" },
  ];
  return (
    <Card className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Last 7 days</h2>
        <Link href="/listings" className="text-sm text-brand-600 hover:underline">
          Per listing →
        </Link>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        {items.map((i) => (
          <div key={i.label} className="rounded-lg bg-zinc-50 p-3" title={i.hint}>
            <dt className="text-xs text-zinc-500">{i.label}</dt>
            <dd className="text-2xl font-bold tracking-tight text-zinc-900">{i.value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

type ScheduledLead = {
  id: string;
  name: string;
  next_follow_up_at: string | null;
  viewing_at: string | null;
  listing: { title: string } | null;
};

function TodayCard({ due, viewings }: { due: ScheduledLead[]; viewings: ScheduledLead[] }) {
  if (!due.length && !viewings.length) return null;
  return (
    <Card className="mb-6 grid gap-6 md:grid-cols-2" data-testid="today-card">
      <div>
        <h2 className="mb-2 font-semibold">⏰ Follow-ups due ({due.length})</h2>
        {due.length ? (
          <ul className="space-y-1 text-sm">
            {due.map((l) => (
              <li key={l.id}>
                <Link href={`/leads/${l.id}`} className="font-medium text-brand-600 hover:underline">{l.name}</Link>
                {l.listing && <span className="text-zinc-500"> · {l.listing.title}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">Nothing due today.</p>
        )}
      </div>
      <div>
        <h2 className="mb-2 font-semibold">🏠 Site viewings this week ({viewings.length})</h2>
        {viewings.length ? (
          <ul className="space-y-1 text-sm">
            {viewings.map((l) => (
              <li key={l.id}>
                <span className="text-zinc-700">{formatDateTime(l.viewing_at)}</span> ·{" "}
                <Link href={`/leads/${l.id}`} className="font-medium text-brand-600 hover:underline">{l.name}</Link>
                {l.listing && <span className="text-zinc-500"> · {l.listing.title}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">No viewings scheduled.</p>
        )}
      </div>
    </Card>
  );
}

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { now, weekAhead } = weekWindow();
  const weekAgo = new Date(new Date(now).getTime() - 7 * 86_400_000).toISOString();
  const [ent, latest, notifications, { data: scheduled }, stats, { count: newLeads }] = await Promise.all([
    getEntitlements(),
    getMyLatestPayment(user.id),
    listNotifications(5),
    supabase
      .from("leads")
      .select("id, name, status, next_follow_up_at, viewing_at, listing:listings(title)")
      .eq("locked", false)
      .in("status", OPEN_STATUSES)
      .or(`next_follow_up_at.not.is.null,viewing_at.lte.${weekAhead}`)
      .limit(100),
    getMyListingStats(7),
    supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
  ]);
  const week = stats ? totalStats(stats) : null;

  const daysLeft = daysUntilExpiry(user.profile);
  const lapsed = user.profile.plan !== "free" && ent.effective_plan === "free";
  const name = user.profile.name || user.email;

  return (
    <>
      <PageHeader title={`Hi, ${name.split(" ")[0]}`} description="Here's where your Prospecta account stands." />

      <div className="mb-6 space-y-3">
        {daysLeft !== null && daysLeft <= RENEWAL_WARNING_DAYS && (
          <Alert tone="warning">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                Your {ent.effective_plan_name} plan expires in {daysLeft} day{daysLeft === 1 ? "" : "s"} (
                {formatDate(user.profile.plan_expires_at)}).
              </span>
              <ButtonLink href={`/payment?plan=${user.profile.plan}`}>Renew {ent.effective_plan_name}</ButtonLink>
            </div>
          </Alert>
        )}
        {lapsed && (
          <Alert tone="warning">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                Your paid plan expired on {formatDate(user.profile.plan_expires_at)}. Your listings and leads are safe;
                Free plan limits now apply.
              </span>
              <ButtonLink href={`/payment?plan=${user.profile.plan}`}>Renew</ButtonLink>
            </div>
          </Alert>
        )}
        {latest?.status === "PENDING" && (
          <Alert tone="info">
            Your {latest.plan?.name} payment is waiting for approval.{" "}
            <Link href="/payment/pending" className="font-medium underline">
              View status
            </Link>
          </Alert>
        )}
        {latest?.status === "REJECTED" && (
          <Alert tone="error">
            Your last payment could not be verified: {latest.rejection_reason}.{" "}
            <Link href={`/payment?plan=${latest.plan_id}`} className="font-medium underline">
              Submit a new payment
            </Link>
          </Alert>
        )}
      </div>

      {week && <WeekStats views={week.views} contacts={week.contacts} leads={newLeads ?? 0} />}

      <TodayCard
        due={(scheduled ?? []).filter((l) => isFollowUpDue(l))}
        viewings={(scheduled ?? [])
          .filter((l) => l.viewing_at && new Date(l.viewing_at) > new Date(now) && new Date(l.viewing_at) <= new Date(weekAhead))
          .sort((a, b) => a.viewing_at!.localeCompare(b.viewing_at!))}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Your plan</h2>
            <PlanBadge plan={ent.effective_plan} />
          </div>
          {ent.effective_plan === "free" ? (
            <p className="text-sm text-zinc-600">You&apos;re on the Free plan.</p>
          ) : (
            <p className="text-sm text-zinc-600">
              Active until <strong>{formatDate(ent.plan_expires_at)}</strong>
            </p>
          )}
          <ButtonLink href="/pricing" variant={ent.effective_plan === "pro" ? "secondary" : "primary"} className="w-full">
            {ent.effective_plan === "free" ? "Upgrade" : "Manage plan"}
          </ButtonLink>
        </Card>

        <Card className="space-y-4 lg:col-span-2">
          <h2 className="font-semibold">Usage this month</h2>
          <UsageMeter label="Active listings" used={ent.usage.active_listings} limit={ent.limits.max_active_listings} />
          <UsageMeter label="New leads" used={ent.usage.leads_this_month} limit={ent.limits.max_leads_per_month} />
          <UsageMeter
            label="AI generations"
            used={ent.usage.ai_generations_this_month}
            limit={ent.limits.max_ai_generations_per_month}
          />
        </Card>

        {latest && (
          <Card className="space-y-3">
            <h2 className="font-semibold">Latest payment</h2>
            <PaymentSummary payment={latest} />
            <Link href="/payment/history" className="text-sm text-brand-600 hover:underline">
              Payment history →
            </Link>
          </Card>
        )}

        <Card className={latest ? "lg:col-span-2" : "lg:col-span-3"}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Notifications</h2>
            <Link href="/notifications" className="text-sm text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {notifications.map((n) => (
                <li key={n.id} className="py-2 text-sm">
                  <p className={n.read_at ? "text-zinc-600" : "font-medium"}>{n.title}</p>
                  <p className="text-zinc-600">{n.body}</p>
                  <p className="text-xs text-zinc-400">{formatDateTime(n.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

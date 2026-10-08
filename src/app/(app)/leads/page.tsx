import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, ButtonLink, Card, cx, EmptyState, PageHeader } from "@/components/ui";
import { UsageMeter } from "@/components/usage-meter";
import { QuickAddForm } from "@/components/quick-add-form";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/plans/entitlements";
import { formatDate, formatDateTime } from "@/lib/format";
import { isFollowUpDue, LEAD_STATUSES, leadStatus, OPEN_STATUSES, SCORE_STYLES, scoreLead } from "@/lib/leads";
import type { LeadSource, LeadStatus } from "@/lib/database.types";
import { createLead } from "./actions";

export const metadata: Metadata = { title: "Leads" };

const SOURCES: Record<LeadSource, { label: string; className: string }> = {
  facebook: { label: "Facebook", className: "bg-[#E7F0FD] text-[#1459C7]" },
  website: { label: "Listing page", className: "bg-emerald-100 text-emerald-800" },
  manual: { label: "Added manually", className: "bg-zinc-100 text-zinc-700" },
};

const STAGE_TABS: { value: "open" | "all" | LeadStatus; label: string }[] = [
  { value: "open", label: "Open" },
  ...LEAD_STATUSES.map((s) => ({ value: s.value, label: s.label })),
  { value: "all", label: "All" },
];

const SOURCE_FILTERS = ["facebook", "website", "manual"] as const;

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const { stage: rawStage, source: rawSource, listing } = await searchParams;
  const stage = STAGE_TABS.find((t) => t.value === rawStage)?.value ?? "open";
  const source = SOURCE_FILTERS.find((s) => s === rawSource);
  const listingId = typeof listing === "string" && /^[0-9a-f-]{36}$/i.test(listing) ? listing : null;

  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select("*, listing:listings(id, title)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (source) query = query.eq("source", source);
  if (listingId) query = query.eq("listing_id", listingId);
  const [ent, { data: all }] = await Promise.all([getEntitlements(), query]);

  const leads = all ?? [];
  const counts = Object.fromEntries(LEAD_STATUSES.map((s) => [s.value, leads.filter((l) => l.status === s.value).length]));
  const openCount = leads.filter((l) => OPEN_STATUSES.includes(l.status)).length;
  const shown = leads.filter((l) =>
    stage === "all" ? true : stage === "open" ? OPEN_STATUSES.includes(l.status) : l.status === stage,
  );
  const lockedCount = leads.filter((l) => l.locked).length;

  const href = (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { stage, source, listing: listingId ?? undefined, ...params };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "stage" && v === "open")) q.set(k, v);
    const s = q.toString();
    return s ? `/leads?${s}` : "/leads";
  };

  return (
    <>
      <PageHeader
        title="Leads"
        description="Inquiries from your shared listings appear here automatically. Open a lead to update its stage, add notes and schedule viewings."
      />

      {lockedCount > 0 && (
        <div className="mb-4">
          <Alert tone="warning">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {lockedCount} inquir{lockedCount === 1 ? "y is" : "ies are"} locked because you reached this month&apos;s lead
                limit. Upgrade to see their contact details.
              </span>
              <ButtonLink href="/pricing">Upgrade</ButtonLink>
            </div>
          </Alert>
        </div>
      )}

      <Card className="mb-6 space-y-4">
        <UsageMeter label="New leads this month" used={ent.usage.leads_this_month} limit={ent.limits.max_leads_per_month} />
        <div>
          <p className="mb-2 text-sm font-medium text-zinc-800">Add a lead manually</p>
          <QuickAddForm
            action={createLead}
            name="name"
            placeholder="Lead name"
            extra={{ name: "contact", placeholder: "Phone or email (optional)" }}
            submitLabel="Add lead"
          />
        </div>
      </Card>

      <nav aria-label="Lead stages" className="mb-3 flex flex-wrap gap-1 border-b border-zinc-200">
        {STAGE_TABS.map((t) => {
          const n = t.value === "open" ? openCount : t.value === "all" ? leads.length : counts[t.value];
          return (
            <Link
              key={t.value}
              href={href({ stage: t.value })}
              className={cx(
                "-mb-px border-b-2 px-3 py-2 text-sm",
                t.value === stage ? "border-brand-600 font-medium text-brand-700" : "border-transparent text-zinc-600 hover:text-zinc-900",
              )}
            >
              {t.label} <span className="text-zinc-400">({n})</span>
            </Link>
          );
        })}
      </nav>

      <div className="mb-4 flex flex-wrap items-center gap-1 text-sm">
        <span className="mr-1 text-zinc-500">Source:</span>
        {[undefined, ...SOURCE_FILTERS].map((s) => (
          <Link
            key={s ?? "any"}
            href={href({ source: s ?? "" })}
            className={cx(
              "rounded-full px-3 py-1",
              s === source ? "bg-brand-600 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50",
            )}
          >
            {s ? SOURCES[s].label : "Any"}
          </Link>
        ))}
        {listingId && (
          <span className="ml-2 text-zinc-600">
            · One listing only ·{" "}
            <Link href={href({ listing: "" })} className="text-brand-600 hover:underline">
              show all listings
            </Link>
          </span>
        )}
      </div>

      {!shown.length ? (
        <EmptyState>
          {leads.length ? (
            "No leads in this stage."
          ) : (
            <>
              No leads yet. Share a listing on Facebook from the{" "}
              <Link href="/listings" className="font-medium text-brand-600 hover:underline">
                Listings
              </Link>{" "}
              page and inquiries will show up here.
            </>
          )}
        </EmptyState>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-zinc-100">
            {shown.map((l) => {
              const src = SOURCES[l.source] ?? SOURCES.manual;
              const st = leadStatus(l.status);
              const score = scoreLead(l);
              const due = isFollowUpDue(l);
              return (
                <li key={l.id} data-testid="lead-row">
                  <Link href={`/leads/${l.id}`} className="block px-5 py-4 hover:bg-zinc-50">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-900">{l.locked ? "🔒 Locked inquiry" : l.name}</p>
                        {l.locked ? (
                          <p className="text-sm text-zinc-500">Upgrade to see this buyer&apos;s name and contact details.</p>
                        ) : (
                          <p className="text-sm text-zinc-700">
                            {[l.phone, l.email].filter(Boolean).join(" · ") || l.contact || "No contact details"}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!l.locked && <Badge className={SCORE_STYLES[score.label]}>{score.label}</Badge>}
                        <Badge className={st.className}>{st.label}</Badge>
                        <Badge className={src.className}>{src.label}</Badge>
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                      <span>{formatDateTime(l.created_at)}</span>
                      {l.listing && <span>Interested in {l.listing.title}</span>}
                      {due && <span className="font-semibold text-amber-700">⏰ Follow-up due</span>}
                      {l.viewing_at && new Date(l.viewing_at) > new Date() && (
                        <span className="text-amber-800">🏠 Viewing {formatDate(l.viewing_at)}</span>
                      )}
                    </div>
                    {l.message && !l.locked && (
                      <p className="mt-2 line-clamp-2 rounded-lg bg-zinc-50 p-2 text-sm text-zinc-700">{l.message}</p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}

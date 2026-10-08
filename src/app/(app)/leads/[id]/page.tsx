import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, ButtonLink, Card, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, TIME_ZONE } from "@/lib/format";
import { dialable, isFollowUpDue, leadStatus, SCORE_STYLES, scoreLead } from "@/lib/leads";
import type { LeadActivityKind } from "@/lib/database.types";
import { AnalyzeLead, DeleteNoteButton, NoteForm, ScheduleForm, StatusPicker } from "./lead-controls";
import { isAiConfigured } from "@/lib/ai";

export const metadata: Metadata = { title: "Lead" };

const ACTIVITY_ICON: Record<LeadActivityKind, string> = {
  note: "📝",
  status: "🔄",
  follow_up: "⏰",
  viewing: "🏠",
  ai: "✨",
  inquiry: "💬",
};

/** "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm" in Manila time, for date inputs. */
function manilaInput(iso: string | null, withTime: boolean) {
  if (!iso) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return withTime ? `${date}T${parts.hour}:${parts.minute}` : date;
}

export default async function LeadPage({ params }: PageProps<"/leads/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: lead }, { data: activity }, { data: chats }] = await Promise.all([
    supabase.from("leads").select("*, listing:listings(id, title, slug, status)").eq("id", id).maybeSingle(),
    supabase.from("lead_activities").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    supabase.from("ai_chats").select("id, messages, created_at").eq("lead_id", id).order("created_at"),
  ]);
  if (!lead) notFound();

  if (lead.locked) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="🔒 Locked inquiry" />
        <Alert tone="warning">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>This inquiry arrived after you reached your monthly lead limit. Upgrade to see and work this lead.</span>
            <ButtonLink href="/pricing">Upgrade</ButtonLink>
          </div>
        </Alert>
      </div>
    );
  }

  const score = scoreLead(lead);
  const status = leadStatus(lead.status);
  const phone = lead.phone || (/\d{7,}/.test(lead.contact.replace(/\D/g, "")) ? lead.contact : "");

  return (
    <div className="max-w-4xl">
      <Link href="/leads" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← All leads
      </Link>
      <PageHeader
        title={lead.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge className={status.className}>{status.label}</Badge>
            <Badge className={SCORE_STYLES[score.label]}>
              {score.label} · {score.score}
            </Badge>
            <span>Added {formatDateTime(lead.created_at)}</span>
          </span>
        }
      />

      {isFollowUpDue(lead) && (
        <div className="mb-4">
          <Alert tone="warning">Follow-up is due today.</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card className="space-y-4">
            <div>
              <h2 className="mb-2 font-semibold">Stage</h2>
              <StatusPicker leadId={lead.id} status={lead.status} />
            </div>
            <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
              {phone && (
                <>
                  <a href={`tel:${dialable(phone)}`} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50">
                    📞 Call
                  </a>
                  <a href={`sms:${dialable(phone)}`} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50">
                    💬 Text
                  </a>
                </>
              )}
              {lead.email && (
                <a
                  href={`mailto:${lead.email}?subject=${encodeURIComponent(lead.listing ? `About ${lead.listing.title}` : "Your property inquiry")}`}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
                >
                  ✉️ Email
                </a>
              )}
              {!phone && !lead.email && <p className="text-sm text-zinc-500">No contact details.</p>}
            </div>
          </Card>

          {(chats ?? []).map((c) => (
            <Card key={c.id} data-testid="chat-transcript">
              <h2 className="mb-1 font-semibold">💬 Chat with your AI assistant</h2>
              <p className="mb-3 text-xs text-zinc-500">{formatDateTime(c.created_at)} · from the listing page</p>
              <ol className="space-y-2">
                {(c.messages as { role: string; content: string }[]).map((m, i) => (
                  <li key={i} className={m.role === "user" ? "text-sm text-zinc-900" : "text-sm text-zinc-500"}>
                    <span className="font-medium">{m.role === "user" ? "Buyer" : "Assistant"}:</span> {m.content}
                  </li>
                ))}
              </ol>
            </Card>
          ))}

          <Card>
            <h2 className="mb-3 font-semibold">Activity</h2>
            <NoteForm leadId={lead.id} />
            <ol className="mt-5 space-y-4">
              {(activity ?? []).map((a) => (
                <li key={a.id} className="flex gap-3" data-testid="activity">
                  <span aria-hidden className="mt-0.5">
                    {ACTIVITY_ICON[a.kind]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-line text-sm text-zinc-800">{a.body}</p>
                    <p className="text-xs text-zinc-400">{formatDateTime(a.created_at)}</p>
                  </div>
                  {a.kind === "note" && <DeleteNoteButton noteId={a.id} leadId={lead.id} />}
                </li>
              ))}
              {!activity?.length && <li className="text-sm text-zinc-500">No activity yet.</li>}
            </ol>
          </Card>
        </div>

        <aside className="space-y-6">
          {isAiConfigured() && <AnalyzeLead leadId={lead.id} currentStatus={lead.status} />}
          <Card>
            <h2 className="mb-3 font-semibold">Details</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-zinc-500">Phone</dt>
                <dd>{phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Email</dt>
                <dd className="break-all">{lead.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Source</dt>
                <dd>{lead.source === "facebook" ? "Facebook" : lead.source === "website" ? "Listing page" : "Added manually"}</dd>
              </div>
              {lead.listing && (
                <div>
                  <dt className="text-zinc-500">Interested in</dt>
                  <dd>
                    <Link href={`/listings/${lead.listing.id}/edit`} className="text-brand-600 hover:underline">
                      {lead.listing.title}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </Card>
          <ScheduleForm
            leadId={lead.id}
            followUp={manilaInput(lead.next_follow_up_at, false)}
            viewing={manilaInput(lead.viewing_at, true)}
          />
          <Card>
            <h2 className="mb-2 font-semibold">Why {score.label.toLowerCase()}?</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
              {score.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

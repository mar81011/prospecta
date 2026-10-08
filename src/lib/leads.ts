import { todayInManila } from "@/lib/format";
import type { Lead, LeadStatus } from "@/lib/database.types";

export const LEAD_STATUSES: { value: LeadStatus; label: string; className: string }[] = [
  { value: "new", label: "New", className: "bg-brand-100 text-brand-700" },
  { value: "contacted", label: "Contacted", className: "bg-sky-100 text-sky-800" },
  { value: "qualified", label: "Qualified", className: "bg-indigo-100 text-indigo-800" },
  { value: "viewing", label: "Site viewing", className: "bg-amber-100 text-amber-800" },
  { value: "negotiating", label: "Negotiating", className: "bg-orange-100 text-orange-800" },
  { value: "won", label: "Won", className: "bg-emerald-100 text-emerald-800" },
  { value: "lost", label: "Lost", className: "bg-zinc-200 text-zinc-600" },
];

export const OPEN_STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "viewing", "negotiating"];

export function leadStatus(value: LeadStatus) {
  return LEAD_STATUSES.find((s) => s.value === value) ?? LEAD_STATUSES[0];
}

const DAY = 86_400_000;

const STAGE_POINTS: Record<LeadStatus, number> = {
  new: 10,
  contacted: 20,
  qualified: 40,
  viewing: 55,
  negotiating: 70,
  won: 100,
  lost: 0,
};

export type LeadScore = { score: number; label: "Hot" | "Warm" | "Cold"; reasons: string[] };

/**
 * Simple, explainable lead score (0-100). Rules first; AI scoring can replace
 * or adjust this later.
 */
export function scoreLead(
  l: Pick<Lead, "status" | "phone" | "email" | "contact" | "source" | "message" | "created_at" | "status_changed_at" | "viewing_at">,
  now: Date = new Date(),
): LeadScore {
  if (l.status === "won") return { score: 100, label: "Hot", reasons: ["Deal won"] };
  if (l.status === "lost") return { score: 0, label: "Cold", reasons: ["Marked as lost"] };

  const reasons: string[] = [];
  let score = STAGE_POINTS[l.status];
  reasons.push(`Stage: ${leadStatus(l.status).label}`);

  if (l.phone || /\d{7,}/.test(l.contact.replace(/\D/g, ""))) {
    score += 10;
    reasons.push("Has a phone number");
  }
  if (l.email) {
    score += 5;
    reasons.push("Has an email");
  }
  if (l.source !== "manual") {
    score += 10;
    reasons.push("Reached out on their own");
  }
  if (l.message.trim().length >= 20) {
    score += 5;
    reasons.push("Wrote a detailed message");
  }
  if (now.getTime() - new Date(l.created_at).getTime() < 3 * DAY) {
    score += 10;
    reasons.push("New in the last 3 days");
  }
  if (l.viewing_at && new Date(l.viewing_at).getTime() > now.getTime()) {
    score += 10;
    reasons.push("Site viewing scheduled");
  }
  if (now.getTime() - new Date(l.status_changed_at).getTime() > 14 * DAY) {
    score -= 15;
    reasons.push("No progress in 2+ weeks");
  }

  score = Math.max(0, Math.min(100, score));
  return { score, label: score >= 60 ? "Hot" : score >= 30 ? "Warm" : "Cold", reasons };
}

export const SCORE_STYLES: Record<LeadScore["label"], string> = {
  Hot: "bg-red-100 text-red-700",
  Warm: "bg-amber-100 text-amber-800",
  Cold: "bg-sky-50 text-sky-700",
};

/** Follow-up is due today or overdue (Philippine calendar day). */
export function isFollowUpDue(l: Pick<Lead, "next_follow_up_at" | "status">, now: Date = new Date()): boolean {
  if (!l.next_follow_up_at || !OPEN_STATUSES.includes(l.status)) return false;
  return todayInManila(new Date(l.next_follow_up_at)) <= todayInManila(now);
}

/** Digits-only phone for tel:/sms: links, keeping a leading +. */
export function dialable(phone: string): string {
  return phone.trim().replace(/(?!^\+)[^\d]/g, "");
}

/** Now and 7 days ahead, for "this week" views. */
export function weekWindow(now: Date = new Date()) {
  return { now: now.toISOString(), weekAhead: new Date(now.getTime() + 7 * DAY).toISOString() };
}

// Pure subscription date logic. The authoritative implementation is
// public.activate_subscription / public.effective_plan in Postgres; these
// mirror it for display and are covered by unit tests.

import type { PlanStatus } from "@/lib/database.types";

const DAY_MS = 24 * 60 * 60 * 1000;

export type SubscriptionState = {
  plan: string;
  plan_status: PlanStatus;
  plan_expires_at: string | null;
};

export function isPaidPlanActive(s: SubscriptionState, now: Date = new Date()): boolean {
  if (s.plan === "free") return false;
  if (s.plan_status !== "active") return false;
  return s.plan_expires_at === null || new Date(s.plan_expires_at).getTime() > now.getTime();
}

/** The plan whose entitlements apply right now. Lapsed paid plans fall back to Free. */
export function effectivePlan(s: SubscriptionState, now: Date = new Date()): string {
  return isPaidPlanActive(s, now) ? s.plan : "free";
}

/**
 * New expiry after a successful payment:
 * same plan and still active -> extend from current expiry; otherwise start now.
 */
export function nextExpiry(
  s: SubscriptionState,
  planId: string,
  periodDays: number,
  now: Date = new Date(),
): Date {
  const period = periodDays * DAY_MS;
  if (s.plan === planId && isPaidPlanActive(s, now) && s.plan_expires_at) {
    return new Date(new Date(s.plan_expires_at).getTime() + period);
  }
  return new Date(now.getTime() + period);
}

/** Whole days until expiry, rounded up; null when not on an active paid plan. */
export function daysUntilExpiry(s: SubscriptionState, now: Date = new Date()): number | null {
  if (!isPaidPlanActive(s, now) || !s.plan_expires_at) return null;
  return Math.max(0, Math.ceil((new Date(s.plan_expires_at).getTime() - now.getTime()) / DAY_MS));
}

export const RENEWAL_WARNING_DAYS = 5;

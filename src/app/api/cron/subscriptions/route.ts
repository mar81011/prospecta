import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Daily subscription maintenance, triggered by Netlify
// (netlify/functions/subscriptions-cron.mts) or Vercel Cron (vercel.json), both
// sending `Authorization: Bearer $CRON_SECRET`. Expires lapsed plans and stale payment
// requests and queues renewal reminders. Entitlements never depend on this job
// having run: effective_plan() checks expiry dates on every request.

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("run_subscription_maintenance");
  if (error) {
    console.error("run_subscription_maintenance failed", error);
    return NextResponse.json({ error: "Maintenance failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, result: data });
}

import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@/lib/webhook-signature";
import { sendOtpSms } from "@/lib/sms";

// Supabase Auth "Send SMS" hook: Supabase generates the one-time code and calls
// this endpoint (signed with SEND_SMS_HOOK_SECRET); we deliver it via Semaphore.
// Setup: README → Mobile number sign-in.

function fail(status: number, message: string) {
  return NextResponse.json({ error: { http_code: status, message } }, { status });
}

export async function POST(request: NextRequest) {
  const secret = process.env.SEND_SMS_HOOK_SECRET;
  if (!secret) return fail(500, "SMS hook is not configured.");

  const body = await request.text();
  if (!verifyWebhook(secret, request.headers, body)) return fail(401, "Invalid signature.");

  let phone = "";
  let otp = "";
  try {
    const payload = JSON.parse(body) as { user?: { phone?: string }; sms?: { otp?: string } };
    phone = payload.user?.phone ?? "";
    otp = payload.sms?.otp ?? "";
  } catch {
    return fail(400, "Invalid payload.");
  }

  const result = await sendOtpSms(phone, otp);
  if (!result.ok) return fail(result.status, result.message);
  return NextResponse.json({});
}

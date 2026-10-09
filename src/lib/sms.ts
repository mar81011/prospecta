import "server-only";
import { toPhilippineE164 } from "@/lib/contact";

// One-time sign-in codes go out through Semaphore (https://semaphore.co), a
// Philippine SMS provider. The OTP endpoint uses priority routes for codes.
// Only Philippine mobile numbers are accepted, which also blocks SMS-pumping
// to expensive foreign numbers.

const OTP_ENDPOINT = "https://api.semaphore.co/api/v4/otp";

/** True once the SMS hook secret and Semaphore key are set, so the mobile number tab can be shown. */
export function isSmsSignInEnabled(): boolean {
  return Boolean(process.env.SEND_SMS_HOOK_SECRET && process.env.SEMAPHORE_API_KEY);
}

export type SmsResult = { ok: true } | { ok: false; status: number; message: string };

export async function sendOtpSms(phone: string, otp: string, fetchImpl: typeof fetch = fetch): Promise<SmsResult> {
  const e164 = toPhilippineE164(phone);
  if (!e164) return { ok: false, status: 400, message: "Only Philippine mobile numbers are supported." };
  if (!/^\d{6}$/.test(otp)) return { ok: false, status: 400, message: "Invalid code." };

  const apiKey = process.env.SEMAPHORE_API_KEY;
  if (!apiKey) return { ok: false, status: 500, message: "SMS is not configured." };

  const body = new URLSearchParams({
    apikey: apiKey,
    number: `0${e164.slice(3)}`,
    // Must not start with "TEST" (Semaphore silently drops those).
    message: "Your Prospecta code is {otp}. Don't share it with anyone.",
    code: otp,
  });
  const sender = process.env.SEMAPHORE_SENDER_NAME;
  if (sender) body.set("sendername", sender);

  try {
    const res = await fetchImpl(OTP_ENDPOINT, { method: "POST", body });
    const data: unknown = await res.json().catch(() => null);
    const first = Array.isArray(data) ? (data[0] as { status?: string } | undefined) : undefined;
    if (!res.ok || !first || first.status === "Failed") {
      console.error("Semaphore OTP failed", res.status, JSON.stringify(data));
      return { ok: false, status: 502, message: "We couldn't send the SMS. Please try again." };
    }
    return { ok: true };
  } catch (e) {
    console.error("Semaphore OTP error", e);
    return { ok: false, status: 502, message: "We couldn't send the SMS. Please try again." };
  }
}

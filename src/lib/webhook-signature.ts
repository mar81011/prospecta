import { createHmac, timingSafeEqual } from "node:crypto";

// Standard Webhooks signature check (https://www.standardwebhooks.com), used by
// Supabase Auth hooks. The secret is shown in Supabase as "v1,whsec_<base64>".
// Signed content is "{webhook-id}.{webhook-timestamp}.{raw body}" (HMAC-SHA256);
// webhook-signature holds one or more space-separated "v1,<base64>" values.

const TOLERANCE_SECONDS = 5 * 60;

export function verifyWebhook(
  secret: string,
  headers: { get(name: string): string | null },
  body: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature");
  if (!id || !timestamp || !signatures || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^v1,/, "").replace(/^whsec_/, ""), "base64");
  if (!key.length) return false;
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();

  return signatures.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** Signs a payload the same way (for tests). */
export function signWebhook(secret: string, id: string, timestamp: number, body: string): string {
  const key = Buffer.from(secret.replace(/^v1,/, "").replace(/^whsec_/, ""), "base64");
  return `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64")}`;
}

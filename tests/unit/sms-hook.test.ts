import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { signWebhook, verifyWebhook } from "@/lib/webhook-signature";
import { sendOtpSms } from "@/lib/sms";

const SECRET = `v1,whsec_${Buffer.from("test-secret-32-bytes-long-enough!").toString("base64")}`;
const NOW = 1_760_000_000;

const headers = (h: Record<string, string>) => new Headers(h);

describe("verifyWebhook", () => {
  const body = JSON.stringify({ user: { phone: "639171234567" }, sms: { otp: "123456" } });
  const valid = () =>
    headers({ "webhook-id": "msg_1", "webhook-timestamp": String(NOW), "webhook-signature": signWebhook(SECRET, "msg_1", NOW, body) });

  it("accepts a correctly signed request", () => {
    expect(verifyWebhook(SECRET, valid(), body, NOW)).toBe(true);
  });

  it("accepts when one of several signatures matches", () => {
    const h = valid();
    h.set("webhook-signature", `v1,bm90LWl0 ${h.get("webhook-signature")}`);
    expect(verifyWebhook(SECRET, h, body, NOW)).toBe(true);
  });

  it("rejects a tampered body, wrong secret, missing headers and stale timestamps", () => {
    expect(verifyWebhook(SECRET, valid(), body.replace("123456", "999999"), NOW)).toBe(false);
    expect(verifyWebhook(`v1,whsec_${Buffer.from("other").toString("base64")}`, valid(), body, NOW)).toBe(false);
    expect(verifyWebhook(SECRET, headers({}), body, NOW)).toBe(false);
    expect(verifyWebhook(SECRET, valid(), body, NOW + 10 * 60)).toBe(false);
  });
});

describe("sendOtpSms", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends the code to the local-format number via Semaphore's OTP endpoint", async () => {
    vi.stubEnv("SEMAPHORE_API_KEY", "key123");
    vi.stubEnv("SEMAPHORE_SENDER_NAME", "PROSPECTA");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ message_id: 1, status: "Pending" }]), { status: 200 }));
    expect(await sendOtpSms("+639171234567", "123456", fetchMock as unknown as typeof fetch)).toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.semaphore.co/api/v4/otp");
    const sent = init.body as URLSearchParams;
    expect(sent.get("number")).toBe("09171234567");
    expect(sent.get("code")).toBe("123456");
    expect(sent.get("apikey")).toBe("key123");
    expect(sent.get("sendername")).toBe("PROSPECTA");
    expect(sent.get("message")).not.toMatch(/^TEST/i);
  });

  it("refuses foreign numbers without calling Semaphore", async () => {
    vi.stubEnv("SEMAPHORE_API_KEY", "key123");
    const fetchMock = vi.fn();
    const res = await sendOtpSms("+14155550100", "123456", fetchMock as unknown as typeof fetch);
    expect(res).toMatchObject({ ok: false, status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports provider failures", async () => {
    vi.stubEnv("SEMAPHORE_API_KEY", "key123");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ apikey: ["invalid"] }), { status: 401 }));
    expect(await sendOtpSms("09171234567", "123456", fetchMock as unknown as typeof fetch)).toMatchObject({ ok: false, status: 502 });
  });

  it("fails clearly when not configured", async () => {
    vi.stubEnv("SEMAPHORE_API_KEY", "");
    expect(await sendOtpSms("09171234567", "123456", vi.fn() as unknown as typeof fetch)).toMatchObject({
      ok: false,
      status: 500,
    });
  });
});

import { describe, expect, it } from "vitest";
import { daysUntilExpiry, effectivePlan, nextExpiry, type SubscriptionState } from "@/lib/billing/expiry";
import { detectImageKind } from "@/lib/billing/screenshot";
import { friendlyError } from "@/lib/billing/errors";
import { formatPHP, pesosToCentavos, todayInManila } from "@/lib/format";

const now = new Date("2026-10-08T04:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();
const sub = (s: Partial<SubscriptionState>): SubscriptionState => ({
  plan: "pro",
  plan_status: "active",
  plan_expires_at: days(10),
  ...s,
});

describe("effectivePlan", () => {
  it("returns the paid plan while active and unexpired", () => {
    expect(effectivePlan(sub({}), now)).toBe("pro");
  });
  it("falls back to free when expired by date or status", () => {
    expect(effectivePlan(sub({ plan_expires_at: days(-1) }), now)).toBe("free");
    expect(effectivePlan(sub({ plan_status: "expired" }), now)).toBe("free");
    expect(effectivePlan(sub({ plan_status: "pending" }), now)).toBe("free");
  });
});

describe("nextExpiry", () => {
  it("extends an active subscription to the same plan from its current expiry", () => {
    expect(nextExpiry(sub({}), "pro", 30, now).toISOString()).toBe(days(40));
  });
  it("starts from now when expired, on free, or switching plans", () => {
    expect(nextExpiry(sub({ plan_expires_at: days(-3) }), "pro", 30, now).toISOString()).toBe(days(30));
    expect(nextExpiry(sub({ plan: "free", plan_expires_at: null }), "pro", 30, now).toISOString()).toBe(days(30));
    expect(nextExpiry(sub({ plan: "starter" }), "pro", 30, now).toISOString()).toBe(days(30));
  });
  it("matches the spec example: approved Oct 8 expires Nov 7", () => {
    const approved = new Date("2026-10-08T02:00:00Z");
    const exp = nextExpiry(sub({ plan: "free", plan_expires_at: null }), "pro", 30, approved);
    expect(exp.toISOString().slice(0, 10)).toBe("2026-11-07");
  });
});

describe("daysUntilExpiry", () => {
  it("rounds up partial days and is null when not on a paid plan", () => {
    expect(daysUntilExpiry(sub({ plan_expires_at: days(4.1) }), now)).toBe(5);
    expect(daysUntilExpiry(sub({ plan: "free", plan_expires_at: null }), now)).toBeNull();
  });
});

describe("money formatting", () => {
  it("formats centavos as pesos", () => {
    expect(formatPHP(39900)).toBe("₱399");
    expect(formatPHP(259300)).toBe("₱2,593");
    expect(formatPHP(19950)).toBe("₱199.50");
  });
  it("parses admin peso input to integer centavos", () => {
    expect(pesosToCentavos("399")).toBe(39900);
    expect(pesosToCentavos("₱1,299.5")).toBe(129950);
    expect(pesosToCentavos("12.345")).toBeNull();
    expect(pesosToCentavos("-1")).toBeNull();
    expect(pesosToCentavos("abc")).toBeNull();
  });
  it("computes today in Manila time", () => {
    expect(todayInManila(new Date("2026-10-08T17:30:00Z"))).toBe("2026-10-09");
  });
});

describe("detectImageKind", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0]);
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
  it("recognizes JPEG, PNG and WebP by magic bytes", () => {
    expect(detectImageKind(bytes(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe("jpg");
    expect(detectImageKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe("png");
    expect(detectImageKind(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP")))?.ext).toBe("webp");
  });
  it("rejects anything else, whatever its name claims", () => {
    expect(detectImageKind(bytes(...ascii("<svg")))).toBeNull();
    expect(detectImageKind(bytes(...ascii("%PDF")))).toBeNull();
    expect(detectImageKind(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("friendlyError", () => {
  it("maps SQL hint codes to messages", () => {
    expect(friendlyError({ message: "x", hint: "DUPLICATE_REFERENCE" })).toMatch(/already been used/);
    expect(friendlyError({ message: "Your plan allows 5 active listings.", hint: "LIMIT_LISTINGS" })).toBe(
      "Your plan allows 5 active listings.",
    );
    expect(friendlyError({ message: "internal detail", hint: null })).toMatch(/Something went wrong/);
  });
});

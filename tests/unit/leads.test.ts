import { describe, expect, it } from "vitest";
import { dialable, isFollowUpDue, scoreLead } from "@/lib/leads";

const now = new Date("2026-10-10T04:00:00Z"); // Oct 10, 12:00 noon in Manila
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

const base = {
  status: "new" as const,
  phone: "",
  email: "",
  contact: "",
  source: "manual" as const,
  message: "",
  created_at: daysAgo(10),
  status_changed_at: daysAgo(10),
  viewing_at: null,
};

describe("scoreLead", () => {
  it("rates a fresh Facebook inquiry with phone and message as warm", () => {
    const s = scoreLead({ ...base, source: "facebook", phone: "0917 123 4567", message: "Pwede po mag viewing this Saturday?", created_at: daysAgo(1), status_changed_at: daysAgo(1) }, now);
    expect(s.score).toBe(45);
    expect(s.label).toBe("Warm");
    expect(s.reasons).toContain("Reached out on their own");
  });

  it("rates a lead in negotiation with an upcoming viewing as hot", () => {
    const s = scoreLead({ ...base, status: "negotiating", phone: "0917", viewing_at: new Date(now.getTime() + 86_400_000).toISOString(), status_changed_at: daysAgo(1) }, now);
    expect(s.label).toBe("Hot");
  });

  it("penalizes stalled leads and handles won/lost", () => {
    expect(scoreLead({ ...base, status_changed_at: daysAgo(20) }, now).score).toBe(0);
    expect(scoreLead({ ...base, status: "won" }, now)).toMatchObject({ score: 100, label: "Hot" });
    expect(scoreLead({ ...base, status: "lost" }, now)).toMatchObject({ score: 0, label: "Cold" });
  });
});

describe("isFollowUpDue", () => {
  it("uses the Philippine calendar day", () => {
    // 11pm Manila today (15:00 UTC) is still today.
    expect(isFollowUpDue({ status: "contacted", next_follow_up_at: "2026-10-10T15:00:00Z" }, now)).toBe(true);
    // 1am Manila tomorrow (17:00 UTC) is not due yet.
    expect(isFollowUpDue({ status: "contacted", next_follow_up_at: "2026-10-10T17:00:00Z" }, now)).toBe(false);
    expect(isFollowUpDue({ status: "won", next_follow_up_at: daysAgo(1) }, now)).toBe(false);
    expect(isFollowUpDue({ status: "new", next_follow_up_at: null }, now)).toBe(false);
  });
});

it("dialable keeps digits and a leading plus", () => {
  expect(dialable("0917 123-4567")).toBe("09171234567");
  expect(dialable("+63 917 123 4567")).toBe("+639171234567");
});

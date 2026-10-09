import { describe, expect, it } from "vitest";
import { messengerUrl, parseMessenger, telUrl, toPhilippineE164, viberUrl } from "@/lib/contact";

describe("parseMessenger", () => {
  it.each([
    ["ana.reyes", "ana.reyes"],
    ["@ana.reyes", "ana.reyes"],
    ["m.me/ana.reyes", "ana.reyes"],
    ["https://m.me/ana.reyes?ref=x", "ana.reyes"],
    ["https://www.facebook.com/ana.reyes/", "ana.reyes"],
    ["facebook.com/profile.php?id=100012345678901", "100012345678901"],
    ["https://www.messenger.com/t/ana.reyes", "ana.reyes"],
    ["", ""],
    ["   ", ""],
  ])("%s -> %s", (input, expected) => {
    expect(parseMessenger(input)).toBe(expected);
  });

  it("rejects things that are not usernames", () => {
    expect(parseMessenger("ana reyes")).toBeNull();
    expect(parseMessenger("https://evil.example.com/x")).toBeNull();
    expect(parseMessenger("ab")).toBeNull();
  });

  it("builds m.me links", () => {
    expect(messengerUrl("ana.reyes")).toBe("https://m.me/ana.reyes");
  });
});

describe("phone links", () => {
  it.each([
    ["0917 555 0142", "+639175550142"],
    ["+63 917 555 0142", "+639175550142"],
    ["639175550142", "+639175550142"],
    ["(0917) 555-0142", "+639175550142"],
    ["9175550142", "+639175550142"],
  ])("normalizes %s", (input, expected) => {
    expect(toPhilippineE164(input)).toBe(expected);
  });

  it("returns null for landlines and foreign numbers", () => {
    expect(toPhilippineE164("(032) 234 5678")).toBeNull();
    expect(toPhilippineE164("+1 415 555 0100")).toBeNull();
    expect(viberUrl("(032) 234 5678")).toBeNull();
  });

  it("builds viber and tel links", () => {
    expect(viberUrl("0917 555 0142")).toBe("viber://chat?number=%2B639175550142");
    expect(telUrl("0917 555 0142")).toBe("tel:09175550142");
  });
});

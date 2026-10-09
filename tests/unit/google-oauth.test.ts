import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { authorizationUrl, exchangeCodeForIdToken, googleRedirectUri, newAttempt } from "@/lib/google-oauth";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://prospectaph.netlify.app");
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-123.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret-xyz");
});
afterEach(() => vi.unstubAllEnvs());

describe("Google sign-in on our own domain", () => {
  it("sends Google back to our callback, not to Supabase", () => {
    expect(googleRedirectUri()).toBe("https://prospectaph.netlify.app/auth/google/callback");
    const url = new URL(authorizationUrl(newAttempt("/dashboard")));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("redirect_uri")).toBe("https://prospectaph.netlify.app/auth/google/callback");
    expect(url.searchParams.get("client_id")).toBe("client-123.apps.googleusercontent.com");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
  });

  it("gives Google the SHA-256 of the nonce and a PKCE challenge, never the raw secrets", () => {
    const a = newAttempt("/dashboard");
    const url = new URL(authorizationUrl(a));
    expect(url.searchParams.get("state")).toBe(a.state);
    expect(url.searchParams.get("nonce")).toBe(createHash("sha256").update(a.nonce).digest("hex"));
    expect(url.searchParams.get("code_challenge")).toBe(createHash("sha256").update(a.verifier).digest("base64url"));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.toString()).not.toContain(a.nonce);
    expect(url.toString()).not.toContain(a.verifier);
  });

  it("creates fresh secrets for every attempt", () => {
    const [a, b] = [newAttempt("/x"), newAttempt("/x")];
    expect(a.state).not.toBe(b.state);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.verifier).not.toBe(b.verifier);
  });

  it("exchanges the code for an ID token with the verifier and secret", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id_token: "eyJ.test" }), { status: 200 }));
    expect(await exchangeCodeForIdToken("code-1", "verifier-1", fetchMock as unknown as typeof fetch)).toBe("eyJ.test");
    const body = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams;
    expect(body.get("code")).toBe("code-1");
    expect(body.get("code_verifier")).toBe("verifier-1");
    expect(body.get("client_secret")).toBe("secret-xyz");
    expect(body.get("redirect_uri")).toBe("https://prospectaph.netlify.app/auth/google/callback");
  });

  it("returns null when Google rejects the code", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }));
    expect(await exchangeCodeForIdToken("bad", "v", fetchMock as unknown as typeof fetch)).toBeNull();
  });
});

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { SITE_URL } from "@/lib/env";

// Google sign-in handled on our own domain, so Google's consent screen says
// "to continue to prospectaph.netlify.app" instead of the Supabase project URL.
// Flow: /auth/google -> Google -> /auth/google/callback -> exchange the code for
// an ID token -> supabase.auth.signInWithIdToken(). The Supabase Google provider
// must list GOOGLE_CLIENT_ID under Client IDs (it verifies the token's audience).

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_STATE_COOKIE = "g_oauth";

export function isGoogleDirectConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export const googleRedirectUri = () => `${SITE_URL()}/auth/google/callback`;

const b64url = (buf: Buffer) => buf.toString("base64url");
const sha256 = (s: string) => createHash("sha256").update(s).digest();

/** Per-attempt secrets, kept in a short-lived httpOnly cookie between redirect and callback. */
export type GoogleAttempt = { state: string; nonce: string; verifier: string; next: string };

export function newAttempt(next: string): GoogleAttempt {
  return { state: b64url(randomBytes(24)), nonce: b64url(randomBytes(32)), verifier: b64url(randomBytes(48)), next };
}

export function authorizationUrl(a: GoogleAttempt, clientId = process.env.GOOGLE_CLIENT_ID!): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state: a.state,
    // Google gets the SHA-256 (hex) of the nonce; Supabase gets the raw value and compares.
    nonce: sha256(a.nonce).toString("hex"),
    code_challenge: b64url(sha256(a.verifier)),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTH_URL}?${params}`;
}

/** Exchanges the authorization code for Google's ID token. */
export async function exchangeCodeForIdToken(
  code: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const data = (await res.json().catch(() => null)) as { id_token?: string; error?: string } | null;
  if (!res.ok || !data?.id_token) {
    console.error("Google token exchange failed", res.status, data?.error);
    return null;
  }
  return data.id_token;
}

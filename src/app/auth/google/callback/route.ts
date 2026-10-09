import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForIdToken, GOOGLE_STATE_COOKIE, type GoogleAttempt } from "@/lib/google-oauth";

// Google redirects here after the consent screen. Checks the state, trades the
// code for an ID token, and starts the Supabase session with it.
export async function GET(request: NextRequest) {
  const fail = () => {
    const res = NextResponse.redirect(new URL("/login?error=oauth", request.url));
    res.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/auth/google" });
    return res;
  };

  let attempt: GoogleAttempt | null = null;
  try {
    attempt = JSON.parse(request.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? "null");
  } catch {
    attempt = null;
  }
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  // Cancelled on Google's screen, expired attempt, or a forged callback.
  if (params.get("error") || !code || !attempt || params.get("state") !== attempt.state) return fail();

  const idToken = await exchangeCodeForIdToken(code, attempt.verifier);
  if (!idToken) return fail();

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken, nonce: attempt.nonce });
  if (error) {
    console.error("signInWithIdToken(google) failed", error.message);
    return fail();
  }

  const res = NextResponse.redirect(new URL(attempt.next, request.url));
  res.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/auth/google" });
  return res;
}

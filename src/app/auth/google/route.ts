import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/actions/state";
import { authorizationUrl, GOOGLE_STATE_COOKIE, isGoogleDirectConfigured, newAttempt } from "@/lib/google-oauth";

// Starts Google sign-in on our own domain (see src/lib/google-oauth.ts).
export async function GET(request: NextRequest) {
  if (!isGoogleDirectConfigured()) return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  const attempt = newAttempt(safeNext(request.nextUrl.searchParams.get("next")));
  const res = NextResponse.redirect(authorizationUrl(attempt));
  res.cookies.set(GOOGLE_STATE_COOKIE, JSON.stringify(attempt), {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/auth/google",
    maxAge: 600,
  });
  return res;
}

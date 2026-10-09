import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/actions/state";

// PKCE code exchange: Google sign-in, and Supabase's default email templates.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  // The provider sends ?error=access_denied when someone cancels on Google's screen.
  if (request.nextUrl.searchParams.get("error")) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}

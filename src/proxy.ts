import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets and the cron endpoint (which uses its own secret).
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

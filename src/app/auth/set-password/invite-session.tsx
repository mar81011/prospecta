"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

// Supabase's default invite email signs the user in with tokens in the URL
// fragment (#access_token=...), which never reaches the server. Store them as
// a cookie session, then re-render the page on the server.
export function InviteSession() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access_token = hash.get("access_token") ?? "";
    const refresh_token = hash.get("refresh_token") ?? "";
    const verify =
      access_token && refresh_token
        ? createClient().auth.setSession({ access_token, refresh_token })
        : Promise.resolve({ error: new Error("missing tokens") });
    verify.then(({ error }) => {
        if (error) return setFailed(true);
        window.history.replaceState(null, "", window.location.pathname);
        router.refresh();
      });
  }, [router]);

  return (
    <Card>
      {failed ? (
        <Alert tone="error">
          This link is invalid or has expired.{" "}
          <Link href="/forgot-password" className="underline">
            Request a new link
          </Link>
          .
        </Alert>
      ) : (
        <p className="text-sm text-zinc-600">Verifying your link…</p>
      )}
    </Card>
  );
}

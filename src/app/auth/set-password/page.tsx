import type { Metadata } from "next";
import { Logo } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/require";
import { SetPasswordForm } from "./set-password-form";
import { InviteSession } from "./invite-session";

export const metadata: Metadata = { title: "Set password" };

// Reached from an admin invitation or a password-reset email. The link has
// already signed the user in; they choose their own password here.
export default async function SetPasswordPage() {
  const user = await getCurrentUser();
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo />
        </div>
        {user ? <SetPasswordForm email={user.email} /> : <InviteSession />}
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { AuthForm } from "../auth-form";
import { signIn } from "../actions";
import { safeNext } from "@/lib/actions/state";
import { isSmsSignInEnabled } from "@/lib/sms";
import { FACEBOOK_LOGIN_ENABLED } from "@/lib/env";

const ERRORS: Record<string, string> = {
  link: "That link is invalid or has expired. Please try again.",
  facebook: "Facebook sign-in didn't finish. Please try again, or use another way below.",
};

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <AuthForm
      mode="login"
      action={signIn}
      next={safeNext(next)}
      phoneEnabled={isSmsSignInEnabled()}
      facebookEnabled={FACEBOOK_LOGIN_ENABLED()}
      initialError={typeof error === "string" ? ERRORS[error] : undefined}
    />
  );
}

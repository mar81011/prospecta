import type { Metadata } from "next";
import { AuthForm } from "../auth-form";
import { signIn } from "../actions";
import { safeNext } from "@/lib/actions/state";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <AuthForm
      mode="login"
      action={signIn}
      next={safeNext(next)}
      initialError={error === "link" ? "That link is invalid or has expired. Please try again." : undefined}
    />
  );
}

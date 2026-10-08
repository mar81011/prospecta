"use client";

import Link from "next/link";
import { Alert, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/lib/actions/use-form-action";
import { initialFormState, type FormState } from "@/lib/actions/state";

type Mode = "login" | "register" | "forgot";

const COPY: Record<Mode, { title: string; subtitle: string; submit: string }> = {
  login: { title: "Sign in", subtitle: "Welcome back.", submit: "Sign in" },
  register: { title: "Create your account", subtitle: "Start on the Free plan. No payment needed.", submit: "Create account" },
  forgot: { title: "Reset your password", subtitle: "We'll email you a reset link.", submit: "Send reset link" },
};

export function AuthForm({
  mode,
  action,
  next,
  initialError,
}: {
  mode: Mode;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  next?: string;
  initialError?: string;
}) {
  const [state, formAction, formActionPending] = useFormAction(action);
  const error = state === initialFormState ? initialError : state.error;
  const copy = COPY[mode];

  if (state.message) {
    return (
      <Card>
        <Alert tone="success">{state.message}</Alert>
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="mb-1 text-xl font-semibold">{copy.title}</h1>
      <p className="mb-6 text-sm text-zinc-600">{copy.subtitle}</p>
      <form onSubmit={formAction} className="space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        {mode === "register" && (
          <Field label="Full name" htmlFor="name">
            <Input id="name" name="name" autoComplete="name" required />
          </Field>
        )}
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        {mode !== "forgot" && (
          <Field label="Password" htmlFor="password" hint={mode === "register" ? "At least 8 characters." : undefined}>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              minLength={8}
              required
            />
          </Field>
        )}
        {error && <Alert tone="error">{error}</Alert>}
        <SubmitButton pending={formActionPending} className="w-full" pendingText="Please wait…">
          {copy.submit}
        </SubmitButton>
      </form>
      <div className="mt-6 space-y-2 text-center text-sm text-zinc-600">
        {mode === "login" ? (
          <>
            <p>
              <Link href="/forgot-password" className="text-brand-600 hover:underline">
                Forgot your password?
              </Link>
            </p>
            <p>
              New to Prospecta?{" "}
              <Link href="/register" className="font-medium text-brand-600 hover:underline">
                Create an account
              </Link>
            </p>
          </>
        ) : (
          <p>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </Card>
  );
}

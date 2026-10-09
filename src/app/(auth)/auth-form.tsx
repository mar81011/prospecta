"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Card, Field, Input, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/lib/actions/use-form-action";
import { initialFormState, type FormState } from "@/lib/actions/state";
import { PhoneAuth } from "./phone-auth";
import { signInWithGoogle } from "./actions";

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
  phoneEnabled = false,
  googleEnabled = false,
}: {
  mode: Mode;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  next?: string;
  initialError?: string;
  /** Show the mobile number (SMS code) option; false until SMS is configured. */
  phoneEnabled?: boolean;
  /** Show "Continue with Google"; false until the provider is set up. */
  googleEnabled?: boolean;
}) {
  const [state, formAction, formActionPending] = useFormAction(action);
  const error = state === initialFormState ? initialError : state.error;
  const copy = COPY[mode];
  // Mobile number first: many agents rarely check email.
  const [method, setMethod] = useState<"phone" | "email">(phoneEnabled && !initialError ? "phone" : "email");
  // With Google on, it is the only way to register; on Login, email/password
  // stays available behind a link (admins and older accounts).
  const googleFirst = googleEnabled && mode !== "forgot";
  const [showOther, setShowOther] = useState(!googleFirst);

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
      {googleFirst && (
        <>
          <form action={signInWithGoogle}>
            {next && <input type="hidden" name="next" value={next} />}
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-xs transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <svg viewBox="0 0 48 48" aria-hidden className="h-5 w-5">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
              Continue with Google
            </button>
          </form>
          <p className="mt-2 text-center text-xs text-zinc-500">We only get your name, email and profile picture.</p>
          {!showOther && error && (
            <div className="mt-4">
              <Alert tone="error">{error}</Alert>
            </div>
          )}
          {showOther ? (
            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-zinc-400">
              <span className="h-px flex-1 bg-zinc-200" />
              or
              <span className="h-px flex-1 bg-zinc-200" />
            </div>
          ) : (
            mode === "login" && (
              <p className="mt-5 text-center text-sm">
                <button type="button" onClick={() => setShowOther(true)} className="text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline">
                  Sign in with email instead
                </button>
              </p>
            )
          )}
        </>
      )}
      {showOther && mode !== "forgot" && phoneEnabled && (
        <div role="tablist" aria-label="Sign-in method" className="mb-5 grid grid-cols-2 rounded-lg bg-zinc-100 p-1 text-sm font-medium">
          {(["phone", "email"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={method === m}
              onClick={() => setMethod(m)}
              className={cx(
                "rounded-md py-1.5 transition-colors",
                method === m ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800",
              )}
            >
              {m === "phone" ? "Mobile number" : "Email"}
            </button>
          ))}
        </div>
      )}
      {!showOther ? null : mode !== "forgot" && method === "phone" ? (
        <PhoneAuth mode={mode} next={next} />
      ) : (
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
      )}
      <div className="mt-6 space-y-2 text-center text-sm text-zinc-600">
        {mode === "login" ? (
          <>
            {showOther && method === "email" && (
              <p>
                <Link href="/forgot-password" className="text-brand-600 hover:underline">
                  Forgot your password?
                </Link>
              </p>
            )}
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

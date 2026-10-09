"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Card, Field, Input, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/lib/actions/use-form-action";
import { initialFormState, type FormState } from "@/lib/actions/state";
import { PhoneAuth } from "./phone-auth";
import { signInWithFacebook } from "./actions";

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
  facebookEnabled = false,
}: {
  mode: Mode;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  next?: string;
  initialError?: string;
  /** Show the mobile number (SMS code) option; false until SMS is configured. */
  phoneEnabled?: boolean;
  /** Show "Continue with Facebook"; false until the provider is set up. */
  facebookEnabled?: boolean;
}) {
  const [state, formAction, formActionPending] = useFormAction(action);
  const error = state === initialFormState ? initialError : state.error;
  const copy = COPY[mode];
  // Mobile number first: many agents rarely check email.
  const [method, setMethod] = useState<"phone" | "email">(phoneEnabled && !initialError ? "phone" : "email");

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
      {mode !== "forgot" && facebookEnabled && (
        <>
          <form action={signInWithFacebook}>
            {next && <input type="hidden" name="next" value={next} />}
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#166FE5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1877F2]"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 fill-current">
                <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07" />
              </svg>
              Continue with Facebook
            </button>
          </form>
          <p className="mt-2 text-center text-xs text-zinc-500">
            We only get your name, email and profile picture. We never post on your behalf.
          </p>
          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-zinc-400">
            <span className="h-px flex-1 bg-zinc-200" />
            or
            <span className="h-px flex-1 bg-zinc-200" />
          </div>
        </>
      )}
      {mode !== "forgot" && phoneEnabled && (
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
      {mode !== "forgot" && method === "phone" ? (
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
            {method === "email" && (
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

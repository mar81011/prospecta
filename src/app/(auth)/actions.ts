"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/env";
import { safeNext, type FormState } from "@/lib/actions/state";
import { toPhilippineE164 } from "@/lib/contact";

const credentials = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      error:
        error.code === "email_not_confirmed"
          ? "Please confirm your email first. Check your inbox for the confirmation link."
          : "Incorrect email or password.",
    };
  }
  redirect(safeNext(formData.get("next")));
}

const registration = credentials.extend({
  name: z.string().trim().min(2, "Enter your name.").max(100),
});

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registration.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
      emailRedirectTo: `${SITE_URL()}/auth/callback?next=/dashboard`,
    },
  });
  if (error) return { error: error.message };

  // With email confirmation on, there is no session until the link is clicked.
  if (data.session) redirect("/dashboard");
  return { message: `We sent a confirmation link to ${parsed.data.email}. Open it to activate your account.` };
}

// ---------------------------------------------------------------------------
// Mobile number sign-in: Supabase sends a 6-digit code by SMS (via the
// /api/auth/sms-hook -> Semaphore), then verifyPhoneCode() starts the session.
// ---------------------------------------------------------------------------

export type PhoneCodeResult = { error?: string; phone?: string };

export async function sendPhoneCode(
  mode: "login" | "register",
  input: { phone: string; name?: string },
): Promise<PhoneCodeResult> {
  const phone = toPhilippineE164(input.phone);
  if (!phone) return { error: "Enter a Philippine mobile number, e.g. 0917 123 4567." };
  const name = (input.name ?? "").trim();
  if (mode === "register" && (name.length < 2 || name.length > 100)) return { error: "Enter your name." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: mode === "register", channel: "sms", data: mode === "register" ? { name } : undefined },
  });
  if (error) {
    if (mode === "login" && (error.code === "otp_disabled" || /signups? not allowed/i.test(error.message))) {
      return { error: "No account uses this number yet. Create an account first." };
    }
    if (error.status === 429 || error.code?.includes("rate_limit")) {
      return { error: "Please wait a minute before asking for another code." };
    }
    console.error("signInWithOtp failed", error.code, error.message);
    return { error: "We couldn't send the code. Check the number and try again." };
  }
  return { phone };
}

export async function verifyPhoneCode(phone: string, code: string, next?: string): Promise<{ error?: string }> {
  const e164 = toPhilippineE164(phone);
  const token = code.replace(/\D/g, "");
  if (!e164 || token.length !== 6) return { error: "Enter the 6-digit code from the SMS." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ phone: e164, token, type: "sms" });
  if (error) return { error: "That code is wrong or has expired. Request a new one." };
  redirect(safeNext(next));
}

// Facebook sign-in (Supabase OAuth, PKCE). New users get a Free profile named
// after their Facebook name; /auth/callback exchanges the code for a session.
export async function signInWithFacebook(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "facebook",
    options: {
      redirectTo: `${SITE_URL()}/auth/callback?next=${encodeURIComponent(next)}`,
      scopes: "email",
    },
  });
  if (error || !data.url) {
    console.error("signInWithOAuth(facebook) failed", error?.message);
    redirect("/login?error=facebook");
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { error: "Enter a valid email address." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${SITE_URL()}/auth/callback?next=/auth/set-password`,
  });
  // Same response whether or not the account exists.
  return { message: "If an account exists for that email, a reset link is on its way." };
}

export async function setPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords do not match." };

  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { error: "Your link has expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

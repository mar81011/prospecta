import type { Metadata } from "next";
import { AuthForm } from "../auth-form";
import { signUp } from "../actions";
import { isSmsSignInEnabled } from "@/lib/sms";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return <AuthForm mode="register" action={signUp} phoneEnabled={isSmsSignInEnabled()} />;
}

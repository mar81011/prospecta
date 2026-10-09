"use client";

import { useEffect, useState, useTransition } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { sendPhoneCode, verifyPhoneCode } from "./actions";

const RESEND_SECONDS = 60;

function formatLocal(e164: string) {
  const d = e164.replace(/^\+63/, "0");
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
}

export function PhoneAuth({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [sentTo, setSentTo] = useState<string>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [wait, setWait] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = () =>
    startTransition(async () => {
      setError(undefined);
      const res = await sendPhoneCode(mode, { phone, name });
      if (res.error) return setError(res.error);
      setSentTo(res.phone);
      setCode("");
      setWait(RESEND_SECONDS);
    });

  const verify = (value = code) =>
    startTransition(async () => {
      setError(undefined);
      const res = await verifyPhoneCode(sentTo!, value, next);
      if (res?.error) setError(res.error);
    });

  if (sentTo) {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          verify();
        }}
      >
        <p className="text-sm text-zinc-600">
          We texted a 6-digit code to <strong className="text-zinc-900">{formatLocal(sentTo)}</strong>.
        </p>
        <Field label="Code" htmlFor="code">
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(v);
              if (v.length === 6) verify(v);
            }}
            className="text-center text-2xl tracking-[0.5em]"
          />
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" className="w-full" disabled={pending || code.length !== 6}>
          {pending ? "Checking…" : mode === "register" ? "Create account" : "Sign in"}
        </Button>
        <div className="flex justify-between text-sm">
          <button
            type="button"
            className="text-zinc-600 hover:underline"
            onClick={() => {
              setSentTo(undefined);
              setError(undefined);
            }}
          >
            Change number
          </button>
          <button
            type="button"
            className="text-brand-600 hover:underline disabled:text-zinc-400 disabled:no-underline"
            disabled={wait > 0 || pending}
            onClick={send}
          >
            {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      {mode === "register" && (
        <Field label="Full name" htmlFor="phone-name">
          <Input id="phone-name" autoComplete="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      )}
      <Field label="Mobile number" htmlFor="phone" hint="We'll text you a 6-digit code. No password needed.">
        <div className="flex items-stretch overflow-hidden rounded-lg border border-zinc-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
          <span className="flex items-center gap-1 border-r border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-600">🇵🇭 +63</span>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="917 123 4567"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="min-w-0 flex-1 px-3 py-2 text-sm focus:outline-none"
          />
        </div>
      </Field>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending code…" : "Text me a code"}
      </Button>
    </form>
  );
}

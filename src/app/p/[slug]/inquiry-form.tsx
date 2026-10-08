"use client";

import { Alert, Card, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/lib/actions/use-form-action";
import { submitInquiry } from "./actions";

export function InquiryForm({ slug, source, title }: { slug: string; source: "facebook" | "website"; title: string }) {
  const [state, onSubmit, pending] = useFormAction(submitInquiry.bind(null, slug));

  if (state.message) {
    return (
      <Card>
        <Alert tone="success">
          <strong>Inquiry sent!</strong> The agent will contact you soon about &ldquo;{title}&rdquo;.
        </Alert>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">Interested in this property?</h2>
      <p className="mb-4 text-sm text-zinc-600">Leave your details and the agent will get back to you.</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <input type="hidden" name="source" value={source} />
        {/* Honeypot for bots; hidden from people and screen readers. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Company
            <input name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <Field label="Your name" htmlFor="inq-name">
          <Input id="inq-name" name="name" autoComplete="name" required minLength={2} maxLength={100} />
        </Field>
        <Field label="Mobile number" htmlFor="inq-phone">
          <Input id="inq-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="09XX XXX XXXX" maxLength={30} />
        </Field>
        <Field label="Email (optional)" htmlFor="inq-email">
          <Input id="inq-email" name="email" type="email" autoComplete="email" maxLength={200} />
        </Field>
        <Field label="Message" htmlFor="inq-message">
          <Textarea
            id="inq-message"
            name="message"
            rows={3}
            maxLength={2000}
            defaultValue="Hi! Is this property still available? I'd like to know more."
          />
        </Field>
        {state.error && <Alert tone="error">{state.error}</Alert>}
        <SubmitButton pending={pending} className="w-full" pendingText="Sending…">
          Send inquiry
        </SubmitButton>
        <p className="text-center text-xs text-zinc-500">Your details are shared only with this listing&apos;s agent.</p>
      </form>
    </Card>
  );
}

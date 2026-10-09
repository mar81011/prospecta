"use client";

import { Alert, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/lib/actions/use-form-action";
import { updateProfile } from "./actions";

export type ProfileFields = {
  name: string;
  phone: string;
  /** Undefined until migration 20261011000002 is applied. */
  slug?: string;
  bio?: string;
  messenger?: string;
  viber?: boolean;
};

export function ProfileForm({ profile, siteUrl }: { profile: ProfileFields; siteUrl: string }) {
  const [state, onSubmit, pending] = useFormAction(updateProfile);
  const hasPage = profile.slug !== undefined;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Full name" htmlFor="name" hint="Shown on your public listing pages.">
        <Input id="name" name="name" defaultValue={profile.name} autoComplete="name" required minLength={2} maxLength={100} />
      </Field>
      <Field label="Mobile number" htmlFor="phone" hint="Buyers can call or text you from your listing pages. Leave blank to hide it.">
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={profile.phone}
          autoComplete="tel"
          placeholder="0917 123 4567"
          maxLength={30}
        />
      </Field>

      {hasPage && (
        <>
          <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm">
            <input
              type="checkbox"
              name="viber"
              defaultChecked={profile.viber}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-brand-600"
            />
            <span>
              <span className="font-medium text-zinc-800">I use Viber on this number</span>
              <span className="block text-zinc-500">Adds a &ldquo;Viber&rdquo; button so buyers can chat with you there.</span>
            </span>
          </label>

          <Field
            label="Facebook Messenger"
            htmlFor="messenger"
            hint="Your Facebook username or profile link. Adds a “Messenger” button that opens a chat with you. Leave blank to hide it."
          >
            <Input id="messenger" name="messenger" defaultValue={profile.messenger} placeholder="facebook.com/ana.reyes" maxLength={200} />
          </Field>

          <Field label="Short bio" htmlFor="bio" hint="Shown on your agent page. E.g. your PRC license, areas you cover, years of experience.">
            <Textarea
              id="bio"
              name="bio"
              rows={3}
              defaultValue={profile.bio}
              maxLength={300}
              placeholder="PRC-licensed broker covering Cebu City and Mandaue. 8 years helping families find their first home."
            />
          </Field>

          <Field
            label="Your page link"
            htmlFor="slug"
            hint="Changing it breaks links you've already shared with the old one."
          >
            <div className="flex items-stretch overflow-hidden rounded-lg border border-zinc-300 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
              <span className="flex items-center border-r border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-500">
                {siteUrl.replace(/^https?:\/\//, "")}/a/
              </span>
              <input
                id="slug"
                name="slug"
                defaultValue={profile.slug}
                required
                minLength={3}
                maxLength={40}
                pattern="[a-z0-9][a-z0-9\-]{1,38}[a-z0-9]"
                title="3-40 lowercase letters, numbers and dashes"
                className="min-w-0 flex-1 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </Field>
        </>
      )}

      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
      <SubmitButton pending={pending}>Save profile</SubmitButton>
    </form>
  );
}

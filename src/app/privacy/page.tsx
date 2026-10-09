import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth/require";
import { createAdminClient } from "@/lib/supabase/admin";

// Public privacy policy, also linked from Google sign-in's consent screen.

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Prospecta collects, uses and protects your information, and how to delete your data.",
};

const UPDATED = "October 11, 2026";

async function supportContacts() {
  try {
    const { data } = await createAdminClient()
      .from("app_settings")
      .select("support_email, support_messenger_url")
      .maybeSingle();
    return { email: data?.support_email ?? "", messenger: data?.support_messenger_url ?? "" };
  } catch {
    return { email: "", messenger: "" };
  }
}

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}

export default async function PrivacyPage() {
  const [user, contact] = await Promise.all([getCurrentUser(), supportContacts()]);
  const reachUs = (
    <>
      {contact.messenger && (
        <>
          message us on{" "}
          <a href={contact.messenger} className="text-brand-600 underline" target="_blank" rel="noreferrer">
            Messenger
          </a>
        </>
      )}
      {contact.messenger && contact.email && " or "}
      {contact.email && (
        <>
          email{" "}
          <a href={`mailto:${contact.email}`} className="text-brand-600 underline">
            {contact.email}
          </a>
        </>
      )}
      {!contact.messenger && !contact.email && "contact us through the support details shown in the app"}
    </>
  );

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <article className="space-y-8 rounded-2xl border border-zinc-200 bg-white p-6 text-sm leading-relaxed text-zinc-700 shadow-sm sm:p-10">
          <header>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Privacy Policy</h1>
            <p className="mt-2 text-zinc-500">Last updated {UPDATED}</p>
            <p className="mt-4">
              Prospecta helps real-estate agents in the Philippines list properties, share them on Facebook and manage
              buyer leads. This policy explains what we collect, why, and the choices you have. We handle personal data in
              line with the Data Privacy Act of 2012 (Republic Act No. 10173).
            </p>
          </header>

          <Section title="What we collect">
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>Your account:</strong> your name, and your email address or mobile number. If you sign in with
                Google, we receive your name, email address and profile picture. We never receive your Google password or
                access your Gmail, contacts or files.
              </li>
              <li>
                <strong>Your public profile:</strong> details you choose to show buyers, such as your contact number, photo,
                bio and Messenger username.
              </li>
              <li>
                <strong>Listings:</strong> property details and photos you upload.
              </li>
              <li>
                <strong>Leads:</strong> names, contact details and messages that buyers send through your listing pages, and
                notes you add.
              </li>
              <li>
                <strong>Payments:</strong> for paid plans, the GCash reference number, payment date and any receipt
                screenshot you upload. We never receive your GCash PIN or card details.
              </li>
              <li>
                <strong>Usage:</strong> how many times your listing pages are viewed and their contact buttons are tapped,
                plus basic technical logs (such as browser type) used to keep the service secure.
              </li>
            </ul>
          </Section>

          <Section title="How we use it">
            <ul className="list-disc space-y-2 pl-5">
              <li>To run your account, show your listings to buyers, and pass buyer inquiries to you.</li>
              <li>To verify payments and activate your plan.</li>
              <li>To show you listing stats and send in-app notifications.</li>
              <li>
                To power optional AI features, such as writing listing descriptions and answering buyer questions. The
                relevant listing details are sent to our AI provider to generate the response.
              </li>
              <li>To keep the service secure and prevent abuse.</li>
            </ul>
            <p>We do not sell your personal data, and we do not use it for advertising.</p>
          </Section>

          <Section title="Who we share it with">
            <p>Only the service providers we need to run Prospecta, under their own data-protection terms:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Supabase (database, sign-in and file storage) and Netlify (website hosting).</li>
              <li>Anthropic (AI features), only when an AI feature is used.</li>
              <li>Google, only when you choose to sign in with Google.</li>
              <li>Meta (Facebook), only when you share a listing there.</li>
              <li>An SMS provider, only if you sign in with a mobile number code.</li>
            </ul>
            <p>
              Anything you put on a public listing or agent page (such as your name, photo, contact number and listing
              details) can be seen by anyone with the link.
            </p>
          </Section>

          <Section title="How long we keep it">
            <p>
              We keep your data while your account is active. If your paid plan expires, your listings and leads are kept so
              you don&apos;t lose them. Payment records are kept for accounting and audit purposes. When you ask us to delete
              your account, we delete it as described below.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              You can see and update most of your information on your Account page, and delete listings, photos and leads
              yourself. You may also ask us for a copy of your data, to correct it, or to delete it.
            </p>
          </Section>

          <Section id="delete" title="How to delete your data">
            <ol className="list-decimal space-y-2 pl-5">
              <li>Delete individual listings and photos at any time from the Listings page.</li>
              <li>
                To delete your whole account and all its data, {reachUs} from the email address or mobile number you signed
                up with, and say &ldquo;Delete my Prospecta account&rdquo;.
              </li>
              <li>
                We will delete your account, profile, listings, photos and leads within 30 days and confirm when it&apos;s
                done. Payment records may be kept where the law requires.
              </li>
            </ol>
            <p>
              If you signed in with Google, you can also remove Prospecta&apos;s access at{" "}
              <a href="https://myaccount.google.com/connections" className="text-brand-600 underline" target="_blank" rel="noreferrer">
                myaccount.google.com/connections
              </a>
              . That stops future Google sign-ins. To delete the data we already hold, follow step 2 above.
            </p>
          </Section>

          <Section title="Security">
            <p>
              Data is sent over HTTPS. Access is limited so each agent can only see their own records. Payment screenshots are
              stored privately and shown only to you and our admins.
            </p>
          </Section>

          <Section title="Contact">
            <p>For any privacy question or request, {reachUs}.</p>
          </Section>
        </article>
      </main>
    </>
  );
}

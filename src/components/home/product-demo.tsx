"use client";

import { useState } from "react";
import { Badge, Button, LogoMark, cx } from "@/components/ui";
import { leadStatus, scoreLead, LEAD_STATUSES } from "@/lib/leads";

// Interactive homepage walkthrough with sample data. Nothing here touches the
// database; the lead score comes from the same scoreLead() the Leads page uses.

const LISTING = {
  type: "Condo · For sale",
  location: "Cebu IT Park, Lahug, Cebu City",
  price: "₱6,500,000",
  specs: "2 BR · 1 bath · 58 sqm · 1 parking",
  title: "Bright 2BR Condo with Parking, Walk to Cebu IT Park",
  description:
    "Wake up five minutes from work. This corner 2-bedroom unit gets morning light, has a balcony facing the city, and comes with its own parking slot.",
  bullets: ["58 sqm, corner unit with balcony", "1 dedicated parking slot", "Walking distance to offices, malls and cafés"],
  slug: "bright-2br-condo-cebu-it-park",
};

const NOW = new Date("2026-10-09T10:00:00+08:00");
const DEMO_LEAD = {
  name: "Maria Santos",
  status: "qualified" as const,
  phone: "0917 555 0142",
  email: "",
  contact: "0917 555 0142",
  source: "website" as const,
  message: "Is parking included? Looking to move in by December, pre-approved for a bank loan.",
  created_at: "2026-10-08T20:15:00+08:00",
  status_changed_at: "2026-10-09T09:00:00+08:00",
  viewing_at: "2026-10-11T14:00:00+08:00",
};

const STEPS = [
  {
    label: "List",
    title: "Add a listing in a minute",
    body: "Type the basic facts. The AI writes a clear title and description in English, Taglish or Tagalog, using only the facts you gave it.",
  },
  {
    label: "Share",
    title: "Share it on Facebook",
    body: "Every listing gets its own public page with photos and your contact details. Paste the link into your post or group, and Facebook shows a preview card.",
  },
  {
    label: "Capture",
    title: "Buyers ask, you get the lead",
    body: "Buyers send an inquiry from the listing page. On Starter and Pro, an AI assistant answers their questions any time of day and saves their contact details as a lead.",
  },
  {
    label: "Close",
    title: "Follow up and close the deal",
    body: "Every lead lands in your pipeline with a score that explains itself, a suggested next step, and a reminder for the site viewing.",
  },
] as const;

export function ProductDemo() {
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div role="tablist" aria-label="Demo steps" className="grid grid-cols-4 border-b border-zinc-200">
        {STEPS.map((s, i) => (
          <button
            key={s.label}
            role="tab"
            id={`demo-tab-${i}`}
            aria-selected={i === step}
            aria-controls="demo-panel"
            onClick={() => setStep(i)}
            className={cx(
              "flex flex-col items-center gap-1 px-2 py-3 text-xs font-medium transition-colors sm:flex-row sm:justify-center sm:gap-2 sm:text-sm",
              i === step ? "bg-brand-50 text-brand-700" : "text-zinc-500 hover:bg-zinc-50",
            )}
          >
            <span
              className={cx(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                i === step ? "bg-brand-600 text-white" : "bg-zinc-100 text-zinc-600",
              )}
            >
              {i + 1}
            </span>
            {s.label}
          </button>
        ))}
      </div>

      <div
        id="demo-panel"
        role="tabpanel"
        aria-labelledby={`demo-tab-${step}`}
        className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[2fr_3fr] lg:items-center"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Step {step + 1} of 4</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight">{current.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">{current.body}</p>
          <div className="mt-5 flex gap-2">
            {step > 0 && (
              <Button variant="secondary" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)}>Next step</Button>
            ) : (
              <Button variant="secondary" onClick={() => setStep(0)}>
                Start over
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
          {step === 0 && <ListingStep />}
          {step === 1 && <ShareStep />}
          {step === 2 && <CaptureStep />}
          {step === 3 && <CloseStep />}
        </div>
      </div>
      <p className="border-t border-zinc-200 px-5 py-2 text-center text-xs text-zinc-500">Sample data, for illustration only.</p>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-zinc-200 py-1.5 text-sm last:border-0">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right font-medium text-zinc-800">{value}</span>
    </div>
  );
}

function ListingStep() {
  const [written, setWritten] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 bg-white px-3 py-1">
        <FactRow label="Type" value={LISTING.type} />
        <FactRow label="Location" value={LISTING.location} />
        <FactRow label="Price" value={LISTING.price} />
        <FactRow label="Details" value={LISTING.specs} />
      </div>
      {written ? (
        <div className="rounded-lg border border-brand-100 bg-white p-4" aria-live="polite">
          <Badge className="bg-brand-50 text-brand-700">Written by AI</Badge>
          <p className="mt-2 font-semibold">{LISTING.title}</p>
          <p className="mt-1 text-sm text-zinc-600">{LISTING.description}</p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-600">
            {LISTING.bullets.map((b) => (
              <li key={b}>• {b}</li>
            ))}
          </ul>
        </div>
      ) : (
        <Button className="w-full" onClick={() => setWritten(true)}>
          ✨ Write with AI
        </Button>
      )}
    </div>
  );
}

function ShareStep() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white text-sm shadow-xs">
      <div className="flex items-center gap-2 p-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600">
          AR
        </span>
        <div>
          <p className="font-semibold leading-tight">Ana Reyes · Realtor</p>
          <p className="text-xs text-zinc-500">Just now · Public</p>
        </div>
      </div>
      <p className="px-3 pb-3 text-zinc-700">
        Bagong listing sa IT Park! 2BR condo with parking, walking distance lang sa office. ₱6.5M. Message me or check the
        details here 👇
      </p>
      <div className="border-y border-zinc-200">
        <div className="flex h-36 items-center justify-center bg-gradient-to-br from-brand-100 via-sky-50 to-amber-50">
          <LogoMark className="h-12 w-12 opacity-80" />
        </div>
        <div className="bg-zinc-50 px-3 py-2">
          <p className="text-xs uppercase text-zinc-500">prospectaph.netlify.app</p>
          <p className="font-semibold leading-snug">{LISTING.title}</p>
          <p className="text-xs text-zinc-500">
            {LISTING.price} · {LISTING.specs}
          </p>
        </div>
      </div>
      <div className="flex justify-around py-2 text-xs font-medium text-zinc-500">
        <span>👍 Like</span>
        <span>💬 Comment</span>
        <span>↗ Share</span>
      </div>
    </div>
  );
}

const CHAT = [
  { from: "buyer", text: "Hi! Is parking included?" },
  { from: "ai", text: "Yes, the unit comes with 1 dedicated parking slot. It's a 58 sqm corner unit with a balcony, priced at ₱6,500,000." },
  { from: "buyer", text: "Nice. Can I view it this Saturday? My number is 0917 555 0142, Maria Santos." },
  { from: "ai", text: "Thanks, Maria! I've passed your details to Ana, the agent. She'll confirm a Saturday viewing with you." },
] as const;

function CaptureStep() {
  const [shown, setShown] = useState(1);
  const done = shown >= CHAT.length;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Ask about this property</p>
        <Badge className="bg-violet-100 text-violet-800">Starter & Pro</Badge>
      </div>
      <div className="space-y-2" aria-live="polite">
        {CHAT.slice(0, shown).map((m, i) => (
          <div key={i} className={cx("flex", m.from === "buyer" ? "justify-end" : "justify-start")}>
            <p
              className={cx(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                m.from === "buyer" ? "bg-brand-600 text-white" : "border border-zinc-200 bg-white text-zinc-800",
              )}
            >
              {m.text}
            </p>
          </div>
        ))}
      </div>
      {done ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          ✓ New lead saved: <strong>Maria Santos</strong> · 0917 555 0142
        </p>
      ) : (
        <Button variant="secondary" className="w-full" onClick={() => setShown(shown + 1)}>
          Show next message
        </Button>
      )}
    </div>
  );
}

function CloseStep() {
  const score = scoreLead(DEMO_LEAD, NOW);
  const status = leadStatus(DEMO_LEAD.status);
  const pipeline = LEAD_STATUSES.filter((s) => s.value !== "lost");
  const at = pipeline.findIndex((s) => s.value === DEMO_LEAD.status);
  return (
    <div className="space-y-4">
      <ol className="flex gap-1" aria-label="Pipeline">
        {pipeline.map((s, i) => (
          <li
            key={s.value}
            className={cx(
              "flex-1 rounded py-1 text-center text-[10px] font-medium sm:text-xs",
              i <= at ? "bg-brand-600 text-white" : "bg-zinc-200 text-zinc-500",
            )}
          >
            {s.label}
          </li>
        ))}
      </ol>
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{DEMO_LEAD.name}</p>
            <p className="text-xs text-zinc-500">
              {DEMO_LEAD.phone} · via listing page
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold leading-none text-orange-600">{score.score}</p>
            <p className="text-xs font-semibold text-orange-600">{score.label}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge className={status.className}>{status.label}</Badge>
          {score.reasons
            .filter((r) => !r.startsWith("Stage"))
            .map((r) => (
              <Badge key={r} className="bg-zinc-100 text-zinc-600">
                {r}
              </Badge>
            ))}
        </div>
        <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          📅 Site viewing: <strong>Sat, Oct 11 · 2:00 PM</strong>
        </div>
        <div className="mt-2 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700">
          <strong>AI next step:</strong> Confirm Saturday&apos;s viewing by text and ask which bank pre-approved her loan.
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Alert, Button, Card, cx, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useFormAction } from "@/lib/actions/use-form-action";
import { LEAD_STATUSES } from "@/lib/leads";
import type { LeadStatus } from "@/lib/database.types";
import { addLeadNote, deleteLeadNote, setLeadStatus, updateLeadSchedule } from "../actions";
import { analyzeLeadWithAi } from "../../ai-actions";
import type { LeadAnalysis } from "@/lib/ai/types";

export function StatusPicker({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div>
      <div role="radiogroup" aria-label="Lead status" className="flex flex-wrap gap-1.5">
        {LEAD_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={s.value === status}
            disabled={pending}
            onClick={() => s.value !== status && startTransition(async () => setError((await setLeadStatus(leadId, s.value)).error))}
            className={cx(
              "rounded-full px-3 py-1 text-sm font-medium ring-1 transition-colors disabled:opacity-60",
              s.value === status ? cx(s.className, "ring-transparent") : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function ScheduleForm({ leadId, followUp, viewing }: { leadId: string; followUp: string; viewing: string }) {
  const [state, onSubmit, pending] = useFormAction(updateLeadSchedule.bind(null, leadId));
  return (
    <Card>
      <h2 className="mb-3 font-semibold">Schedule</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Next follow-up" htmlFor="followUp" hint="You'll see it on your dashboard that day.">
          <Input id="followUp" name="followUp" type="date" defaultValue={followUp} />
        </Field>
        <Field label="Site viewing" htmlFor="viewing">
          <Input id="viewing" name="viewing" type="datetime-local" defaultValue={viewing} />
        </Field>
        {state.error && <Alert tone="error">{state.error}</Alert>}
        {state.message && <Alert tone="success">{state.message}</Alert>}
        <SubmitButton pending={pending} variant="secondary">
          Save schedule
        </SubmitButton>
      </form>
    </Card>
  );
}

export function NoteForm({ leadId }: { leadId: string }) {
  const [state, onSubmit, pending] = useFormAction(addLeadNote.bind(null, leadId));
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.message) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-2">
      <Textarea
        name="body"
        rows={2}
        maxLength={5000}
        placeholder="Add a note, e.g. Called — wants a 2BR near IT Park, budget ₱25k/month"
        aria-label="New note"
        required
      />
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <SubmitButton pending={pending} pendingText="Adding…">
        Add note
      </SubmitButton>
    </form>
  );
}

export function DeleteNoteButton({ noteId, leadId }: { noteId: string; leadId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      className="px-2 py-0.5 text-xs text-zinc-400 hover:text-red-700"
      disabled={pending}
      onClick={() => confirm("Delete this note?") && startTransition(async () => void (await deleteLeadNote(noteId, leadId)))}
    >
      Delete
    </Button>
  );
}

export function AnalyzeLead({ leadId, currentStatus }: { leadId: string; currentStatus: LeadStatus }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<LeadAnalysis>();
  const [applied, setApplied] = useState(false);
  const suggested = result && LEAD_STATUSES.find((s) => s.value === result.suggested_status);

  return (
    <Card className="space-y-3" data-testid="ai-analysis">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">✨ AI assistant</h2>
        <Button
          type="button"
          variant="secondary"
          className="py-1"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(undefined);
              setApplied(false);
              const res = await analyzeLeadWithAi(leadId);
              if (res.ok) setResult(res.data);
              else setError(res.error);
            })
          }
        >
          {pending ? "Analyzing…" : result ? "Analyze again" : "Analyze lead"}
        </Button>
      </div>
      {!result && !error && <p className="text-sm text-zinc-600">Get a summary, how hot this lead is, and a suggested next step. Uses 1 AI generation.</p>}
      {error && <Alert tone="error">{error}</Alert>}
      {result && (
        <div className="space-y-2 text-sm">
          <p>
            <span className="font-semibold uppercase">{result.temperature}</span> · {result.summary}
          </p>
          <p>
            <span className="text-zinc-500">Next step:</span> {result.next_step}
          </p>
          {suggested && suggested.value !== currentStatus && !applied && (
            <Button
              type="button"
              variant="secondary"
              className="py-1 text-xs"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await setLeadStatus(leadId, suggested.value);
                  if (res.error) setError(res.error);
                  else setApplied(true);
                })
              }
            >
              Move to {suggested.label}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

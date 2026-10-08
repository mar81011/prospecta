"use client";

import { useState, useTransition, type RefObject } from "react";
import { Alert, Button, Select } from "@/components/ui";
import { generateListingCopy } from "../ai-actions";

const LANGUAGES = ["English", "Taglish", "Tagalog"] as const;

/** Fills the listing form's title and description with an AI draft. */
export function AiWriter({ formRef }: { formRef: RefObject<HTMLFormElement | null> }) {
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>("English");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function write() {
    const form = formRef.current;
    if (!form) return;
    setError(undefined);
    setDone(false);
    const fd = new FormData(form);
    fd.set("language", language);
    startTransition(async () => {
      const res = await generateListingCopy(fd);
      if (!res.ok) return setError(res.error);
      const title = form.elements.namedItem("title") as HTMLInputElement | null;
      const description = form.elements.namedItem("description") as HTMLTextAreaElement | null;
      if (title) title.value = res.data.title;
      if (description) description.value = res.data.description;
      setDone(true);
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-brand-100 bg-brand-50/60 p-3" data-testid="ai-writer">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-brand-700">✨ Let AI write the title and description</span>
        <Select
          aria-label="AI language"
          value={language}
          onChange={(e) => setLanguage(e.target.value as (typeof LANGUAGES)[number])}
          className="w-auto py-1"
        >
          {LANGUAGES.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </Select>
        <Button type="button" variant="secondary" className="py-1" disabled={pending} onClick={write}>
          {pending ? "Writing…" : "Write with AI"}
        </Button>
      </div>
      <p className="text-xs text-zinc-600">
        Fill in the details below first (type, price, location, rooms). Uses 1 AI generation from your plan. Review before saving.
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      {done && <Alert tone="success">Draft ready. Review and edit the title and description, then save.</Alert>}
    </div>
  );
}

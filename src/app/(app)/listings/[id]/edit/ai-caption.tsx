"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Select, Textarea } from "@/components/ui";
import { generateFacebookCaption } from "../../../ai-actions";

const LANGUAGES = ["English", "Taglish", "Tagalog"] as const;

export function AiCaption({ listingId }: { listingId: string }) {
  const [language, setLanguage] = useState<string>("Taglish");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2 border-t border-zinc-100 pt-3" data-testid="ai-caption">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">✨ AI Facebook caption</span>
        <Select aria-label="Caption language" value={language} onChange={(e) => setLanguage(e.target.value)} className="w-auto py-1">
          {LANGUAGES.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </Select>
        <Button
          type="button"
          variant="secondary"
          className="py-1"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(undefined);
              const res = await generateFacebookCaption(listingId, language);
              if (res.ok) setCaption(res.data);
              else setError(res.error);
            })
          }
        >
          {pending ? "Writing…" : caption ? "Write another" : "Write caption"}
        </Button>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {caption && (
        <>
          <Textarea aria-label="AI caption" rows={8} value={caption} onChange={(e) => setCaption(e.target.value)} />
          <Button
            type="button"
            variant="secondary"
            className="py-1"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(caption);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                window.prompt("Copy this:", caption);
              }
            }}
          >
            {copied ? "Copied ✓" : "Copy AI caption"}
          </Button>
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { deleteListing } from "./actions";

export function DeleteListingButton({ id, title }: { id: string; title: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  if (!confirming) {
    return (
      <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => setConfirming(true)}>
        Delete
      </button>
    );
  }

  return (
    <div role="alertdialog" aria-label={`Delete ${title}?`} className="text-right">
      <p className="max-w-60 text-xs text-zinc-600">
        Delete this listing and its photos for good? Leads are kept. Shared links will stop working.
      </p>
      <div className="mt-1 flex justify-end gap-3">
        <button
          type="button"
          className="text-sm text-zinc-600 hover:underline"
          disabled={pending}
          onClick={() => {
            setConfirming(false);
            setError(undefined);
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await deleteListing(id);
              setError(res.error);
            })
          }
        >
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
      </div>
      {error && <p className="mt-1 max-w-60 text-xs text-red-700">{error}</p>}
    </div>
  );
}

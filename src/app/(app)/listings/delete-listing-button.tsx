"use client";

import { useRef, useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import { deleteListing } from "./actions";

function TrashIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={className}>
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.44c-.8.08-1.59.18-2.37.3a.75.75 0 1 0 .23 1.49l.15-.02.84 10.42A2.75 2.75 0 0 0 7.59 19h4.82a2.75 2.75 0 0 0 2.74-2.62l.84-10.42.15.02a.75.75 0 0 0 .23-1.49c-.78-.12-1.57-.22-2.37-.3v-.44A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.67.03 2.5.08v-.33c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.33C8.33 4.03 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function DeleteListingButton({
  id,
  title,
  coverUrl,
  photoCount,
  leadCount,
}: {
  id: string;
  title: string;
  coverUrl?: string;
  photoCount: number;
  leadCount: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const open = () => {
    setError(undefined);
    dialogRef.current?.showModal();
  };
  const close = () => {
    if (!pending) dialogRef.current?.close();
  };

  const confirm = () =>
    startTransition(async () => {
      const res = await deleteListing(id);
      if (res.error) setError(res.error);
      else dialogRef.current?.close();
    });

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
      >
        <TrashIcon />
        Delete
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`delete-${id}-title`}
        onCancel={(e) => pending && e.preventDefault()}
        onClick={(e) => e.target === dialogRef.current && close()}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 text-left shadow-xl backdrop:bg-zinc-900/50 backdrop:backdrop-blur-[2px]"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <TrashIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id={`delete-${id}-title`} className="text-lg font-semibold text-zinc-900">
                Delete this listing?
              </h2>
              <p className="mt-1 text-sm text-zinc-600">This can&apos;t be undone.</p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Supabase public URL
              <img src={coverUrl} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-xs text-zinc-500">
                No photo
              </span>
            )}
            <p className="line-clamp-2 text-sm font-medium text-zinc-900">{title}</p>
          </div>

          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex gap-2 text-zinc-700">
              <span aria-hidden className="text-red-500">✕</span>
              The listing{photoCount > 0 && ` and its ${plural(photoCount, "photo")}`} will be permanently deleted.
            </li>
            <li className="flex gap-2 text-zinc-700">
              <span aria-hidden className="text-red-500">✕</span>
              Links you shared on Facebook will stop working.
            </li>
            <li className="flex gap-2 text-zinc-700">
              <span aria-hidden className="text-emerald-600">✓</span>
              {leadCount > 0
                ? `Your ${plural(leadCount, "lead")} from this listing will be kept.`
                : "Any leads you have are not affected."}
            </li>
          </ul>

          <p className="mt-4 text-xs text-zinc-500">
            Just taking it off the market? <strong>Archive</strong> it instead. Archived listings are hidden and don&apos;t
            count toward your plan&apos;s limit.
          </p>

          {error && (
            <div className="mt-4">
              <Alert tone="error">{error}</Alert>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 rounded-b-2xl border-t border-zinc-200 bg-zinc-50 px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={close} disabled={pending} autoFocus>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} disabled={pending}>
            {pending ? "Deleting…" : "Delete listing"}
          </Button>
        </div>
      </dialog>
    </>
  );
}

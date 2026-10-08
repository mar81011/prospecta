"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/components/ui";
import { compressImage } from "@/lib/compress-image";
import { MAX_LISTING_PHOTOS } from "@/lib/listings";
import { deleteListingPhoto, makeCoverPhoto, uploadListingPhotos } from "../../actions";

type Photo = { id: string; url: string };

export function PhotoManager({ listingId, photos }: { listingId: string; photos: Photo[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string>();
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const remaining = MAX_LISTING_PHOTOS - photos.length;

  async function upload(files: FileList) {
    setError(undefined);
    setMessage(undefined);
    const list = Array.from(files);
    if (list.length > remaining) {
      setError(`You can add ${remaining} more photo${remaining === 1 ? "" : "s"} (max ${MAX_LISTING_PHOTOS}).`);
      return;
    }
    let added = 0;
    for (const [i, file] of list.entries()) {
      setProgress(`Uploading ${i + 1} of ${list.length}…`);
      const fd = new FormData();
      fd.append("photos", await compressImage(file));
      const res = await uploadListingPhotos(listingId, {}, fd);
      if (res.error) {
        setError(res.error);
        break;
      }
      added++;
    }
    setProgress(undefined);
    if (added) setMessage(`${added} photo${added === 1 ? "" : "s"} added.`);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  const act = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      setError(res.error);
      router.refresh();
    });

  return (
    <Card id="photos" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Photos</h2>
          <p className="text-sm text-zinc-600">
            The cover photo appears in the Facebook preview. {photos.length}/{MAX_LISTING_PHOTOS} used.
          </p>
        </div>
        {remaining > 0 && (
          <label className="inline-flex cursor-pointer items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            {progress ?? "Add photos"}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              aria-label="Add photos"
              disabled={Boolean(progress)}
              onChange={(e) => e.target.files?.length && upload(e.target.files)}
            />
          </label>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}

      {photos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
          No photos yet. Listings with photos get far more inquiries.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p, i) => (
            <li key={p.id} className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50" data-testid="listing-photo">
              {/* eslint-disable-next-line @next/next/no-img-element -- Supabase public URL, sized by CSS */}
              <img src={p.url} alt={`Photo ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
              <div className="flex items-center justify-between gap-1 p-2 text-xs">
                {i === 0 ? (
                  <span className="font-semibold text-brand-700">Cover</span>
                ) : (
                  <Button variant="ghost" className="px-2 py-1 text-xs" disabled={pending} onClick={() => act(() => makeCoverPhoto(p.id))}>
                    Make cover
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="px-2 py-1 text-xs text-red-700"
                  disabled={pending}
                  onClick={() => confirm("Delete this photo?") && act(() => deleteListingPhoto(p.id))}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";
import { compressImage } from "@/lib/compress-image";
import { removeAgentPhoto, uploadAgentPhoto } from "./actions";

export function PhotoForm({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ error?: string; message?: string }>({});
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("photo", await compressImage(file, 800));
      setState(await uploadAgentPhoto({}, fd));
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      setState(await removeAgentPhoto());
      router.refresh();
    });
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Supabase public URL
          <img src={photoUrl} alt="Your profile photo" className="h-20 w-20 rounded-full object-cover ring-1 ring-zinc-200" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 text-xl font-semibold text-zinc-500">
            {initials || "?"}
          </span>
        )}
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
            {pending ? "Saving…" : photoUrl ? "Change photo" : "Upload photo"}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Upload profile photo"
              disabled={pending}
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </label>
          {photoUrl && (
            <Button variant="secondary" onClick={remove} disabled={pending}>
              Remove
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        Shown to buyers on your public listing pages. A clear, friendly headshot builds trust. JPG, PNG or WebP.
      </p>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.message && <Alert tone="success">{state.message}</Alert>}
    </div>
  );
}

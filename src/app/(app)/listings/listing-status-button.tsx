"use client";

import { useState, useTransition } from "react";
import { setListingStatus } from "./actions";

export function ListingStatusButton({ id, status }: { id: string; status: "active" | "archived" }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const next = status === "active" ? "archived" : "active";

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        className="text-sm text-brand-600 hover:underline disabled:opacity-50"
        onClick={() =>
          startTransition(async () => {
            const res = await setListingStatus(id, next);
            setError(res.error);
          })
        }
      >
        {status === "active" ? "Archive" : "Reactivate"}
      </button>
      {error && <p className="mt-1 max-w-56 text-xs text-red-700">{error}</p>}
    </div>
  );
}

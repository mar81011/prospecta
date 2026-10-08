"use client";

import { useState } from "react";
import { cx } from "@/components/ui";

/**
 * Share a listing: Facebook share dialog, copy link, and copy a ready-made
 * caption (Facebook doesn't let websites pre-fill the post text).
 */
export function ShareButtons({
  shareUrl,
  publicUrl,
  caption,
  compact = false,
}: {
  shareUrl: string;
  publicUrl: string;
  caption: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState<"link" | "caption">();

  async function copy(text: string, what: "link" | "caption") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(undefined), 2000);
    } catch {
      window.prompt("Copy this:", text);
    }
  }

  const btn = cx(
    "inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white font-medium text-zinc-800 hover:bg-zinc-50",
    compact ? "px-2.5 py-1 text-xs" : "px-3 py-2 text-sm",
  );

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={shareUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.preventDefault();
          window.open(shareUrl, "fb-share", "width=640,height=640,noopener");
        }}
        className={cx(btn, "border-[#1877F2] bg-[#1877F2] text-white hover:bg-[#166FE5]")}
      >
        <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 fill-current">
          <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07" />
        </svg>
        Share to Facebook
      </a>
      <button type="button" className={btn} onClick={() => copy(caption, "caption")}>
        {copied === "caption" ? "Caption copied ✓" : "Copy caption"}
      </button>
      <button type="button" className={btn} onClick={() => copy(publicUrl, "link")}>
        {copied === "link" ? "Link copied ✓" : "Copy link"}
      </button>
    </div>
  );
}

import { cx } from "@/components/ui";

export function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit === null ? 0 : limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
  const tone = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-brand-500";
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-zinc-700">{label}</span>
        <span className="font-medium tabular-nums">
          {used.toLocaleString()}
          {limit === null ? <span className="text-zinc-500"> · fair use</span> : ` / ${limit.toLocaleString()}`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
        {limit !== null && <div className={cx("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />}
      </div>
    </div>
  );
}

"use client";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, size = "md" }: ScoreBadgeProps) {
  const color =
    score >= 60 ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : score >= 40 ? "bg-amber-50 text-amber-700 ring-amber-200"
    : "bg-red-50 text-red-700 ring-red-200";

  const dot =
    score >= 60 ? "bg-emerald-500"
    : score >= 40 ? "bg-amber-500"
    : "bg-red-500";

  const sizeClass = size === "sm" ? "text-xs px-1.5 py-0.5" : size === "lg" ? "text-base px-3 py-1.5" : "text-sm px-2 py-1";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full ring-1 font-semibold tabular-nums ${color} ${sizeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {score.toFixed(1)}
    </span>
  );
}

interface ValueBadgeProps {
  isValuePlay: boolean;
}

export function ValueBadge({ isValuePlay }: ValueBadgeProps) {
  if (!isValuePlay) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 text-xs px-2 py-0.5 font-semibold whitespace-nowrap">
      Value
    </span>
  );
}

interface DayChangeBadgeProps {
  value?: number | null;
}

export function DayChangeBadge({ value }: DayChangeBadgeProps) {
  if (value == null) return <span className="text-slate-400 text-sm">—</span>;
  const isPos = value >= 0;
  const cls = isPos ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50";
  return (
    <span className={`inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums px-2 py-0.5 rounded-md ${cls}`}>
      {isPos ? "▲" : "▼"} {isPos ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

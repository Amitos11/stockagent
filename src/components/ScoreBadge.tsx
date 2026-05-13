"use client";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, size = "md" }: ScoreBadgeProps) {
  const cls =
    score >= 70 ? "badge-strong"
    : score >= 55 ? "badge-good"
    : score >= 35 ? "badge-fair"
    : "badge-weak";

  const dotColor =
    score >= 70 ? "#10b981"
    : score >= 55 ? "#6366f1"
    : score >= 35 ? "#f59e0b"
    : "#f43f5e";

  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : size === "lg" ? "text-base px-3 py-1.5" : "text-sm px-2.5 py-1";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold tabular-nums ${cls} ${sizeClass}`}>
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: dotColor, boxShadow: `0 0 5px ${dotColor}` }}
      />
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
    <span className="inline-flex items-center gap-1 rounded-full badge-fair text-xs px-2 py-0.5 font-semibold whitespace-nowrap">
      ✦ Value
    </span>
  );
}

interface DayChangeBadgeProps {
  value?: number | null;
}

export function DayChangeBadge({ value }: DayChangeBadgeProps) {
  if (value == null) return <span className="text-sm" style={{ color: "rgba(148,163,184,0.4)" }}>—</span>;
  const isPos = value >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-sm font-bold tabular-nums px-2 py-0.5 rounded-lg"
      style={{
        color: isPos ? "#34d399" : "#fb7185",
        background: isPos ? "rgba(16,185,129,0.12)" : "rgba(244,63,94,0.12)",
        border: `1px solid ${isPos ? "rgba(16,185,129,0.25)" : "rgba(244,63,94,0.25)"}`,
      }}
    >
      {isPos ? "▲" : "▼"} {isPos ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

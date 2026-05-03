"use client";

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "default" | "gold" | "green" | "red" | "purple";
  icon?: React.ReactNode;
}

const accentMap = {
  default: "border-l-slate-400",
  gold: "border-l-amber-400",
  green: "border-l-emerald-400",
  red: "border-l-red-400",
  purple: "border-l-violet-400",
};

const valueAccentMap = {
  default: "text-slate-900",
  gold: "text-amber-600",
  green: "text-emerald-600",
  red: "text-red-600",
  purple: "text-violet-600",
};

export function MetricCard({ label, value, sub, accent = "default", icon }: MetricCardProps) {
  return (
    <div
      className={`
        bg-white rounded-xl border border-slate-100 shadow-sm
        border-l-4 ${accentMap[accent]}
        p-5 flex flex-col gap-1 min-w-0
      `}
    >
      <div className="flex items-center gap-2">
        {icon && <span className="text-slate-400 flex-shrink-0">{icon}</span>}
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">{label}</span>
      </div>
      <div className={`text-2xl font-bold tabular-nums ${valueAccentMap[accent]} truncate`}>
        {value}
      </div>
      {sub && <div className="text-xs text-slate-400 truncate">{sub}</div>}
    </div>
  );
}

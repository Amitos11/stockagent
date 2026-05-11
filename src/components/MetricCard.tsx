"use client";

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "default" | "gold" | "green" | "red" | "purple";
  icon?: React.ReactNode;
}

const topBarMap = {
  default: "linear-gradient(90deg,#94a3b8,#cbd5e1)",
  gold:    "linear-gradient(90deg,#f59e0b,#fbbf24)",
  green:   "linear-gradient(90deg,#16a34a,#4ade80)",
  red:     "linear-gradient(90deg,#dc2626,#f87171)",
  purple:  "linear-gradient(90deg,#7c3aed,#a78bfa)",
};

const valueColorMap = {
  default: "#0f172a",
  gold:    "#b45309",
  green:   "#15803d",
  red:     "#dc2626",
  purple:  "#6d28d9",
};

const iconBgMap = {
  default: "#f1f5f9",
  gold:    "#fef3c7",
  green:   "#dcfce7",
  red:     "#fee2e2",
  purple:  "#ede9fe",
};

const iconColorMap = {
  default: "#64748b",
  gold:    "#d97706",
  green:   "#16a34a",
  red:     "#dc2626",
  purple:  "#7c3aed",
};

export function MetricCard({ label, value, sub, accent = "default", icon }: MetricCardProps) {
  return (
    <div className="card-float rounded-2xl p-5 flex flex-col gap-2 min-w-0 relative overflow-hidden">
      {/* Top gradient accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
        style={{ background: topBarMap[accent] }} />

      <div className="flex items-center gap-2 mt-1">
        {icon && (
          <span className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: iconBgMap[accent], color: iconColorMap[accent] }}>
            {icon}
          </span>
        )}
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold tabular-nums truncate"
        style={{ color: valueColorMap[accent], fontFamily: "IBM Plex Mono, monospace" }}>
        {value}
      </div>
      {sub && <div className="text-xs text-slate-400 truncate">{sub}</div>}
    </div>
  );
}

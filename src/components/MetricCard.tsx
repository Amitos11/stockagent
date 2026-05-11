"use client";

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "default" | "gold" | "green" | "red" | "purple";
  icon?: React.ReactNode;
}

const glowMap = {
  default: "",
  gold:    "0 0 20px rgba(245,158,11,0.15)",
  green:   "0 0 20px rgba(34,197,94,0.15)",
  red:     "0 0 20px rgba(239,68,68,0.15)",
  purple:  "0 0 20px rgba(139,92,246,0.15)",
};

const borderMap = {
  default: "rgba(255,255,255,0.07)",
  gold:    "rgba(245,158,11,0.25)",
  green:   "rgba(34,197,94,0.25)",
  red:     "rgba(239,68,68,0.25)",
  purple:  "rgba(139,92,246,0.25)",
};

const iconBgMap = {
  default: "rgba(255,255,255,0.06)",
  gold:    "rgba(245,158,11,0.12)",
  green:   "rgba(34,197,94,0.12)",
  red:     "rgba(239,68,68,0.12)",
  purple:  "rgba(139,92,246,0.12)",
};

const iconColorMap = {
  default: "#64748b",
  gold:    "#f59e0b",
  green:   "#22c55e",
  red:     "#ef4444",
  purple:  "#8b5cf6",
};

const valueColorMap = {
  default: "#f8fafc",
  gold:    "#fbbf24",
  green:   "#4ade80",
  red:     "#f87171",
  purple:  "#a78bfa",
};

export function MetricCard({ label, value, sub, accent = "default", icon }: MetricCardProps) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-2 min-w-0 transition-all duration-200"
      style={{
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${borderMap[accent]}`,
        boxShadow: glowMap[accent],
      }}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span
            className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: iconBgMap[accent], color: iconColorMap[accent] }}
          >
            {icon}
          </span>
        )}
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">
          {label}
        </span>
      </div>
      <div
        className="text-2xl font-bold tabular-nums truncate"
        style={{ color: valueColorMap[accent], fontFamily: "IBM Plex Mono, monospace" }}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-slate-600 truncate">{sub}</div>}
    </div>
  );
}

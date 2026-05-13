"use client";

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "default" | "gold" | "green" | "red" | "purple" | "cyan";
  icon?: React.ReactNode;
}

const accentGlow: Record<string, string> = {
  default:  "rgba(148,163,184,0.2)",
  gold:     "rgba(245,158,11,0.25)",
  green:    "rgba(16,185,129,0.25)",
  red:      "rgba(244,63,94,0.25)",
  purple:   "rgba(99,102,241,0.25)",
  cyan:     "rgba(34,211,238,0.25)",
};

const accentBorder: Record<string, string> = {
  default:  "rgba(148,163,184,0.3)",
  gold:     "rgba(245,158,11,0.4)",
  green:    "rgba(16,185,129,0.4)",
  red:      "rgba(244,63,94,0.4)",
  purple:   "rgba(99,102,241,0.4)",
  cyan:     "rgba(34,211,238,0.4)",
};

const valueColor: Record<string, string> = {
  default:  "#f1f5f9",
  gold:     "#fbbf24",
  green:    "#34d399",
  red:      "#fb7185",
  purple:   "#818cf8",
  cyan:     "#67e8f9",
};

const iconBg: Record<string, string> = {
  default:  "rgba(148,163,184,0.1)",
  gold:     "rgba(245,158,11,0.12)",
  green:    "rgba(16,185,129,0.12)",
  red:      "rgba(244,63,94,0.12)",
  purple:   "rgba(99,102,241,0.12)",
  cyan:     "rgba(34,211,238,0.12)",
};

export function MetricCard({ label, value, sub, accent = "default", icon }: MetricCardProps) {
  return (
    <div
      className="glass rounded-2xl p-5 flex flex-col gap-2 min-w-0 depth-2 glass-hover relative overflow-hidden"
      style={{
        borderColor: accentBorder[accent],
        boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px ${accentBorder[accent]}, inset 0 1px 0 rgba(255,255,255,0.06)`,
      }}
    >
      <div className="flex items-center gap-2.5">
        {icon && (
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: iconBg[accent] }}
          >
            <span style={{ color: valueColor[accent] }}>{icon}</span>
          </div>
        )}
        <span className="text-xs font-semibold uppercase tracking-widest truncate"
          style={{ color: "rgba(148,163,184,0.7)" }}>
          {label}
        </span>
      </div>

      <div
        className="text-2xl font-bold tabular-nums metric-value truncate"
        style={{ color: valueColor[accent] }}
      >
        {value}
      </div>

      {sub && (
        <div className="text-xs truncate" style={{ color: "rgba(148,163,184,0.6)" }}>
          {sub}
        </div>
      )}

      {/* bottom accent line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl"
        style={{ background: `linear-gradient(90deg, transparent, ${accentGlow[accent]}, transparent)` }}
      />
    </div>
  );
}

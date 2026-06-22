"use client";

import { useRef, useEffect, useState } from "react";
import type { StockRow } from "@/lib/types";
import { riskFlags, healthTier } from "@/lib/signals";
import type { RiskFlag, HealthTier } from "@/lib/signals";
import { SECTOR_COLORS } from "@/lib/signals";

/* ── Tilt glass card ─────────────────────────────────────────────────────── */
interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  onClick?: () => void;
}
export function TiltCard({ children, className = "", style, disabled, onClick }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-py * 4).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg) translateY(-2px)`;
    el.style.setProperty("--mx", px * 100 + 50 + "%");
    el.style.setProperty("--my", py * 100 + 50 + "%");
  };
  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "";
  };

  return (
    <div
      ref={ref}
      className={`glass tilt-card ${className}`}
      style={style}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
    >
      <div className="tilt-sheen" aria-hidden="true" />
      {children}
    </div>
  );
}

/* ── Sector chip ─────────────────────────────────────────────────────────── */
export function SectorChip({ sector }: { sector?: string }) {
  const c = SECTOR_COLORS[sector ?? ""] ?? "#94a3b8";
  return (
    <span
      className="sector-chip"
      style={{ color: c, borderColor: c + "44", background: c + "14" }}
    >
      {sector ?? "—"}
    </span>
  );
}

/* ── Score pill ──────────────────────────────────────────────────────────── */
export function ScorePill({ score }: { score: number }) {
  const c = score >= 75 ? "#34d399" : score >= 55 ? "#22d3ee" : score >= 40 ? "#fbbf24" : "#f87171";
  return (
    <span
      className="score-pill"
      style={{ color: c, background: c + "1a", boxShadow: `0 0 14px ${c}33, inset 0 0 0 1px ${c}40` }}
    >
      {Math.round(score)}
    </span>
  );
}

/* ── Score bar ───────────────────────────────────────────────────────────── */
export function ScoreBar({ score }: { score: number }) {
  const c = score >= 75 ? "#34d399" : score >= 55 ? "#22d3ee" : score >= 40 ? "#fbbf24" : "#f87171";
  return (
    <span className="score-bar-track">
      <span
        className="score-bar-fill"
        style={{
          width: Math.round(score) + "%",
          background: `linear-gradient(90deg, ${c}66, ${c})`,
          boxShadow: `0 0 8px ${c}55`,
        }}
      />
    </span>
  );
}

/* ── Day change ──────────────────────────────────────────────────────────── */
export function DayChange({ value }: { value?: number | null }) {
  if (value == null) return <span className="num dim">—</span>;
  const up = value >= 0;
  return (
    <span className={`num daychange ${up ? "pos" : "neg"}`}>
      <svg
        width="8"
        height="8"
        viewBox="0 0 8 8"
        style={{ transform: up ? "none" : "rotate(180deg)" }}
      >
        <path d="M4 1l3 5H1z" fill="currentColor" />
      </svg>
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

/* ── Count-up number ─────────────────────────────────────────────────────── */
export function CountUp({ value, decimals = 0, duration = 700 }: { value: number; decimals?: number; duration?: number }) {
  const [disp, setDisp] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) return;
    let raf: number;
    let t0: number | null = null;
    const step = (t: number) => {
      if (!t0) t0 = t;
      const k = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setDisp(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span>{disp.toFixed(decimals)}</span>;
}

/* ── Watch star ──────────────────────────────────────────────────────────── */
export function WatchStar({ on, onToggle, size = 15 }: { on: boolean; onToggle: () => void; size?: number }) {
  return (
    <button
      className={`watch-star${on ? " on" : ""}`}
      aria-pressed={on}
      aria-label={on ? "Remove from watchlist" : "Add to watchlist"}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={on ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      >
        <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z" />
      </svg>
    </button>
  );
}

/* ── Trend arrow — Feature 2 deferred, always shows "—" ─────────────────── */
export function TrendArrow() {
  return <span className="trend-arrow num dim">—</span>;
}

/* ── Risk badge with hover popover ──────────────────────────────────────── */
export function RiskBadge({
  stock,
  sectorPEMap,
  compact = false,
}: {
  stock: StockRow;
  sectorPEMap: Record<string, number>;
  compact?: boolean;
}) {
  const flags: RiskFlag[] = riskFlags(stock, sectorPEMap);
  if (!flags.length) return compact ? null : <span className="risk-none">—</span>;
  const sev = Math.max(...flags.map((f) => f.sev)) as 1 | 2;
  const c = sev === 2 ? "#f87171" : "#fbbf24";
  return (
    <span
      className="risk-badge"
      style={{ color: c, borderColor: c + "45", background: c + "12" }}
      tabIndex={0}
      aria-label={`${flags.length} risk flags`}
    >
      <svg width="9" height="11" viewBox="0 0 9 11" fill="currentColor">
        <path d="M0.5 0.5h1v10h-1zM2 1h6.5l-1.8 2.2L8.5 5.5H2z" />
      </svg>
      {flags.length}
      <span className="risk-pop glass depth-3" role="tooltip">
        <span className="risk-pop-title">Exit watch · {flags.length} flag{flags.length > 1 ? "s" : ""}</span>
        {flags.map((f) => (
          <span key={f.label} className="risk-pop-row">
            <span className="risk-dot" style={{ background: f.sev === 2 ? "#f87171" : "#fbbf24" }} />
            <span>
              <b>{f.label}</b>
              <br />
              <span className="risk-pop-detail num">{f.detail}</span>
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}

/* ── Financial-health rating dot (green/amber/red) ───────────────────────── */
export function HealthDot({ stock, showLabel = false }: { stock: StockRow; showLabel?: boolean }) {
  const tier: HealthTier = healthTier(stock);
  if (tier.level === "unknown" && !showLabel) return null;
  return (
    <span
      className="health-dot-wrap"
      title={`Financial health: ${tier.label}${tier.detail ? ` — ${tier.detail}` : ""}`}
    >
      <span className="health-dot" style={{ background: tier.color, boxShadow: `0 0 6px ${tier.color}` }} />
      {showLabel ? <span className="health-label num" style={{ color: tier.color }}>{tier.label}</span> : null}
    </span>
  );
}

"use client";

import type { ScanWeights } from "@/lib/types";
import { TiltCard } from "./primitives";

const WEIGHT_META = [
  { key: "growth" as const,       label: "Growth",       color: "#22d3ee", hint: "Revenue + EPS momentum" },
  { key: "profitability" as const, label: "Profitability", color: "#a78bfa", hint: "Margins, ROE" },
  { key: "valuation" as const,    label: "Valuation",    color: "#fbbf24", hint: "P/E vs. peers" },
];

interface SliderProps {
  meta: typeof WEIGHT_META[number];
  value: number;
  onChange: (v: number) => void;
}

function WeightSlider({ meta, value, onChange }: SliderProps) {
  return (
    <div className="weight-row">
      <div className="weight-head">
        <span className="weight-label">
          <span className="weight-dot" style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }} />
          {meta.label}
        </span>
        <span className="weight-val num" style={{ color: meta.color }}>{value}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        value={value}
        aria-label={`${meta.label} weight`}
        style={{ "--wc": meta.color, "--wp": value + "%" } as React.CSSProperties}
        onChange={(e) => onChange(+e.target.value)}
      />
      <p className="weight-hint">{meta.hint}</p>
    </div>
  );
}

interface Props {
  weights: ScanWeights;
  setWeights: (w: ScanWeights) => void;
  buffett: boolean;
  setBuffett: (v: boolean) => void;
  search: string;
  setSearch: (v: string) => void;
  tilt?: boolean;
  onAnalyze?: (symbol: string) => void;
  analyzing?: boolean;
  analyzeError?: string;
  hasExactMatch?: boolean;
}

export function ControlsPanel({
  weights, setWeights, buffett, setBuffett, search, setSearch, tilt,
  onAnalyze, analyzing, analyzeError, hasExactMatch,
}: Props) {
  const change = (key: keyof ScanWeights, val: number) => {
    const others = WEIGHT_META.map((m) => m.key).filter((k) => k !== key) as [keyof ScanWeights, keyof ScanWeights];
    const rest = 100 - val;
    const sumOthers = weights[others[0]] + weights[others[1]];
    let a: number, b: number;
    if (sumOthers === 0) {
      a = Math.round(rest / 2 / 5) * 5;
      b = rest - a;
    } else {
      a = Math.round((weights[others[0]] / sumOthers) * rest / 5) * 5;
      b = rest - a;
    }
    setWeights({ ...weights, [key]: val, [others[0]]: a, [others[1]]: b });
  };

  return (
    <TiltCard className="controls depth-2" disabled={!tilt}>
      <div className="controls-head">
        <h2 className="panel-title">Scoring weights</h2>
        <button
          className={`buffett-badge${buffett ? " on" : ""}`}
          onClick={() => setBuffett(!buffett)}
          aria-pressed={buffett}
          title="Only keep stocks with P/E under 20 and D/E under 50%"
        >
          <span className="buffett-ring" aria-hidden="true">฿</span>
          Buffett Filter
          <span className="buffett-rule num">P/E&lt;20 · D/E&lt;50</span>
        </button>
      </div>
      <div className="weights">
        {WEIGHT_META.map((m) => (
          <WeightSlider key={m.key} meta={m} value={weights[m.key]} onChange={(v) => change(m.key, v)} />
        ))}
      </div>
      <div className="weight-sum" aria-hidden="true">
        {WEIGHT_META.map((m) => (
          <span key={m.key} style={{ width: weights[m.key] + "%", background: m.color }} />
        ))}
      </div>
      <label className="search-wrap">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
        <input
          className="search-input"
          placeholder="Filter, or type any ticker to analyze — e.g. NVDA, Teva…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && search.trim() && onAnalyze && !analyzing) {
              onAnalyze(search.trim().toUpperCase());
            }
          }}
        />
        {search.trim() && onAnalyze ? (
          <button
            type="button"
            className="analyze-btn"
            disabled={analyzing}
            onClick={() => onAnalyze(search.trim().toUpperCase())}
          >
            {analyzing
              ? "Analyzing…"
              : `${hasExactMatch ? "Re-analyze" : "Analyze"} ${search.trim().toUpperCase()} →`}
          </button>
        ) : null}
      </label>
      {analyzeError ? <p className="analyze-error">{analyzeError}</p> : null}
    </TiltCard>
  );
}

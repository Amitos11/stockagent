"use client";

import { useMemo } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { StockRow } from "@/lib/types";
import { getSector, SECTOR_META } from "@/lib/tickers";

interface Props {
  rows: StockRow[];
  onSelect?: (row: StockRow) => void;
}

interface BubblePoint {
  x: number;   // PE ratio (capped)
  y: number;   // EPS growth % (capped)
  z: number;   // market cap → bubble size
  score: number;
  symbol: string;
  name: string;
  sector: string;
  color: string;
  row: StockRow;
}

function scoreColor(score: number): string {
  if (score >= 70) return "#10b981";
  if (score >= 55) return "#6366f1";
  if (score >= 40) return "#f59e0b";
  return "#f43f5e";
}

const BubbleTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: BubblePoint }[] }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const meta = SECTOR_META[getSector(d.symbol)];
  return (
    <div className="glass rounded-xl p-3 text-xs space-y-1.5 min-w-[180px] pointer-events-none">
      <div className="flex items-center gap-2">
        <span className="font-bold text-sm text-slate-100">{d.symbol}</span>
        <span className="px-1.5 py-0.5 rounded text-xs border" style={{ color: meta.color, borderColor: `${meta.color}40`, background: `${meta.color}15` }}>
          {meta.label}
        </span>
      </div>
      <div className="text-slate-400 text-xs truncate">{d.name}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
        <div className="text-slate-400">Score</div>
        <div className="font-mono font-semibold" style={{ color: scoreColor(d.score) }}>{d.score.toFixed(1)}</div>
        <div className="text-slate-400">P/E</div>
        <div className="font-mono text-slate-200">{d.x > 0 ? d.x.toFixed(1) : "N/A"}</div>
        <div className="text-slate-400">EPS YoY</div>
        <div className="font-mono" style={{ color: d.y >= 0 ? "#34d399" : "#fb7185" }}>
          {d.y > 0 ? "+" : ""}{d.y.toFixed(0)}%
        </div>
      </div>
    </div>
  );
};

export function MarketHeatmap({ rows, onSelect }: Props) {
  const points = useMemo<BubblePoint[]>(() => {
    return rows
      .filter((r) => r.peRatio != null && r.peRatio > 0 && r.earningsGrowth != null && r.score != null)
      .map((r) => {
        const sectorKey = getSector(r.symbol);
        return {
          x: Math.min(r.peRatio!, 80),
          y: Math.min(Math.max((r.earningsGrowth ?? 0) * 100, -60), 120),
          z: Math.min(Math.log10((r.marketCap ?? 1e9) / 1e6) * 8, 60),
          score: r.score!,
          symbol: r.symbol,
          name: r.name ?? r.symbol,
          sector: sectorKey,
          color: SECTOR_META[sectorKey].color,
          row: r,
        };
      });
  }, [rows]);

  if (points.length < 4) return null;

  return (
    <div className="glass rounded-2xl p-5 depth-2 fade-in-up">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-100 text-sm">Valuation vs. Growth Map</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          P/E ratio × EPS growth — bubble size = market cap · color = score
        </p>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <XAxis
            type="number" dataKey="x" name="P/E"
            domain={[0, 80]} tickCount={6}
            tick={{ fill: "#475569", fontSize: 11 }}
            axisLine={{ stroke: "#1e2d4d" }}
            tickLine={false}
            label={{ value: "P/E Ratio →", position: "insideBottom", offset: -12, fill: "#475569", fontSize: 11 }}
          />
          <YAxis
            type="number" dataKey="y" name="EPS Growth"
            domain={[-60, 120]} tickCount={7}
            tick={{ fill: "#475569", fontSize: 11 }}
            axisLine={{ stroke: "#1e2d4d" }}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <ZAxis type="number" dataKey="z" range={[30, 400]} />
          <ReferenceLine y={0} stroke="#1e2d4d" strokeDasharray="4 3" />
          <ReferenceLine x={20} stroke="#1e2d4d" strokeDasharray="4 3" />
          <Tooltip content={<BubbleTooltip />} cursor={false} />
          <Scatter
            data={points}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            shape={(props: any) => {
              const { cx = 0, cy = 0, r = 6, payload } = props as { cx: number; cy: number; r: number; payload: BubblePoint };
              if (!payload) return <g />;
              const color = scoreColor(payload.score);
              return (
                <g
                  onClick={() => onSelect?.(payload.row)}
                  style={{ cursor: onSelect ? "pointer" : "default" }}
                >
                  {/* Outer glow ring */}
                  <circle cx={cx} cy={cy} r={r + 4} fill={color} fillOpacity={0.08} />
                  {/* Bubble */}
                  <circle
                    cx={cx} cy={cy} r={r}
                    fill={color} fillOpacity={0.75}
                    stroke={color} strokeWidth={1.5} strokeOpacity={0.9}
                    style={{ filter: `drop-shadow(0 0 ${Math.max(4, r / 2)}px ${color}60)` }}
                  />
                  {/* 3D highlight */}
                  <circle
                    cx={cx - r * 0.25} cy={cy - r * 0.25}
                    r={r * 0.35}
                    fill="white" fillOpacity={0.15}
                  />
                  {/* Label for larger bubbles */}
                  {r > 12 && (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                      fill="rgba(255,255,255,0.9)" fontSize={Math.min(11, r * 0.6)} fontWeight={700}>
                      {payload.symbol}
                    </text>
                  )}
                </g>
              );
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-2 justify-end flex-wrap">
        {[
          { label: "Strong ≥70", color: "#10b981" },
          { label: "Good ≥55",   color: "#6366f1" },
          { label: "Fair ≥40",   color: "#f59e0b" },
          { label: "Weak",       color: "#f43f5e" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-slate-400">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}80` }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

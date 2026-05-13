"use client";

import { useMemo, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  Treemap, Legend,
} from "recharts";
import type { StockRow } from "@/lib/types";
import { getSector, SECTOR_META, SECTOR_ORDER, type SectorKey } from "@/lib/tickers";
import { LayoutGrid, PieChart as PieIcon } from "lucide-react";

interface Props {
  rows: StockRow[];
}

interface SectorDatum {
  key: SectorKey;
  label: string;
  color: string;
  count: number;
  avgScore: number;
  totalMarketCap: number;
  symbols: string[];
}

function buildSectorData(rows: StockRow[]): SectorDatum[] {
  const map = new Map<SectorKey, StockRow[]>();
  for (const row of rows) {
    const k = getSector(row.symbol);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(row);
  }

  return SECTOR_ORDER
    .filter((k) => map.has(k))
    .map((k) => {
      const items = map.get(k)!;
      const meta = SECTOR_META[k];
      const scored = items.filter((r) => r.score != null);
      return {
        key: k,
        label: meta.label,
        color: meta.color,
        count: items.length,
        avgScore: scored.length
          ? scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length
          : 0,
        totalMarketCap: items.reduce((s, r) => s + (r.marketCap ?? 0), 0),
        symbols: items.map((r) => r.symbol),
      };
    })
    .filter((d) => d.count > 0);
}

const CustomDonutLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, value }: Record<string, number> & { name: string }) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (value < 2) return null;
  return (
    <text x={x} y={y} fill="rgba(255,255,255,0.85)" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {value}
    </text>
  );
};

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: SectorDatum }[] }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="glass rounded-xl p-3 text-xs space-y-1 min-w-[160px]">
      <div className="font-semibold text-sm" style={{ color: d.color }}>{d.label}</div>
      <div className="flex justify-between gap-4 text-slate-300">
        <span>Tickers</span><span className="font-mono">{d.count}</span>
      </div>
      <div className="flex justify-between gap-4 text-slate-300">
        <span>Avg Score</span>
        <span className="font-mono" style={{ color: d.avgScore >= 60 ? "#34d399" : d.avgScore >= 40 ? "#818cf8" : "#94a3b8" }}>
          {d.avgScore.toFixed(1)}
        </span>
      </div>
    </div>
  );
};

const TreemapContent = ({ x, y, width, height, name, value, fill }: Record<string, number> & { name: string; fill: string }) => {
  if (width < 30 || height < 20) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={0.85} rx={6} ry={6}
        style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))" }}
      />
      <rect x={x} y={y} width={width} height={2} fill={fill} fillOpacity={1} rx={1} />
      {height > 30 && (
        <>
          <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="rgba(255,255,255,0.9)"
            fontSize={Math.min(13, width / 5)} fontWeight={700} dominantBaseline="middle">
            {width > 50 ? name : name.slice(0, 4)}
          </text>
          <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.55)"
            fontSize={Math.min(11, width / 6)} dominantBaseline="middle">
            {value}
          </text>
        </>
      )}
    </g>
  );
};

type ChartMode = "donut" | "treemap";

export function SectorChart({ rows }: Props) {
  const [mode, setMode] = useState<ChartMode>("donut");
  const data = useMemo(() => buildSectorData(rows), [rows]);

  if (data.length === 0) return null;

  const treemapData = data.map((d) => ({
    name: d.label,
    size: d.count,
    fill: d.color,
    avgScore: d.avgScore,
  }));

  return (
    <div className="glass rounded-2xl p-5 depth-2 fade-in-up">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-slate-100 text-sm">Sector Breakdown</h3>
          <p className="text-xs text-slate-500 mt-0.5">{rows.length} stocks across {data.length} sectors</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-900/60 rounded-lg p-1 border border-white/5">
          <button
            onClick={() => setMode("donut")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${mode === "donut" ? "tab-active" : "tab-inactive"}`}
          >
            <PieIcon size={12} /> Donut
          </button>
          <button
            onClick={() => setMode("treemap")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${mode === "treemap" ? "tab-active" : "tab-inactive"}`}
          >
            <LayoutGrid size={12} /> Treemap
          </button>
        </div>
      </div>

      {mode === "donut" && (
        <div className="flex items-center gap-6">
          <div className="flex-shrink-0" style={{ width: 200, height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={90}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="label"
                  labelLine={false}
                  label={CustomDonutLabel as never}
                >
                  {data.map((d) => (
                    <Cell key={d.key} fill={d.color} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-1.5">
            {data.map((d) => (
              <div key={d.key} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/3 border border-white/5 hover:bg-white/5 transition-all">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color, boxShadow: `0 0 6px ${d.color}80` }} />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">{d.label}</div>
                  <div className="text-xs text-slate-500">{d.count} · avg {d.avgScore.toFixed(0)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === "treemap" && (
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={treemapData}
              dataKey="size"
              nameKey="name"
              content={TreemapContent as never}
              isAnimationActive={false}
            >
              <Tooltip content={<CustomTooltip />} />
            </Treemap>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

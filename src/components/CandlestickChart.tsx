"use client";

import { useEffect, useRef } from "react";
import type { CandleData } from "@/lib/types";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyChart = any;

interface CandlestickChartProps {
  symbol: string;
  data: CandleData[];
}

export function CandlestickChart({ symbol, data }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !data.length) return;

    let chart: AnyChart = null;
    let ro: ResizeObserver | null = null;

    (async () => {
      const lw = await import("lightweight-charts");

      if (!containerRef.current) return;
      const el = containerRef.current;
      const width = el.clientWidth || el.getBoundingClientRect().width || 600;

      chart = lw.createChart(el, {
        width,
        height: 320,
        layout: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          background: { type: "solid" as any, color: "#0d1117" },
          textColor: "#94a3b8",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "rgba(99,102,241,0.06)" },
          horzLines: { color: "rgba(99,102,241,0.06)" },
        },
        crosshair: {
          vertLine: { color: "rgba(99,102,241,0.5)", width: 1, style: 1 },
          horzLine: { color: "rgba(99,102,241,0.5)", width: 1, style: 1 },
        },
        rightPriceScale: {
          borderColor: "rgba(99,102,241,0.15)",
          textColor: "#64748b",
        },
        timeScale: {
          borderColor: "rgba(99,102,241,0.15)",
          timeVisible: true,
          fixLeftEdge: true,
          fixRightEdge: true,
        },
      });

      const series = chart.addSeries(lw.CandlestickSeries, {
        upColor:       "#10b981",
        downColor:     "#f43f5e",
        borderVisible: false,
        wickUpColor:   "#10b981",
        wickDownColor: "#f43f5e",
      });

      series.setData(data);
      chart.timeScale().fitContent();

      ro = new ResizeObserver((entries) => {
        const w = entries[0]?.contentRect.width;
        if (w && chart) chart.applyOptions({ width: w });
      });
      ro.observe(el);
    })();

    return () => {
      ro?.disconnect();
      chart?.remove();
    };
  }, [data]);

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div>
          <div className="text-sm font-semibold text-slate-200">{symbol}</div>
          <div className="text-xs text-slate-500">30-day candlestick</div>
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "#10b981" }} /> Up
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: "#f43f5e" }} /> Down
          </span>
        </div>
      </div>
      <div ref={containerRef} className="w-full rounded-lg overflow-hidden" style={{ minHeight: 320 }} />
    </div>
  );
}

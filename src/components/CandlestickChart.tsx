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
        height: 360,
        layout: {
          background: { type: "solid" as const, color: "#ffffff" },
          textColor: "#64748b",
          fontFamily: "'Inter', -apple-system, sans-serif",
          fontSize: 12,
        },
        grid: {
          vertLines: { color: "#f1f5f9" },
          horzLines: { color: "#f1f5f9" },
        },
        crosshair: {
          vertLine: { color: "#94a3b8", width: 1, style: 1 },
          horzLine: { color: "#94a3b8", width: 1, style: 1 },
        },
        rightPriceScale: { borderColor: "#e2e8f0" },
        timeScale: { borderColor: "#e2e8f0", timeVisible: true },
      });

      const series = chart.addSeries(lw.CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });

      series.setData(data);
      chart.timeScale().fitContent();

      // Resize observer — keeps chart width in sync with container
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
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-4">
        <div>
          <div className="text-base font-semibold text-slate-900">{symbol}</div>
          <div className="text-xs text-slate-400">30-day candlestick chart</div>
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" /> Up
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-red-500" /> Down
          </span>
        </div>
      </div>
      <div ref={containerRef} className="w-full" style={{ minHeight: 360 }} />
    </div>
  );
}

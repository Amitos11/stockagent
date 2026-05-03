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

    (async () => {
      const lw = await import("lightweight-charts");

      // Guard: element may have unmounted during the async import
      if (!containerRef.current) return;
      const el = containerRef.current;

      chart = lw.createChart(el, {
        width: el.clientWidth,
        height: 360,
        layout: {
          background: { color: "#ffffff" },
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

      const handleResize = () => {
        const width = containerRef.current?.clientWidth;
        if (width && chart) {
          chart.applyOptions({ width });
        }
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    })();

    return () => {
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

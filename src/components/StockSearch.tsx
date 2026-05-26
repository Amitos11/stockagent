"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import type { StockRow } from "@/lib/types";

interface StockSearchProps {
  weights: { growth: number; profitability: number; valuation: number };
  onResult: (stock: StockRow) => void;
  cachedSymbols?: string[];
}

export function StockSearch({ weights, onResult, cachedSymbols = [] }: StockSearchProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const sym = input.trim().toUpperCase();
    if (!sym) return;

    // If already in scan results — open directly without API call
    if (cachedSymbols.includes(sym)) {
      onResult({ symbol: sym } as StockRow);
      setInput("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        growth: String(weights.growth),
        profitability: String(weights.profitability),
        valuation: String(weights.valuation),
      });
      const res = await fetch(`/api/stock/${sym}?${params}`);
      const data: StockRow = await res.json();
      if (data.error) {
        setError(`Cannot analyze ${sym}: ${data.error}`);
      } else {
        onResult(data);
        setInput("");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSearch} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Any ticker: AAPL, NVDA, TEVA, POLI.TA…"
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-slate-200 placeholder-slate-500"
            style={{ background: "rgba(19,27,46,0.8)", border: "1px solid rgba(99,102,241,0.2)" }}
            aria-label="Stock ticker"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Analyze
        </button>
      </div>
      {error && <div className="mt-2 text-sm text-red-400 rounded-lg px-3 py-2" style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.25)" }}>{error}</div>}
    </form>
  );
}

"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertCircle, ChevronDown, ChevronUp, Key } from "lucide-react";
import type { StockRow } from "@/lib/types";

interface AIInsightProps {
  stock: StockRow;
}

export function AIInsight({ stock }: AIInsightProps) {
  const [apiKey, setApiKey]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [insight, setInsight]   = useState("");
  const [error, setError]       = useState("");
  const [showKey, setShowKey]   = useState(false);
  const [expanded, setExpanded] = useState(true);

  async function generate() {
    if (!apiKey.trim()) { setShowKey(true); return; }
    setLoading(true);
    setError("");
    setInsight("");
    try {
      const res = await fetch("/api/ai-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock, apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setInsight(data.insight); setExpanded(true); }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  /** Parse the 3-section insight into structured blocks */
  function renderInsight(text: string) {
    const sections = text.split(/(?=📈|📊|🔥)/g).filter(Boolean);
    if (sections.length < 2) {
      // fallback: plain text
      return <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{text}</p>;
    }
    return (
      <div className="space-y-3">
        {sections.map((section, i) => {
          const [header, ...bodyLines] = section.split("\n");
          const body = bodyLines.join("\n").trim();
          return (
            <div key={i} className="rounded-lg bg-slate-50 border border-slate-100 p-3">
              <div className="text-sm font-semibold text-slate-800 mb-1">{header.trim()}</div>
              <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-violet-100">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-violet-500" />
          <span className="text-sm font-semibold text-violet-800">AI Analysis</span>
          <span className="text-xs text-violet-400">GPT-4o-mini — descriptive, not advice</span>
        </div>
        {insight && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-violet-400 hover:text-violet-600 transition-colors cursor-pointer"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* API key input */}
        {(showKey || !insight) && !loading && (
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Key size={12} />
              OpenAI API Key <span className="text-slate-400">(session only, never stored)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") generate(); }}
                placeholder="sk-..."
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
              />
              <button
                onClick={generate}
                disabled={!apiKey.trim() || loading}
                className="flex items-center gap-1.5 px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                <Sparkles size={13} />
                Analyze
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-violet-600 py-2">
            <Loader2 size={14} className="animate-spin" />
            Analyzing {stock.symbol} with GPT-4o-mini…
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Result */}
        {insight && expanded && (
          <div>
            {renderInsight(insight)}
            <button
              onClick={() => { setInsight(""); setShowKey(true); }}
              className="mt-2 text-xs text-violet-400 hover:text-violet-600 transition-colors cursor-pointer"
            >
              Regenerate
            </button>
          </div>
        )}

        {/* Generate button (after first run) */}
        {insight && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-violet-500 hover:text-violet-700 font-medium cursor-pointer"
          >
            Show analysis ↓
          </button>
        )}

        {!insight && !loading && !showKey && (
          <button
            onClick={() => setShowKey(true)}
            className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 font-medium transition-colors cursor-pointer"
          >
            <Sparkles size={13} />
            Generate AI analysis for {stock.symbol}
          </button>
        )}
      </div>
    </div>
  );
}

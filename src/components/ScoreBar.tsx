"use client";

interface ScoreBarProps {
  score: number;
  growth?: number;
  profitability?: number;
  valuation?: number;
}

export function ScoreBar({ score, growth, profitability, valuation }: ScoreBarProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 font-medium">Total</span>
        <span className="text-sm font-bold tabular-nums text-slate-900">{score.toFixed(0)}/100</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${score >= 60 ? "bg-emerald-500" : score >= 40 ? "bg-amber-400" : "bg-red-400"}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      {growth != null && profitability != null && valuation != null && (
        <div className="flex gap-2 mt-1">
          <div className="flex-1">
            <div className="text-xs text-slate-400 mb-0.5">Growth</div>
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min((growth / 33) * 100, 100)}%` }} />
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-slate-400 mb-0.5">Profit</div>
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-violet-400 rounded-full" style={{ width: `${Math.min((profitability / 33) * 100, 100)}%` }} />
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-slate-400 mb-0.5">Value</div>
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min((valuation / 34) * 100, 100)}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

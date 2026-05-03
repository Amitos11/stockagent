"use client";

import { useState, useEffect, useCallback } from "react";
import { X, TrendingUp, TrendingDown, ExternalLink, ChevronRight } from "lucide-react";
import type { StockRow } from "@/lib/types";
import { fmtPrice, fmtPct, fmtNum, fmtBigMoney, fmtRecommendation } from "@/lib/formatters";
import { ScoreBar } from "./ScoreBar";
import { ValueBadge, DayChangeBadge } from "./ScoreBadge";
import { CandlestickChart } from "./CandlestickChart";
import { AIInsight } from "./AIInsight";
import { NewsSection } from "./NewsSection";
import type { CandleData } from "@/lib/types";

interface StockDrawerProps {
  stock: StockRow | null;
  onClose: () => void;
}

export function StockDrawer({ stock, onClose }: StockDrawerProps) {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [candlesLoading, setCandlesLoading] = useState(false);

  const fetchCandles = useCallback(async (symbol: string) => {
    setCandlesLoading(true);
    setCandles([]);
    try {
      const res = await fetch(`/api/candles/${symbol}`);
      const data = await res.json();
      setCandles(data);
    } catch {
      setCandles([]);
    } finally {
      setCandlesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (stock) {
      fetchCandles(stock.symbol);
      document.body.style.overflow = "hidden";
    }
    return () => { document.body.style.overflow = ""; };
  }, [stock, fetchCandles]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!stock) return null;

  const fc = stock.financialCurrency ?? "USD";
  const forecasts = stock.forecasts ?? {};
  const lastEarnings = stock.lastEarnings ?? {};
  const quarterly = stock.quarterly ?? {};

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-label={`${stock.symbol} details`}
        className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white z-50 shadow-2xl overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{stock.symbol}</h2>
              {stock.isValuePlay && <ValueBadge isValuePlay />}
              <DayChangeBadge value={stock.dayChange} />
            </div>
            <div className="text-sm text-slate-500 mt-0.5">{stock.name}</div>
            {stock.sector && (
              <div className="text-xs text-slate-400 mt-0.5">{stock.sector}{stock.industry ? ` · ${stock.industry}` : ""}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Key metrics row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-xs text-slate-500 font-medium mb-1">Price</div>
              <div className="text-lg font-bold text-slate-900 tabular-nums">
                {fmtPrice(stock.price, stock.symbol, stock.currency)}
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-xs text-slate-500 font-medium mb-1">Market Cap</div>
              <div className="text-lg font-bold text-slate-900 tabular-nums">{stock.marketCapDisplay ?? "—"}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-xs text-slate-500 font-medium mb-1">Trailing P/E</div>
              <div className="text-lg font-bold text-slate-900 tabular-nums">{fmtNum(stock.peRatio, 1)}</div>
            </div>
          </div>

          {/* Score */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Composite Score</div>
            <ScoreBar
              score={stock.score ?? 0}
              growth={stock.scoreGrowth}
              profitability={stock.scoreProfitability}
              valuation={stock.scoreValuation}
            />
            {stock.insight && (
              <div className="mt-3 text-sm text-slate-600 border-t border-slate-200 pt-3">
                {stock.insight}
              </div>
            )}
          </div>

          {/* Candlestick chart */}
          {candlesLoading ? (
            <div className="bg-white rounded-xl border border-slate-100 p-10 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-slate-400">Loading chart…</span>
              </div>
            </div>
          ) : candles.length > 0 ? (
            <CandlestickChart symbol={stock.symbol} data={candles} />
          ) : null}

          {/* Value Investing section */}
          <Section title="Value Investing Metrics">
            <MetricRow label="P/E Ratio" value={fmtNum(stock.peRatio, 1)} flag={stock.peRatio != null && stock.peRatio < 20 ? "✓ < 20" : undefined} flagColor="green" />
            <MetricRow label="Forward P/E" value={fmtNum(stock.forwardPE, 1)} />
            <MetricRow label="PEG Ratio" value={fmtNum(stock.pegRatio, 2)} />
            <MetricRow label="Debt / Equity" value={fmtNum(stock.debtToEquity, 1)} flag={stock.debtToEquity != null && stock.debtToEquity < 50 ? "✓ < 50" : undefined} flagColor="green" />
            <MetricRow label="Current Ratio" value={fmtNum(stock.currentRatio, 2)} />
          </Section>

          {/* Growth */}
          <Section title="Growth Metrics">
            <MetricRow label="EPS YoY" value={fmtPct(stock.earningsGrowth)} positive={stock.earningsGrowth != null && stock.earningsGrowth > 0} />
            <MetricRow label="Revenue YoY" value={fmtPct(stock.revenueGrowth)} positive={stock.revenueGrowth != null && stock.revenueGrowth > 0} />
            <MetricRow label="Operating Margin" value={fmtPct(stock.operatingMargin)} />
            <MetricRow label="Profit Margin" value={fmtPct(stock.profitMargin)} />
            <MetricRow label="ROE" value={fmtPct(stock.roe)} />
          </Section>

          {/* Forward Estimates */}
          {(forecasts.nextQEps != null || forecasts.nextQRevenue != null || forecasts.nextYEps != null || forecasts.nextYRevenue != null) && (
            <Section title="Forward Estimates" subtitle="Analyst consensus — not investment advice">
              {forecasts.nextQRevenue != null && (
                <MetricRow
                  label="Next Qtr Revenue"
                  value={fmtBigMoney(forecasts.nextQRevenue, fc)}
                  sub={forecasts.nextQRevenueGrowth != null ? `${fmtPct(forecasts.nextQRevenueGrowth)} YoY` : undefined}
                />
              )}
              {forecasts.nextQEps != null && (
                <MetricRow
                  label="Next Qtr EPS"
                  value={`$${forecasts.nextQEps.toFixed(2)}`}
                  sub={forecasts.nextQEpsGrowth != null ? `${fmtPct(forecasts.nextQEpsGrowth)} YoY` : undefined}
                />
              )}
              {forecasts.nextYRevenue != null && (
                <MetricRow
                  label="Next Year Revenue"
                  value={fmtBigMoney(forecasts.nextYRevenue, fc)}
                  sub={forecasts.nextYRevenueGrowth != null ? `${fmtPct(forecasts.nextYRevenueGrowth)} YoY` : undefined}
                />
              )}
              {forecasts.nextYEps != null && (
                <MetricRow
                  label="Next Year EPS"
                  value={`$${forecasts.nextYEps.toFixed(2)}`}
                  sub={forecasts.nextYEpsGrowth != null ? `${fmtPct(forecasts.nextYEpsGrowth)} YoY` : undefined}
                />
              )}
            </Section>
          )}

          {/* Financials TTM */}
          {(stock.totalRevenue || stock.netIncomeTTM || stock.ebitda) && (
            <Section title="Financials (TTM)">
              {stock.totalRevenue != null && <MetricRow label="Revenue" value={fmtBigMoney(stock.totalRevenue, fc)} />}
              {quarterly.qRevenue != null && <MetricRow label={`Revenue (Q ${quarterly.qDate ?? ""})`} value={fmtBigMoney(quarterly.qRevenue, fc)} />}
              {stock.opIncomeTTM != null && <MetricRow label="Operating Income" value={fmtBigMoney(stock.opIncomeTTM, fc)} />}
              {stock.netIncomeTTM != null && <MetricRow label="Net Income" value={fmtBigMoney(stock.netIncomeTTM, fc)} />}
              {stock.ebitda != null && <MetricRow label="EBITDA" value={fmtBigMoney(stock.ebitda, fc)} />}
              {stock.grossProfits != null && <MetricRow label="Gross Profit" value={fmtBigMoney(stock.grossProfits, fc)} />}
            </Section>
          )}

          {/* Last Earnings */}
          {lastEarnings.epsActual != null && lastEarnings.epsEstimate != null && (
            <div className={`rounded-xl p-4 border ${lastEarnings.beat ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center gap-2 mb-2">
                {lastEarnings.beat ? <TrendingUp size={16} className="text-emerald-600" /> : <TrendingDown size={16} className="text-red-600" />}
                <span className={`text-sm font-semibold ${lastEarnings.beat ? "text-emerald-700" : "text-red-700"}`}>
                  {lastEarnings.beat ? "Beat Estimate" : "Missed Estimate"}
                  {lastEarnings.reportDate ? ` — ${lastEarnings.reportDate}` : ""}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Actual EPS</div>
                  <div className="text-sm font-bold text-slate-900">${lastEarnings.epsActual.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Est. EPS</div>
                  <div className="text-sm font-bold text-slate-900">${lastEarnings.epsEstimate.toFixed(2)}</div>
                </div>
                {lastEarnings.surprisePct != null && (
                  <div>
                    <div className="text-xs text-slate-500 mb-0.5">Surprise</div>
                    <div className={`text-sm font-bold ${lastEarnings.surprisePct >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {(lastEarnings.surprisePct * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Analyst Targets */}
          {stock.targetMeanPrice != null && (
            <Section title="Analyst Price Targets" subtitle="12-month consensus — external opinions">
              <MetricRow
                label="Mean Target"
                value={fmtPrice(stock.targetMeanPrice, stock.symbol, stock.currency)}
                sub={stock.price ? `${(((stock.targetMeanPrice - stock.price) / stock.price) * 100).toFixed(1)}% from current` : undefined}
              />
              {stock.targetLowPrice != null && stock.targetHighPrice != null && (
                <MetricRow
                  label="Range"
                  value={`${fmtPrice(stock.targetLowPrice, stock.symbol, stock.currency)} – ${fmtPrice(stock.targetHighPrice, stock.symbol, stock.currency)}`}
                />
              )}
              <MetricRow label="Consensus" value={fmtRecommendation(stock.recommendationKey)} />
              {stock.numAnalysts != null && <MetricRow label="Analysts" value={String(stock.numAnalysts)} />}
            </Section>
          )}

          {/* 52-week range */}
          {stock.fiftyTwoWeekHigh != null && stock.fiftyTwoWeekLow != null && (
            <Section title="52-Week Range">
              <div className="relative h-2 bg-slate-100 rounded-full my-3">
                {stock.price != null && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-amber-400 rounded-full border-2 border-white shadow"
                    style={{
                      left: `${Math.min(Math.max(((stock.price - stock.fiftyTwoWeekLow) / (stock.fiftyTwoWeekHigh - stock.fiftyTwoWeekLow)) * 100, 0), 100)}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                )}
              </div>
              <div className="flex justify-between text-xs text-slate-500 tabular-nums">
                <span>{fmtPrice(stock.fiftyTwoWeekLow, stock.symbol, stock.currency)}</span>
                <span className="font-medium text-slate-700">Current: {fmtPrice(stock.price, stock.symbol, stock.currency)}</span>
                <span>{fmtPrice(stock.fiftyTwoWeekHigh, stock.symbol, stock.currency)}</span>
              </div>
            </Section>
          )}

          {/* Management */}
          {(stock.management?.ceo || stock.management?.cfo) && (
            <Section title="Management">
              {stock.management.ceo && (
                <MetricRow label="CEO" value={stock.management.ceo.name} sub={stock.management.ceo.age ? `Age ${stock.management.ceo.age}` : undefined} />
              )}
              {stock.management.cfo && (
                <MetricRow label="CFO" value={stock.management.cfo.name} sub={stock.management.cfo.age ? `Age ${stock.management.cfo.age}` : undefined} />
              )}
            </Section>
          )}

          {/* News — NewsAPI.org */}
          <Section title="Latest News">
            <NewsSection symbol={stock.symbol} name={stock.name} />
          </Section>

          {stock.nextEarnings && (
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <ChevronRight size={14} className="text-amber-500" />
              <span>Next earnings report: <strong className="text-slate-900">{stock.nextEarnings}</strong></span>
            </div>
          )}

          {/* AI Insight */}
          <AIInsight stock={stock} />

          <p className="text-xs text-slate-400 pb-4">
            ⚠️ Automated data analysis only. NOT investment advice.
          </p>
        </div>
      </div>
    </>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="bg-slate-50 rounded-xl divide-y divide-slate-100">
        {children}
      </div>
    </div>
  );
}

function MetricRow({
  label, value, sub, positive, flag, flagColor,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  flag?: string;
  flagColor?: "green" | "amber" | "red";
}) {
  const flagCls =
    flagColor === "green" ? "text-emerald-600 bg-emerald-50"
    : flagColor === "amber" ? "text-amber-600 bg-amber-50"
    : "text-red-600 bg-red-50";

  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-4">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <div className="flex items-center gap-2 text-right">
        <div>
          <span className={`text-sm font-semibold tabular-nums ${positive === true ? "text-emerald-700" : positive === false ? "text-red-700" : "text-slate-900"}`}>
            {value}
          </span>
          {sub && <div className="text-xs text-slate-400">{sub}</div>}
        </div>
        {flag && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${flagCls}`}>{flag}</span>
        )}
      </div>
    </div>
  );
}

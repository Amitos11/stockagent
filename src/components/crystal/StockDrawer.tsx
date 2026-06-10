"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { StockRow, ScanWeights, CandleData } from "@/lib/types";
import { riskFlags, readSynthesis, aiInsightTemplate } from "@/lib/signals";
import { fmtPrice, fmtPct } from "@/lib/formatters";
import { SectorChip, ScorePill, DayChange, WatchStar, RiskBadge } from "./primitives";

function fmtPE(v?: number | null) { return v && v > 0 ? v.toFixed(1) : "—"; }
function fmtCap(mc?: number | null) {
  if (!mc) return "—";
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9)  return `$${(mc / 1e9).toFixed(1)}B`;
  return `$${(mc / 1e6).toFixed(1)}M`;
}

/* ── Candlestick canvas ───────────────────────────────────────────────────── */
function Candles({ symbol, price }: { symbol: string; price?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [candles, setCandles] = useState<CandleData[]>([]);

  useEffect(() => {
    fetch(`/api/candles/${symbol}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setCandles)
      .catch(() => setCandles([]));
  }, [symbol]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || candles.length < 2) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const lo = Math.min(...candles.map((c) => c.low));
    const hi = Math.max(...candles.map((c) => c.high));
    const pad = (hi - lo) * 0.12;
    const yf = (v: number) => h - ((v - lo + pad) / (hi - lo + pad * 2)) * h;
    const cw = w / candles.length;

    // gridlines
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let g = 1; g < 4; g++) {
      ctx.beginPath(); ctx.moveTo(0, (h / 4) * g); ctx.lineTo(w, (h / 4) * g); ctx.stroke();
    }
    ctx.fillStyle = "rgba(139,145,181,0.55)";
    ctx.font = "10px 'Spline Sans Mono', monospace";
    ctx.fillText(`$${hi.toFixed(0)}`, 6, 12);
    ctx.fillText(`$${lo.toFixed(0)}`, 6, h - 6);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let start: number | null = null;
    let raf: number;

    const draw = (progress: number) => {
      ctx.clearRect(0, 0, w, h);
      // re-draw grid
      ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1;
      for (let g = 1; g < 4; g++) {
        ctx.beginPath(); ctx.moveTo(0, (h / 4) * g); ctx.lineTo(w, (h / 4) * g); ctx.stroke();
      }
      ctx.fillStyle = "rgba(139,145,181,0.55)";
      ctx.font = "10px 'Spline Sans Mono', monospace";
      ctx.fillText(`$${hi.toFixed(0)}`, 6, 12);
      ctx.fillText(`$${lo.toFixed(0)}`, 6, h - 6);

      const count = Math.ceil(candles.length * progress);
      for (let i = 0; i < count; i++) {
        const c = candles[i];
        const x = i * cw + cw / 2;
        const up = c.close >= c.open;
        const col = up ? "#34d399" : "#f87171";
        ctx.strokeStyle = col; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, yf(c.high)); ctx.lineTo(x, yf(c.low)); ctx.stroke();
        ctx.fillStyle = up ? "rgba(52,211,153,0.85)" : "rgba(248,113,113,0.85)";
        ctx.shadowColor = col; ctx.shadowBlur = 6;
        const top = yf(Math.max(c.open, c.close));
        const bh = Math.max(2, Math.abs(yf(c.open) - yf(c.close)));
        ctx.fillRect(x - cw * 0.28, top, cw * 0.56, bh);
        ctx.shadowBlur = 0;
      }
    };

    if (reduced) { draw(1); return; }
    const step = (t: number) => {
      if (!start) start = t;
      const k = Math.min(1, (t - start) / 800);
      draw(1 - Math.pow(1 - k, 3));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [candles]);

  return (
    <canvas
      ref={ref}
      className="candle-canvas"
      aria-label={`One month candlestick chart for ${symbol}`}
    />
  );
}

/* ── Score pillars ────────────────────────────────────────────────────────── */
function Pillars({ stock, weights }: { stock: StockRow; weights: ScanWeights }) {
  const items = [
    { label: "Growth",        val: Math.round(stock.qualityGrowth ?? 0),        w: weights.growth,       color: "#22d3ee" },
    { label: "Profitability", val: Math.round(stock.qualityProfitability ?? 0), w: weights.profitability, color: "#a78bfa" },
    { label: "Valuation",     val: Math.round(stock.qualityValuation ?? 0),     w: weights.valuation,    color: "#fbbf24" },
  ];
  return (
    <div className="pillars">
      {items.map((p) => (
        <div key={p.label} className="pillar">
          <div className="pillar-head">
            <span>{p.label}</span>
            <span className="num" style={{ color: p.color }}>
              {p.val}<span className="pillar-w"> · w{p.w}%</span>
            </span>
          </div>
          <div className="pillar-track">
            <div
              className="pillar-fill"
              style={{
                width: p.val + "%",
                background: `linear-gradient(90deg, ${p.color}55, ${p.color})`,
                boxShadow: `0 0 10px ${p.color}66`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main drawer ──────────────────────────────────────────────────────────── */
interface Props {
  stock: StockRow;
  weights: ScanWeights;
  sectorPEMap: Record<string, number>;
  onClose: () => void;
  watched: boolean;
  onToggleWatch: () => void;
}

export function StockDrawer({ stock, weights, sectorPEMap, onClose, watched, onToggleWatch }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const close = () => { setVisible(false); setTimeout(onClose, 280); };

  const range = useMemo(() => {
    const lo = stock.fiftyTwoWeekLow, hi = stock.fiftyTwoWeekHigh, p = stock.price;
    if (!lo || !hi || !p || hi <= lo) return 0.5;
    return Math.min(1, Math.max(0, (p - lo) / (hi - lo)));
  }, [stock]);

  const flags = useMemo(() => riskFlags(stock, sectorPEMap), [stock, sectorPEMap]);
  const read  = useMemo(() => readSynthesis(stock, flags), [stock, flags]);
  const aiText = stock.insight || aiInsightTemplate(stock);

  const stats: [string, string][] = [
    ["P/E",        fmtPE(stock.peRatio)],
    ["Fwd P/E",    fmtPE(stock.forwardPE)],
    ["EPS growth", fmtPct(stock.earningsGrowth)],
    ["Rev growth", fmtPct(stock.revenueGrowth)],
    ["Op margin",  stock.operatingMargin != null ? `${(stock.operatingMargin * 100).toFixed(1)}%` : "—"],
    ["ROE",        stock.roe != null ? `${(stock.roe * 100).toFixed(1)}%` : "—"],
    ["Debt/Equity",stock.debtToEquity != null ? `${stock.debtToEquity.toFixed(0)}%` : "—"],
    ["Mkt cap",    fmtCap(stock.marketCap)],
  ];

  return (
    <div className={`drawer-root${visible ? " open" : ""}`}>
      <div className="drawer-scrim" onClick={close} aria-hidden="true" />
      <aside className="drawer glass depth-3" role="dialog" aria-label={`${stock.name ?? stock.symbol} details`}>
        <header className="drawer-head">
          <div>
            <div className="drawer-sym-row">
              <h2 className="drawer-sym num">{stock.symbol}</h2>
              <SectorChip sector={stock.sector} />
              {stock.isValuePlay ? <span className="value-flag">VALUE</span> : null}
            </div>
            <p className="drawer-name">{stock.name}</p>
          </div>
          <div className="drawer-head-actions">
            <WatchStar on={watched} onToggle={onToggleWatch} size={17} />
            <button className="drawer-close" onClick={close} aria-label="Close details">✕</button>
          </div>
        </header>

        <div className="drawer-price-row">
          <span className="drawer-price num">{fmtPrice(stock.price, stock.symbol, stock.currency)}</span>
          <DayChange value={stock.dayChange} />
          <ScorePill score={stock.score ?? 0} />
        </div>

        <div className={`read-banner read-${read.tone}`}>
          <span className="read-head">{read.head}</span>
          <p className="read-body">{read.body}</p>
        </div>

        <section className="drawer-sec">
          <h3 className="drawer-sec-title">Last month</h3>
          <Candles symbol={stock.symbol} price={stock.price} />
        </section>

        <section className="drawer-sec">
          <h3 className="drawer-sec-title">Score pillars</h3>
          <Pillars stock={stock} weights={weights} />
        </section>

        {/* Feature 2 (8-week trend) deferred */}
        <section className="drawer-sec">
          <h3 className="drawer-sec-title">8-week score trend</h3>
          <div className="trend-row">
            <span className="num dim" style={{ fontSize: "0.8rem" }}>Historical trend data coming soon</span>
          </div>
        </section>

        <section className="drawer-sec">
          <h3 className="drawer-sec-title">Risk monitor</h3>
          {flags.length === 0 ? (
            <div className="risk-clear">
              <span className="risk-clear-dot" aria-hidden="true" />
              No deterioration signals in the current scan.
            </div>
          ) : (
            <div className="risk-list">
              {flags.map((f) => (
                <div
                  key={f.label}
                  className="risk-item"
                  style={{ borderColor: (f.sev === 2 ? "#f87171" : "#fbbf24") + "35" }}
                >
                  <span className="risk-dot" style={{ background: f.sev === 2 ? "#f87171" : "#fbbf24" }} />
                  <span className="risk-item-body">
                    <b>{f.label}</b>
                    <span className="risk-pop-detail num">{f.detail}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="ai-disclaimer">Caveats when evaluating entry · exit-watch signals when already holding. Data-driven, not advice.</p>
        </section>

        <section className="drawer-sec">
          <h3 className="drawer-sec-title">Financials</h3>
          <div className="stat-grid">
            {stats.map(([k, v]) => (
              <div key={k} className="stat-cell">
                <span className="stat-k">{k}</span>
                <span className="stat-v num">{v}</span>
              </div>
            ))}
          </div>
          <div className="range-52">
            <span className="stat-k">52-week range</span>
            <div className="range-track">
              <span className="range-marker" style={{ left: range * 100 + "%" }} />
            </div>
            <div className="range-ends num">
              <span>{fmtPrice(stock.fiftyTwoWeekLow, stock.symbol, stock.currency)}</span>
              <span>Next earnings · {stock.nextEarnings ?? "TBD"}</span>
              <span>{fmtPrice(stock.fiftyTwoWeekHigh, stock.symbol, stock.currency)}</span>
            </div>
          </div>
        </section>

        <section className="drawer-sec">
          <h3 className="drawer-sec-title">AI insight</h3>
          <div className="ai-card">
            <span className="ai-spark" aria-hidden="true">✦</span>
            <p className="ai-text">{aiText}</p>
            <p className="ai-disclaimer">Generated summary of scan metrics — not investment advice.</p>
          </div>
        </section>

        {stock.news && stock.news.length > 0 && (
          <section className="drawer-sec">
            <h3 className="drawer-sec-title">News</h3>
            <div className="news-list">
              {stock.news.map((n, i) => (
                <article key={i} className="news-card">
                  <p className="news-title">{n.title}</p>
                  <p className="news-meta">
                    {n.source}{n.published ? ` · ${n.published}` : ""}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}

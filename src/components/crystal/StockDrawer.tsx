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
// Absolute money — handles negatives (net loss) and small/large magnitudes.
function fmtMoney(v?: number | null) {
  if (v == null) return "—";
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9)  return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6)  return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3)  return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

/* ── Candlestick canvas ───────────────────────────────────────────────────── */
function Candles({ symbol, candles }: { symbol: string; candles: CandleData[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

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
      aria-label={`Six month candlestick chart for ${symbol}`}
    />
  );
}

/* ── 8-week price trend (real, from candle closes) ────────────────────────── */
function EightWeekTrend({ candles }: { candles: CandleData[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  // ~8 weeks ≈ 40 trading days of daily closes.
  const window = useMemo(() => candles.slice(-40), [candles]);
  const pct = useMemo(() => {
    if (window.length < 2) return null;
    const first = window[0].close, last = window[window.length - 1].close;
    if (!first) return null;
    return ((last - first) / first) * 100;
  }, [window]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.length < 2) return;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const closes = window.map((c) => c.close);
    const lo = Math.min(...closes), hi = Math.max(...closes);
    const pad = (hi - lo) * 0.15 || 1;
    const x = (i: number) => (i / (closes.length - 1)) * (w - 6) + 3;
    const y = (v: number) => h - 4 - ((v - lo + pad) / (hi - lo + pad * 2)) * (h - 8);
    const up = (pct ?? 0) >= 0;
    const col = up ? "#34d399" : "#f87171";

    // area fill
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, col + "44");
    grad.addColorStop(1, col + "00");
    ctx.beginPath();
    ctx.moveTo(x(0), y(closes[0]));
    closes.forEach((v, i) => ctx.lineTo(x(i), y(v)));
    ctx.lineTo(x(closes.length - 1), h);
    ctx.lineTo(x(0), h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // line
    ctx.beginPath();
    ctx.moveTo(x(0), y(closes[0]));
    closes.forEach((v, i) => ctx.lineTo(x(i), y(v)));
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = col; ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // last dot
    ctx.beginPath();
    ctx.arc(x(closes.length - 1), y(closes[closes.length - 1]), 2.6, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  }, [window, pct]);

  if (window.length < 2 || pct == null) {
    return <span className="num dim" style={{ fontSize: "0.8rem" }}>Not enough price history</span>;
  }

  const up = pct >= 0;
  return (
    <div className="trend8-wrap">
      <canvas ref={ref} className="trend8-spark" aria-label="8-week price trend" />
      <div className="trend8-meta">
        <span className={`num ${up ? "pos" : "neg"}`} style={{ color: up ? "#34d399" : "#f87171", fontWeight: 600 }}>
          {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
        </span>
        <span className="num dim" style={{ fontSize: "0.72rem" }}>over ~8 weeks</span>
      </div>
    </div>
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
  // The scan row carries TTM figures but no quarterly/news detail. Fetch the
  // enriched record so reported financials and the latest quarter can show.
  const [detail, setDetail] = useState<StockRow>(stock);
  // Candles power both the chart and the real 8-week price trend.
  const [candles, setCandles] = useState<CandleData[]>([]);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setDetail(stock);
    let cancelled = false;
    fetch(`/api/stock/${stock.symbol}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: StockRow | null) => {
        if (!cancelled && d && !d.error) setDetail((prev) => ({ ...prev, ...d }));
      })
      .catch(() => { /* keep scan-row data */ });
    return () => { cancelled = true; };
  }, [stock.symbol]);

  useEffect(() => {
    let cancelled = false;
    setCandles([]);
    fetch(`/api/candles/${stock.symbol}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((c: CandleData[]) => { if (!cancelled) setCandles(Array.isArray(c) ? c : []); })
      .catch(() => { if (!cancelled) setCandles([]); });
    return () => { cancelled = true; };
  }, [stock.symbol]);

  const close = () => { setVisible(false); setTimeout(onClose, 280); };

  const range = useMemo(() => {
    const lo = stock.fiftyTwoWeekLow, hi = stock.fiftyTwoWeekHigh, p = stock.price;
    if (!lo || !hi || !p || hi <= lo) return 0.5;
    return Math.min(1, Math.max(0, (p - lo) / (hi - lo)));
  }, [stock]);

  const flags = useMemo(() => riskFlags(stock, sectorPEMap), [stock, sectorPEMap]);
  const read  = useMemo(() => readSynthesis(stock, flags), [stock, flags]);
  const aiText = stock.insight || aiInsightTemplate(stock);

  const pct = (v?: number | null) => (v != null ? `${(v * 100).toFixed(1)}%` : "—");

  // Reported absolute figures (TTM) — what the user was missing.
  const reported: [string, string][] = [
    ["Revenue (TTM)",    fmtMoney(detail.totalRevenue)],
    ["Net income (TTM)", fmtMoney(detail.netIncomeTTM)],
    ["Gross profit",     fmtMoney(detail.grossProfits)],
    ["EBITDA",           fmtMoney(detail.ebitda)],
    ["Op income (TTM)",  fmtMoney(detail.opIncomeTTM)],
    ["Net margin",       pct(detail.profitMargin)],
  ];

  const q = detail.quarterly;
  const quarterly: [string, string][] | null =
    q && (q.qRevenue != null || q.qNetIncome != null)
      ? [
          ["Revenue",        fmtMoney(q.qRevenue)],
          ["Net income",     fmtMoney(q.qNetIncome)],
          ["Operating inc.", fmtMoney(q.qOperatingIncome)],
        ]
      : null;

  const stats: [string, string][] = [
    ["P/E",        fmtPE(detail.peRatio)],
    ["Fwd P/E",    fmtPE(detail.forwardPE)],
    ["EPS growth", fmtPct(detail.earningsGrowth)],
    ["Rev growth", fmtPct(detail.revenueGrowth)],
    ["Op margin",  detail.operatingMargin != null ? `${(detail.operatingMargin * 100).toFixed(1)}%` : "—"],
    ["ROE",        detail.roe != null ? `${(detail.roe * 100).toFixed(1)}%` : "—"],
    ["Debt/Equity",detail.debtToEquity != null ? `${detail.debtToEquity.toFixed(0)}%` : "—"],
    ["Mkt cap",    fmtCap(detail.marketCap)],
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
          <h3 className="drawer-sec-title">Last 6 months</h3>
          <Candles symbol={stock.symbol} candles={candles} />
        </section>

        <section className="drawer-sec">
          <h3 className="drawer-sec-title">8-week price trend</h3>
          <EightWeekTrend candles={candles} />
        </section>

        <section className="drawer-sec">
          <h3 className="drawer-sec-title">Score pillars</h3>
          <Pillars stock={stock} weights={weights} />
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
          <h3 className="drawer-sec-title">Reported figures</h3>
          <div className="stat-grid">
            {reported.map(([k, v]) => (
              <div key={k} className="stat-cell">
                <span className="stat-k">{k}</span>
                <span className="stat-v num">{v}</span>
              </div>
            ))}
          </div>
          {quarterly ? (
            <>
              <p className="stat-k" style={{ marginTop: 14 }}>
                Latest quarter{q?.qDate ? ` · ${q.qDate}` : ""}
              </p>
              <div className="stat-grid">
                {quarterly.map(([k, v]) => (
                  <div key={k} className="stat-cell">
                    <span className="stat-k">{k}</span>
                    <span className="stat-v num">{v}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>

        <section className="drawer-sec">
          <h3 className="drawer-sec-title">Ratios</h3>
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

        {detail.news && detail.news.length > 0 && (
          <section className="drawer-sec">
            <h3 className="drawer-sec-title">News</h3>
            <div className="news-list">
              {detail.news.map((n, i) => (
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

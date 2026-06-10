"use client";

import { MarketGlobe } from "./MarketGlobe";

interface Props {
  collapsed: boolean;
  quote?: [string, string] | null;
  glow?: number;
}

export function Hero({ collapsed, quote, glow = 1 }: Props) {
  return (
    <section className={`hero${collapsed ? " collapsed" : ""}`}>
      <div className="hero-copy">
        <p className="hero-kicker">LIVE MARKET SCREENER · US + TASE</p>
        <h1 className="hero-title">
          Five hundred stocks.<br />
          <span className="hero-title-grad">Three dials.</span><br />
          One ranked view.
        </h1>
        <p className="hero-sub">
          StockAgent scans US large-caps and Israeli equities, scores each one on growth,
          profitability and valuation — weighted your way — and streams the ranking in live.
        </p>
        {quote ? (
          <figure className="hero-quote">
            <blockquote>"{quote[0]}"</blockquote>
            <figcaption>— {quote[1]}</figcaption>
          </figure>
        ) : null}
      </div>
      <div className="hero-globe" aria-hidden="true">
        <MarketGlobe glow={glow} />
      </div>
    </section>
  );
}

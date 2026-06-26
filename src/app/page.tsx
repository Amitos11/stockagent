"use client";

import Link from "next/link";
import { MarketGlobe } from "@/components/crystal/MarketGlobe";

const FEATURES = [
  { ic: "🛡️", c: "#f87171", bg: "rgba(248,113,113,.12)", t: "Financial-health guard",
    d: "High leverage and weak liquidity drag the score down and earn a 🔴 flag. A high score never hides a fragile balance sheet." },
  { ic: "📊", c: "#22d3ee", bg: "rgba(34,211,238,.12)", t: "3-factor scoring",
    d: "Growth · Profitability · Valuation — weighted your way. Re-rank the whole market in real time as you move the dials." },
  { ic: "🔔", c: "#6366f1", bg: "rgba(99,102,241,.12)", t: "Smart alerts",
    d: "Get an email when a stock crosses score 80, turns into a value play, or drops 10%. Never miss the move." },
  { ic: "🤖", c: "#8b5cf6", bg: "rgba(139,92,246,.12)", t: "AI insights",
    d: "A plain-English read on why each stock is strong or risky — context, not just numbers." },
  { ic: "💼", c: "#34d399", bg: "rgba(52,211,153,.12)", t: "Portfolio health",
    d: "Add your positions and get automatic risk alerts on what you already hold — a smoke detector for your portfolio." },
  { ic: "🌍", c: "#60a5fa", bg: "rgba(96,165,250,.12)", t: "Broad coverage",
    d: "US large & mid-caps across every sector, refreshed daily — plus select international names most screeners miss." },
];

const TIERS = [
  { name: "Free", price: "$0", per: "", desc: "See what to avoid", cta: "Start free", featured: false,
    feats: [["Risky 🔴 & mediocre 🟡 names", 1], ["Quality score", 1], ["Risk rating 🟢🟠🔴", 1], ["Top-rated 🟢 winners", 0], ["Alerts & portfolio", 0], ["AI insights", 0]] },
  { name: "Pro", price: "$12.99", per: "/mo", desc: "Full access — everything", cta: "Start 14-day trial", featured: true,
    feats: [["The top-rated 🟢 winners", 1], ["All 500+ stocks", 1], ["Unlimited smart alerts", 1], ["Portfolio health tracking", 1], ["AI insight on every stock", 1], ["Analyst data, digest & CSV", 1]] },
];

export default function LandingPage() {
  return (
    <div className="mk">
      <Link href="/login" className="mk-promo">
        🚀 <b>Launch offer</b> — 40% off your first month. Pay <s>$12.99</s> <b>$7.79</b> · code <b>LAUNCH40</b> →
      </Link>
      <div className="bg-glows" aria-hidden="true">
        <div className="bgg g1" /><div className="bgg g2" /><div className="bgg g3" />
      </div>

      <nav className="mk-nav">
        <div className="mk-nav-in">
          <div className="brand"><span className="brand-orb" /><span className="brand-name">StockAgent</span></div>
          <div className="mk-links">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <Link href="/login">Sign in</Link>
            <Link href="/login" className="mk-btn mk-btn-primary">Start free</Link>
          </div>
        </div>
      </nav>

      <header className="mk-hero">
        <div>
          <span className="mk-eyebrow">500+ US STOCKS · UPDATED DAILY</span>
          <h1 className="mk-h1">Find quality stocks.<br /><span className="mk-grad">Spot the risk</span> first.</h1>
          <p className="mk-lead">StockAgent ranks 500+ stocks on growth, profitability and value — and <b>flags an over-leveraged balance sheet in red before you buy.</b> The screener that tells you when to be careful.</p>
          <div className="mk-cta">
            <Link href="/login" className="mk-btn mk-btn-primary mk-btn-lg">Start free — $0</Link>
            <Link href="/app" className="mk-btn mk-btn-ghost mk-btn-lg">See live demo →</Link>
          </div>
          <div className="mk-stats">
            <div><b className="num">500+</b> stocks scanned</div>
            <div><b className="num">3</b> scoring factors</div>
            <div><b className="num">🛡️</b> risk-rated</div>
          </div>
        </div>
        <div className="mk-hero-globe" aria-hidden="true">
          <MarketGlobe glow={1.15} />
        </div>
      </header>

      <section id="features" className="mk-sec">
        <div className="mk-sec-tag">Why StockAgent</div>
        <h2 className="mk-h2">The only screener that tells you <span style={{ color: "#f87171" }}>when to be careful</span></h2>
        <p className="mk-sub">Most screeners show you a “cheap, fast-growing” stock and stay silent about the debt. We don’t.</p>
        <div className="mk-feats">
          {FEATURES.map((f) => (
            <div key={f.t} className="glass mk-feat">
              <div className="mk-feat-ic" style={{ background: f.bg, color: f.c }}>{f.ic}</div>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mk-sec">
        <div className="mk-sec-tag">Simple pricing</div>
        <h2 className="mk-h2">Start free. Upgrade when it pays for itself.</h2>
        <p className="mk-sub">No credit card to start. Cancel anytime.</p>
        <div className="mk-tiers">
          {TIERS.map((t) => (
            <div key={t.name} className={`glass mk-tier${t.featured ? " featured" : ""}`}>
              {t.featured && <span className="mk-tier-badge">40% off launch</span>}
              <h3>{t.name}</h3>
              {t.featured ? (
                <>
                  <div className="mk-pr num"><span className="mk-was">$12.99</span> $7.79<small>/mo</small></div>
                  <div className="mk-promo-note">First month · then $12.99/mo · code LAUNCH40</div>
                </>
              ) : (
                <div className="mk-pr num">{t.price}<small>{t.per}</small></div>
              )}
              <div className="mk-tier-desc">{t.desc}</div>
              <ul>
                {t.feats.map(([label, on]) => (
                  <li key={label as string} className={on ? "" : "off"}>{label}</li>
                ))}
              </ul>
              <Link href="/login" className={`mk-btn ${t.featured ? "mk-btn-primary" : "mk-btn-ghost"}`} style={{ textAlign: "center" }}>{t.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="mk-footer">
        <p className="mk-disc">⚠️ StockAgent is an informational screening tool only. It is not investment advice, a recommendation, or an offer to buy or sell any security. Data may contain errors or delays. All investment decisions are your own — consult a licensed financial advisor.</p>
        <div className="brand" style={{ justifyContent: "center", marginBottom: 8 }}><span className="brand-orb" /><span className="brand-name">StockAgent</span></div>
        <div style={{ color: "var(--faint)", fontSize: 13 }}>© 2026 StockAgent · Built on Crystal Markets</div>
      </footer>
    </div>
  );
}

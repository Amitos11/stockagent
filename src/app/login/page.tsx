"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  return (
    <div className="mk">
      <div className="bg-glows" aria-hidden="true">
        <div className="bgg g1" /><div className="bgg g2" /><div className="bgg g3" />
      </div>
      <nav className="mk-nav">
        <div className="mk-nav-in">
          <Link href="/" className="brand"><span className="brand-orb" /><span className="brand-name">StockAgent</span></Link>
        </div>
      </nav>

      <div className="mk-auth-wrap">
        <div className="glass mk-auth">
          <h2>Welcome back 👋</h2>
          <p className="mk-auth-sub">Sign in to screen the market</p>
          <form onSubmit={(e) => { e.preventDefault(); router.push("/app"); }}>
            <label className="mk-field">
              <span>Email</span>
              <input type="email" defaultValue="demo@stockagent.io" placeholder="you@email.com" />
            </label>
            <label className="mk-field">
              <span>Password</span>
              <input type="password" defaultValue="demo1234" placeholder="••••••••" />
            </label>
            <button type="submit" className="mk-btn mk-btn-primary" style={{ width: "100%", padding: "13px", fontSize: 16, marginTop: 6 }}>
              Sign in →
            </button>
          </form>
          <div className="mk-auth-foot">
            No account? <Link href="/app">Start free</Link> · <Link href="/">Back</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

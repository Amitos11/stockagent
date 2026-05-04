"""
yfinance data fetcher — called from Next.js API routes via subprocess.
Outputs a single JSON object to stdout.

Usage:
  python yf_fetch.py stock   <SYMBOL>
  python yf_fetch.py batch   <SYM1,SYM2,...>
  python yf_fetch.py stream  <SYM1,SYM2,...>   ← one JSON line per stock
  python yf_fetch.py candles <SYMBOL>
  python yf_fetch.py news    <SYMBOL>
  python yf_fetch.py enrich  <SYMBOL>
"""

import json
import sys
import os
import time
from datetime import datetime, timezone

# Add local _pylibs dir to path (installed at build time on Render)
_pylibs = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_pylibs")
if os.path.isdir(_pylibs):
    sys.path.insert(0, _pylibs)

import warnings
warnings.filterwarnings("ignore")

import requests
import yfinance as yf

# ── env ───────────────────────────────────────────────────────────────────────
FMP_KEY = os.environ.get("FMP_API_KEY", "")

# ── shared HTTP session ────────────────────────────────────────────────────────
_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
})


# ── helpers ────────────────────────────────────────────────────────────────────

def sf(v):
    try:
        f = float(v)
        return f if f == f else None
    except (TypeError, ValueError):
        return None


def fmt_mc(mc, symbol):
    if not mc:
        return ""
    sym = "₪" if ".TA" in symbol else "$"
    if mc >= 1e12: return f"{sym}{mc/1e12:.1f}T"
    if mc >= 1e9:  return f"{sym}{mc/1e9:.1f}B"
    if mc >= 1e6:  return f"{sym}{mc/1e6:.1f}M"
    return f"{sym}{mc:.0f}"


# ── Financial Modeling Prep (primary — no IP blocks, free tier) ───────────────

def _fmp_bulk(symbols: list) -> dict:
    """
    One HTTP call for up to 500 symbols via FMP /v3/quote.
    Returns {SYMBOL: row_dict, ...}  (already in our StockRow format).
    Requires FMP_API_KEY env var.
    """
    if not FMP_KEY:
        return {}
    out = {}
    chunk_size = 100
    for i in range(0, len(symbols), chunk_size):
        chunk = symbols[i:i + chunk_size]
        try:
            r = _session.get(
                f"https://financialmodelingprep.com/api/v3/quote/{','.join(chunk)}",
                params={"apikey": FMP_KEY},
                timeout=20,
            )
            print(f"[fmp] status={r.status_code} n={len(chunk)}", file=sys.stderr, flush=True)
            if r.ok:
                for q in (r.json() or []):
                    sym = q.get("symbol", "")
                    if not sym:
                        continue
                    price = sf(q.get("price"))
                    if not price:
                        continue
                    mc   = sf(q.get("marketCap"))
                    prev = sf(q.get("previousClose"))
                    if prev and prev > 0:
                        day_chg = (price - prev) / prev * 100
                    else:
                        day_chg = sf(q.get("changesPercentage"))

                    # FMP /quote includes pe, eps, yearHigh, yearLow, earningsAnnouncement
                    next_earn = ""
                    try:
                        ea = q.get("earningsAnnouncement") or ""
                        if ea:
                            # format: "2024-01-31T00:00:00.000+0000"
                            next_earn = ea[:10]
                    except Exception:
                        pass

                    out[sym] = {
                        "symbol":   sym,
                        "name":     q.get("name", ""),
                        "price":    price,
                        "currency": "USD",
                        "sector":   "",
                        "industry": "",

                        "marketCap":        mc,
                        "marketCapDisplay": fmt_mc(mc, sym),

                        "peRatio":   sf(q.get("pe")),
                        "forwardPE": None,
                        "pegRatio":  None,

                        "earningsGrowth": None,
                        "revenueGrowth":  None,

                        "operatingMargin": None,
                        "profitMargin":    None,
                        "roe":             None,

                        "debtToEquity": None,
                        "currentRatio": None,

                        "financialCurrency": "USD",
                        "totalRevenue":  None,
                        "grossProfits":  None,
                        "ebitda":        None,
                        "netIncomeTTM":  None,
                        "opIncomeTTM":   None,

                        "targetMeanPrice":    sf(q.get("priceAvg200")),
                        "targetHighPrice":    sf(q.get("yearHigh")),
                        "targetLowPrice":     sf(q.get("yearLow")),
                        "numAnalysts":        None,
                        "recommendationKey":  "",
                        "recommendationMean": None,

                        "dayChange":        day_chg,
                        "fiftyTwoWeekHigh": sf(q.get("yearHigh")),
                        "fiftyTwoWeekLow":  sf(q.get("yearLow")),

                        "nextEarnings": next_earn,
                    }
        except Exception as e:
            print(f"[fmp] error: {e}", file=sys.stderr, flush=True)
        if i + chunk_size < len(symbols):
            time.sleep(0.3)
    return out


# ── Yahoo Finance chart API (fallback — works on most IPs, price only) ─────────

def _yf_chart_price(symbol: str) -> dict | None:
    """
    Hit the Yahoo Finance chart endpoint (v8) — no crumb needed.
    Returns basic price row or None on failure.
    """
    try:
        r = _session.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
            params={"interval": "1d", "range": "2d"},
            timeout=12,
        )
        if not r.ok:
            return None
        meta = (r.json().get("chart") or {}).get("result", [{}])[0].get("meta", {})
        price = sf(meta.get("regularMarketPrice"))
        if not price:
            return None
        prev  = sf(meta.get("chartPreviousClose")) or sf(meta.get("previousClose"))
        mc    = None   # not in chart API
        day_chg = ((price - prev) / prev * 100) if (prev and prev > 0) else None
        return {
            "symbol":   symbol,
            "name":     meta.get("longName") or meta.get("shortName") or "",
            "price":    price,
            "currency": meta.get("currency", ""),
            "sector":   "",
            "industry": "",

            "marketCap":        None,
            "marketCapDisplay": "",

            "peRatio":   None, "forwardPE": None, "pegRatio": None,
            "earningsGrowth": None, "revenueGrowth": None,
            "operatingMargin": None, "profitMargin": None, "roe": None,
            "debtToEquity": None, "currentRatio": None,
            "financialCurrency": meta.get("currency", "USD"),
            "totalRevenue": None, "grossProfits": None,
            "ebitda": None, "netIncomeTTM": None, "opIncomeTTM": None,
            "targetMeanPrice": None, "targetHighPrice": None, "targetLowPrice": None,
            "numAnalysts": None, "recommendationKey": "", "recommendationMean": None,

            "dayChange":        day_chg,
            "fiftyTwoWeekHigh": sf(meta.get("fiftyTwoWeekHigh")),
            "fiftyTwoWeekLow":  sf(meta.get("fiftyTwoWeekLow")),
            "nextEarnings": "",
        }
    except Exception:
        return None


# ── single stock ───────────────────────────────────────────────────────────────

def fetch_stock(symbol: str) -> dict:
    # 1 — FMP (best data, no IP block)
    if FMP_KEY:
        rows = _fmp_bulk([symbol])
        if symbol in rows:
            return rows[symbol]

    # 2 — Yahoo chart endpoint (price only, no crumb)
    row = _yf_chart_price(symbol)
    if row:
        return row

    # 3 — yfinance Ticker.info last resort
    try:
        ticker = yf.Ticker(symbol, session=_session)
        info   = ticker.info or {}
        price  = sf(info.get("currentPrice")) or sf(info.get("regularMarketPrice"))
        if not price:
            return {"symbol": symbol, "error": "no price data"}
        mc = sf(info.get("marketCap"))
        prev = sf(info.get("regularMarketPreviousClose")) or sf(info.get("previousClose"))
        om = sf(info.get("operatingMargins"))
        tr = sf(info.get("totalRevenue"))
        return {
            "symbol":   symbol,
            "name":     info.get("shortName") or info.get("longName") or "",
            "price":    price,
            "currency": info.get("currency", ""),
            "sector":   info.get("sector", ""),
            "industry": info.get("industry", ""),
            "marketCap":        mc,
            "marketCapDisplay": fmt_mc(mc, symbol),
            "peRatio":   sf(info.get("trailingPE")),
            "forwardPE": sf(info.get("forwardPE")),
            "pegRatio":  sf(info.get("pegRatio")),
            "earningsGrowth": sf(info.get("earningsQuarterlyGrowth")),
            "revenueGrowth":  sf(info.get("revenueGrowth")),
            "operatingMargin": om,
            "profitMargin":    sf(info.get("profitMargins")),
            "roe":             sf(info.get("returnOnEquity")),
            "debtToEquity": sf(info.get("debtToEquity")),
            "currentRatio": sf(info.get("currentRatio")),
            "financialCurrency": info.get("financialCurrency") or info.get("currency") or "USD",
            "totalRevenue": tr,
            "grossProfits": sf(info.get("grossProfits")),
            "ebitda":       sf(info.get("ebitda")),
            "netIncomeTTM": sf(info.get("netIncomeToCommon")),
            "opIncomeTTM":  (om * tr) if (om is not None and tr is not None) else None,
            "targetMeanPrice":    sf(info.get("targetMeanPrice")),
            "targetHighPrice":    sf(info.get("targetHighPrice")),
            "targetLowPrice":     sf(info.get("targetLowPrice")),
            "numAnalysts":        info.get("numberOfAnalystOpinions"),
            "recommendationKey":  info.get("recommendationKey", ""),
            "recommendationMean": sf(info.get("recommendationMean")),
            "dayChange":        ((price - prev) / prev * 100) if (prev and prev > 0) else sf(info.get("regularMarketChangePercent")),
            "fiftyTwoWeekHigh": sf(info.get("fiftyTwoWeekHigh")),
            "fiftyTwoWeekLow":  sf(info.get("fiftyTwoWeekLow")),
            "nextEarnings": "",
        }
    except Exception as e:
        return {"symbol": symbol, "error": f"fetch failed: {str(e)[:80]}"}


# ── batch ──────────────────────────────────────────────────────────────────────

def fetch_batch(symbols: list) -> list:
    if FMP_KEY:
        raw = _fmp_bulk(symbols)
        return [raw.get(s) or {"symbol": s, "error": "no data"} for s in symbols]
    return [fetch_stock(s) for s in symbols]


# ── stream  ────────────────────────────────────────────────────────────────────

def stream_parallel(symbols: list, max_workers: int = 3) -> None:
    if not symbols:
        return

    # ── FMP path: ~1-2 HTTP requests for all symbols ──────────────────────────
    if FMP_KEY:
        raw = _fmp_bulk(symbols)
        missing = []
        for sym in symbols:
            row = raw.get(sym)
            if row:
                print(json.dumps(row), flush=True)
            else:
                missing.append(sym)
        # Fallback for any symbols FMP missed
        for sym in missing:
            row = _yf_chart_price(sym) or {"symbol": sym, "error": "no data"}
            print(json.dumps(row), flush=True)
            time.sleep(0.3)
        return

    # ── No FMP key: try Yahoo chart API for each symbol (price only) ──────────
    print("[stream] No FMP_API_KEY set — falling back to Yahoo chart API (price only)", file=sys.stderr, flush=True)
    for sym in symbols:
        row = _yf_chart_price(sym) or {"symbol": sym, "error": "no data"}
        print(json.dumps(row), flush=True)
        time.sleep(0.2)


# ── candles (Yahoo chart API — works without crumb) ───────────────────────────

def fetch_candles(symbol: str) -> list:
    try:
        ticker = yf.Ticker(symbol, session=_session)
        hist = ticker.history(period="1mo")
        if hist.empty:
            return []
        rows = []
        for dt, row in hist.iterrows():
            rows.append({
                "time":  dt.strftime("%Y-%m-%d"),
                "open":  round(float(row["Open"]),  4),
                "high":  round(float(row["High"]),  4),
                "low":   round(float(row["Low"]),   4),
                "close": round(float(row["Close"]), 4),
            })
        return rows
    except Exception:
        return []


# ── news ───────────────────────────────────────────────────────────────────────

def fetch_news(symbol: str) -> list:
    POSITIVE = {"surge","jump","rally","beat","gain","profit","growth","strong"}
    NEGATIVE = {"crash","drop","fall","miss","loss","decline","weak","slump"}
    try:
        ticker = yf.Ticker(symbol, session=_session)
        news = ticker.news or []
        result = []
        for item in news[:3]:
            content = item.get("content", item)
            title = content.get("title") or item.get("title") or ""
            link  = ""
            cu = content.get("canonicalUrl") or {}
            if isinstance(cu, dict):
                link = cu.get("url", "")
            link = link or content.get("link") or item.get("link") or ""
            if not title:
                continue
            words = set(title.lower().split())
            pos = len(words & POSITIVE)
            neg = len(words & NEGATIVE)
            sentiment = "positive" if pos > neg else ("negative" if neg > pos else "neutral")
            result.append({
                "title": title.strip(),
                "link": link,
                "source": "Yahoo",
                "published": "",
                "sentiment": sentiment,
            })
        return result
    except Exception:
        return []


# ── enrich ─────────────────────────────────────────────────────────────────────

def fetch_enrich(symbol: str) -> dict:
    out = {}
    try:
        ticker = yf.Ticker(symbol, session=_session)
        info = ticker.info or {}
        officers = info.get("companyOfficers") or []
        ceo = cfo = None
        for o in officers:
            if not isinstance(o, dict):
                continue
            title = (o.get("title") or "").lower()
            rec = {"name": o.get("name",""), "title": o.get("title",""), "age": o.get("age")}
            if not ceo and ("ceo" in title or "chief executive" in title):
                ceo = rec
            elif not cfo and ("cfo" in title or "chief financial" in title):
                cfo = rec
        out["management"] = {"ceo": ceo, "cfo": cfo}

        try:
            qis = ticker.quarterly_income_stmt
            if qis is not None and not qis.empty:
                col = qis.columns[0]
                def _get(names):
                    for n in names:
                        if n in qis.index:
                            return sf(qis.loc[n, col])
                    return None
                out["quarterly"] = {
                    "qDate":            col.strftime("%Y-%m-%d") if hasattr(col,"strftime") else str(col)[:10],
                    "qRevenue":         _get(["Total Revenue","TotalRevenue","Revenue"]),
                    "qOperatingIncome": _get(["Operating Income","OperatingIncome"]),
                    "qNetIncome":       _get(["Net Income","Net Income Common Stockholders","NetIncome"]),
                }
            else:
                out["quarterly"] = {}
        except Exception:
            out["quarterly"] = {}

        fwd = {}
        try:
            ee = ticker.earnings_estimate
            if ee is not None and not ee.empty:
                for label, prefix in (("+1q","nextQ"), ("+1y","nextY")):
                    if label in ee.index:
                        r = ee.loc[label]
                        fwd[f"{prefix}Eps"]       = sf(r.get("avg"))
                        fwd[f"{prefix}EpsGrowth"] = sf(r.get("growth"))
        except Exception:
            pass
        try:
            re = ticker.revenue_estimate
            if re is not None and not re.empty:
                for label, prefix in (("+1q","nextQ"), ("+1y","nextY")):
                    if label in re.index:
                        r = re.loc[label]
                        fwd[f"{prefix}Revenue"]       = sf(r.get("avg"))
                        fwd[f"{prefix}RevenueGrowth"] = sf(r.get("growth"))
        except Exception:
            pass
        out["forecasts"] = fwd

        try:
            eh = ticker.earnings_history
            if eh is not None and not eh.empty:
                latest = eh.iloc[-1]
                actual   = sf(latest.get("epsActual"))
                estimate = sf(latest.get("epsEstimate"))
                if actual is not None and estimate is not None:
                    out["lastEarnings"] = {
                        "epsActual":   actual,
                        "epsEstimate": estimate,
                        "surprisePct": sf(latest.get("surprisePercent")),
                        "beat":        actual >= estimate,
                    }
                else:
                    out["lastEarnings"] = {}
            else:
                out["lastEarnings"] = {}
        except Exception:
            out["lastEarnings"] = {}

    except Exception as e:
        out["error"] = str(e)[:80]

    return out


# ── main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "usage: yf_fetch.py <command> <arg>"}))
        sys.exit(1)

    cmd = sys.argv[1]
    arg = sys.argv[2]

    if cmd == "stock":
        print(json.dumps(fetch_stock(arg)))

    elif cmd == "batch":
        symbols = [s.strip() for s in arg.split(",") if s.strip()]
        print(json.dumps(fetch_batch(symbols)))

    elif cmd == "stream":
        symbols = [s.strip() for s in arg.split(",") if s.strip()]
        stream_parallel(symbols)

    elif cmd == "candles":
        print(json.dumps(fetch_candles(arg)))

    elif cmd == "news":
        print(json.dumps(fetch_news(arg)))

    elif cmd == "enrich":
        print(json.dumps(fetch_enrich(arg)))

    else:
        print(json.dumps({"error": f"unknown command: {cmd}"}))
        sys.exit(1)

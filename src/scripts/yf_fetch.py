"""
yfinance data fetcher — called from Next.js API routes via subprocess.
Outputs a single JSON object to stdout.

Usage:
  python yf_fetch.py stock   <SYMBOL>
  python yf_fetch.py batch   <SYM1,SYM2,...>
  python yf_fetch.py stream  <SYM1,SYM2,...>   ← bulk quote API, one JSON line per stock
  python yf_fetch.py candles <SYMBOL>
  python yf_fetch.py news    <SYMBOL>
  python yf_fetch.py enrich  <SYMBOL>   (management + quarterly + forward + earnings)
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

import requests
import warnings
warnings.filterwarnings("ignore")   # suppress Pandas4Warning noise

import yfinance as yf

# ── shared HTTP session ────────────────────────────────────────────────────────
_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://finance.yahoo.com/",
    "Origin": "https://finance.yahoo.com",
})


# ── helpers ────────────────────────────────────────────────────────────────────

def sf(v):
    """Safe float — returns None for missing / non-numeric values."""
    try:
        f = float(v)
        return f if f == f else None   # NaN check
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


# ── Yahoo Finance v7/finance/quote  (no crumb required) ───────────────────────
# Accepts ~50 symbols per request.  Much more reliable than quoteSummary on
# shared IPs because it does not need a per-session Yahoo crumb token.

_cookies_warmed = False

def _warm_cookies():
    """Hit finance.yahoo.com once so the session picks up the required cookies."""
    global _cookies_warmed
    if _cookies_warmed:
        return
    try:
        _session.get("https://finance.yahoo.com", timeout=12)
        _cookies_warmed = True
    except Exception:
        pass


def _bulk_quotes(symbols: list) -> dict:
    """
    Fetch up to 48 symbols per call via v7/finance/quote.
    Returns {SYMBOL: raw_quote_dict, ...}.
    """
    _warm_cookies()
    out = {}
    chunk_size = 48
    for i in range(0, len(symbols), chunk_size):
        chunk = symbols[i:i + chunk_size]
        # No 'fields' param — let Yahoo return its full default set
        params = {"symbols": ",".join(chunk)}
        fetched = False
        for base in ("https://query1.finance.yahoo.com",
                     "https://query2.finance.yahoo.com"):
            try:
                r = _session.get(
                    f"{base}/v7/finance/quote",
                    params=params,
                    timeout=20,
                )
                print(f"[bulk_quotes] {base} status={r.status_code} symbols={len(chunk)}", file=sys.stderr, flush=True)
                if r.status_code == 200:
                    results = (r.json().get("quoteResponse") or {}).get("result") or []
                    print(f"[bulk_quotes] got {len(results)} results", file=sys.stderr, flush=True)
                    for q in results:
                        sym = q.get("symbol", "")
                        if sym:
                            out[sym] = q
                    fetched = True
                    break
            except Exception as e:
                print(f"[bulk_quotes] exception: {e}", file=sys.stderr, flush=True)
        if not fetched:
            print(f"[bulk_quotes] both endpoints failed for chunk {i}-{i+chunk_size}", file=sys.stderr, flush=True)
        if i + chunk_size < len(symbols):
            time.sleep(0.5)
    return out


def _quote_to_row(q: dict) -> dict:
    """Convert a v7/finance/quote dict to our standard StockRow format."""
    symbol = q.get("symbol", "")
    price  = sf(q.get("regularMarketPrice"))
    if not price:
        return {"symbol": symbol, "error": "no price data"}

    prev = sf(q.get("regularMarketPreviousClose"))
    mc   = sf(q.get("marketCap"))
    om   = sf(q.get("operatingMargins"))
    tr   = sf(q.get("totalRevenue"))

    # day change: prefer computed from raw prices, else take the % field
    if prev and prev > 0:
        day_change = (price - prev) / prev * 100
    else:
        day_change = sf(q.get("regularMarketChangePercent"))

    # next earnings
    next_earn = ""
    try:
        ts = q.get("earningsTimestampStart") or q.get("earningsTimestamp")
        if ts:
            next_earn = datetime.fromtimestamp(int(ts), tz=timezone.utc).strftime("%Y-%m-%d")
    except Exception:
        pass

    return {
        "symbol":   symbol,
        "name":     q.get("shortName") or q.get("longName") or "",
        "price":    price,
        "currency": q.get("currency", ""),
        "sector":   q.get("sector", ""),
        "industry": q.get("industry", ""),

        "marketCap":        mc,
        "marketCapDisplay": fmt_mc(mc, symbol),

        # Valuation
        "peRatio":   sf(q.get("trailingPE")),
        "forwardPE": sf(q.get("forwardPE")),
        "pegRatio":  sf(q.get("pegRatio")),

        # Growth
        "earningsGrowth": sf(q.get("earningsGrowth")),
        "revenueGrowth":  sf(q.get("revenueGrowth")),

        # Profitability
        "operatingMargin": om,
        "profitMargin":    sf(q.get("profitMargins")),
        "roe":             sf(q.get("returnOnEquity")),

        # Balance sheet
        "debtToEquity": sf(q.get("debtToEquity")),
        "currentRatio": sf(q.get("currentRatio")),

        # Financials TTM
        "financialCurrency": q.get("financialCurrency") or q.get("currency") or "USD",
        "totalRevenue":  tr,
        "grossProfits":  sf(q.get("grossProfits")),
        "ebitda":        sf(q.get("ebitda")),
        "netIncomeTTM":  sf(q.get("netIncomeToCommon")),
        "opIncomeTTM":   (om * tr) if (om is not None and tr is not None) else None,

        # Analyst targets
        "targetMeanPrice":    sf(q.get("targetMeanPrice")),
        "targetHighPrice":    sf(q.get("targetHighPrice")),
        "targetLowPrice":     sf(q.get("targetLowPrice")),
        "numAnalysts":        q.get("numberOfAnalystOpinions"),
        "recommendationKey":  q.get("recommendationKey", ""),
        "recommendationMean": sf(q.get("recommendationMean")),

        # Price action
        "dayChange":        day_change,
        "fiftyTwoWeekHigh": sf(q.get("fiftyTwoWeekHigh")),
        "fiftyTwoWeekLow":  sf(q.get("fiftyTwoWeekLow")),

        "nextEarnings": next_earn,
    }


# ── single stock (detail page / free search) ──────────────────────────────────
# Uses v7/finance/quote first (no crumb); falls back to yfinance Ticker.info.

def fetch_stock(symbol: str) -> dict:
    # 1 — try the fast bulk-quote API for a single symbol
    raw = _bulk_quotes([symbol])
    q   = raw.get(symbol)
    if q:
        row = _quote_to_row(q)
        if not row.get("error"):
            return row

    # 2 — fallback: yfinance Ticker.info (needs crumb; may fail on Render)
    row = {"symbol": symbol}
    try:
        ticker = yf.Ticker(symbol, session=_session)
        info   = ticker.info or {}
    except Exception as e:
        row["error"] = f"fetch failed: {str(e)[:80]}"
        return row

    price = sf(info.get("currentPrice")) or sf(info.get("regularMarketPrice"))
    if not price:
        row["error"] = "no price data"
        return row

    row["name"]     = info.get("shortName") or info.get("longName") or ""
    row["price"]    = price
    row["currency"] = info.get("currency", "")
    row["sector"]   = info.get("sector", "")
    row["industry"] = info.get("industry", "")

    mc = sf(info.get("marketCap"))
    row["marketCap"]        = mc
    row["marketCapDisplay"] = fmt_mc(mc, symbol)

    row["peRatio"]   = sf(info.get("trailingPE"))
    row["forwardPE"] = sf(info.get("forwardPE"))
    row["pegRatio"]  = sf(info.get("pegRatio"))

    row["earningsGrowth"] = sf(info.get("earningsQuarterlyGrowth"))
    row["revenueGrowth"]  = sf(info.get("revenueGrowth"))

    row["operatingMargin"] = sf(info.get("operatingMargins"))
    row["profitMargin"]    = sf(info.get("profitMargins"))
    row["roe"]             = sf(info.get("returnOnEquity"))

    row["debtToEquity"] = sf(info.get("debtToEquity"))
    row["currentRatio"] = sf(info.get("currentRatio"))

    row["financialCurrency"] = info.get("financialCurrency") or info.get("currency") or "USD"
    row["totalRevenue"]  = sf(info.get("totalRevenue"))
    row["grossProfits"]  = sf(info.get("grossProfits"))
    row["ebitda"]        = sf(info.get("ebitda"))
    row["netIncomeTTM"]  = sf(info.get("netIncomeToCommon"))
    om = sf(info.get("operatingMargins"))
    tr = sf(info.get("totalRevenue"))
    row["opIncomeTTM"] = (om * tr) if (om is not None and tr is not None) else None

    row["targetMeanPrice"]    = sf(info.get("targetMeanPrice"))
    row["targetHighPrice"]    = sf(info.get("targetHighPrice"))
    row["targetLowPrice"]     = sf(info.get("targetLowPrice"))
    row["numAnalysts"]        = info.get("numberOfAnalystOpinions")
    row["recommendationKey"]  = info.get("recommendationKey", "")
    row["recommendationMean"] = sf(info.get("recommendationMean"))

    prev_close = sf(info.get("regularMarketPreviousClose")) or sf(info.get("previousClose"))
    if prev_close and prev_close > 0:
        row["dayChange"] = (price - prev_close) / prev_close * 100
    else:
        row["dayChange"] = sf(info.get("regularMarketChangePercent"))

    row["fiftyTwoWeekHigh"] = sf(info.get("fiftyTwoWeekHigh"))
    row["fiftyTwoWeekLow"]  = sf(info.get("fiftyTwoWeekLow"))

    row["nextEarnings"] = ""
    try:
        ts = info.get("earningsTimestampStart") or info.get("earningsTimestamp")
        if ts:
            row["nextEarnings"] = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
    except Exception:
        pass

    return row


# ── batch ──────────────────────────────────────────────────────────────────────

def fetch_batch(symbols: list) -> list:
    raw = _bulk_quotes(symbols)
    results = []
    for sym in symbols:
        q = raw.get(sym)
        results.append(_quote_to_row(q) if q else {"symbol": sym, "error": "no data"})
    return results


# ── stream  (scan — bulk quote, then emit one JSON line per stock) ─────────────

def stream_parallel(symbols: list, max_workers: int = 3) -> None:
    """
    Fetches ALL symbols in 1-2 HTTP requests via v7/finance/quote (no crumb).
    Emits one JSON line per symbol immediately after the bulk fetch completes.
    Falls back to individual sequential fetch for any symbols that were missed.
    """
    if not symbols:
        return

    raw = _bulk_quotes(symbols)

    missing = []
    for sym in symbols:
        q = raw.get(sym)
        if q:
            row = _quote_to_row(q)
            print(json.dumps(row), flush=True)
        else:
            missing.append(sym)

    # Sequential fallback for anything the bulk call missed
    if missing:
        time.sleep(2)
        for sym in missing:
            row = fetch_stock(sym)
            print(json.dumps(row), flush=True)
            time.sleep(1.0)


# ── candles ────────────────────────────────────────────────────────────────────

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


# ── enrich (management + quarterly + forward estimates + last earnings) ─────────

def fetch_enrich(symbol: str) -> dict:
    out = {}
    try:
        ticker = yf.Ticker(symbol, session=_session)

        # Management
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

        # Quarterly
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

        # Forward estimates
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

        # Last earnings
        try:
            eh = ticker.earnings_history
            if eh is not None and not eh.empty:
                latest = eh.iloc[-1]
                actual   = sf(latest.get("epsActual"))
                estimate = sf(latest.get("epsEstimate"))
                if actual is not None and estimate is not None:
                    surprise = sf(latest.get("surprisePercent"))
                    out["lastEarnings"] = {
                        "epsActual":   actual,
                        "epsEstimate": estimate,
                        "surprisePct": surprise,
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

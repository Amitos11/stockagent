"""
yfinance data fetcher — called from Next.js API routes via subprocess.
Outputs a single JSON object to stdout.

Usage:
  python yf_fetch.py stock   <SYMBOL>
  python yf_fetch.py batch   <SYM1,SYM2,...>
  python yf_fetch.py stream  <SYM1,SYM2,...>   ← parallel, one JSON line per stock
  python yf_fetch.py candles <SYMBOL>
  python yf_fetch.py news    <SYMBOL>
  python yf_fetch.py enrich  <SYMBOL>   (management + quarterly + forward + earnings)
"""

import json
import sys
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

# Add local _pylibs dir to path (installed at build time on Render)
_pylibs = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_pylibs")
if os.path.isdir(_pylibs):
    sys.path.insert(0, _pylibs)

import yfinance as yf

# Shared curl_cffi session — one crumb for all parallel threads (yfinance 1.3+)
# yfinance 1.3+ manages its own curl_cffi session and crumb internally.
# Passing an external session causes crumb mismatches — let yfinance handle it.
_session = None


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


# ── single stock ───────────────────────────────────────────────────────────────

def fetch_stock(symbol: str, max_retries: int = 3) -> dict:
    global _session
    row = {"symbol": symbol}
    info = None
    last_err = None

    for attempt in range(max_retries):
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info or {}
            if info:
                break
        except Exception as e:
            last_err = e
            err_str = str(e).lower()
            is_rate  = "rate" in err_str or "too many" in err_str or "429" in err_str
            is_crumb = "401" in err_str or "crumb" in err_str or "unauthorized" in err_str
            if is_rate or is_crumb:
                time.sleep(3 * (attempt + 1))
                continue
            else:
                row["error"] = f"fetch failed: {str(e)[:80]}"
                return row

    if not info:
        row["error"] = f"fetch failed: {str(last_err)[:80] if last_err else 'no data'}"
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

    # Valuation
    row["peRatio"]   = sf(info.get("trailingPE"))
    row["forwardPE"] = sf(info.get("forwardPE"))
    row["pegRatio"]  = sf(info.get("pegRatio"))

    # Growth
    row["earningsGrowth"] = sf(info.get("earningsQuarterlyGrowth"))
    row["revenueGrowth"]  = sf(info.get("revenueGrowth"))

    # Profitability
    row["operatingMargin"] = sf(info.get("operatingMargins"))
    row["profitMargin"]    = sf(info.get("profitMargins"))
    row["roe"]             = sf(info.get("returnOnEquity"))

    # Balance sheet
    row["debtToEquity"] = sf(info.get("debtToEquity"))
    row["currentRatio"] = sf(info.get("currentRatio"))

    # Financials TTM
    row["financialCurrency"] = info.get("financialCurrency") or info.get("currency") or "USD"
    row["totalRevenue"]  = sf(info.get("totalRevenue"))
    row["grossProfits"]  = sf(info.get("grossProfits"))
    row["ebitda"]        = sf(info.get("ebitda"))
    row["netIncomeTTM"]  = sf(info.get("netIncomeToCommon"))
    om = sf(info.get("operatingMargins"))
    tr = sf(info.get("totalRevenue"))
    row["opIncomeTTM"] = (om * tr) if (om is not None and tr is not None) else None

    # Analyst targets
    row["targetMeanPrice"] = sf(info.get("targetMeanPrice"))
    row["targetHighPrice"] = sf(info.get("targetHighPrice"))
    row["targetLowPrice"]  = sf(info.get("targetLowPrice"))
    row["numAnalysts"]     = info.get("numberOfAnalystOpinions")
    row["recommendationKey"]  = info.get("recommendationKey", "")
    row["recommendationMean"] = sf(info.get("recommendationMean"))

    # Price action
    prev_close = sf(info.get("regularMarketPreviousClose")) or sf(info.get("previousClose"))
    if prev_close and prev_close > 0 and price:
        row["dayChange"] = (price - prev_close) / prev_close * 100
    else:
        row["dayChange"] = sf(info.get("regularMarketChangePercent"))

    row["fiftyTwoWeekHigh"] = sf(info.get("fiftyTwoWeekHigh"))
    row["fiftyTwoWeekLow"]  = sf(info.get("fiftyTwoWeekLow"))

    # Next earnings — read from info (no extra HTTP call)
    row["nextEarnings"] = ""
    try:
        ts = info.get("earningsTimestampStart") or info.get("earningsTimestamp")
        if ts:
            from datetime import datetime, timezone
            row["nextEarnings"] = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
    except Exception:
        pass

    return row


# ── batch ──────────────────────────────────────────────────────────────────────

def fetch_batch(symbols: list) -> list:
    results = []
    for sym in symbols:
        results.append(fetch_stock(sym))
        time.sleep(0.35)
    return results


# ── parallel stream ─────────────────────────────────────────────────────────────
# Prints each completed stock as a single JSON line to stdout immediately.
# The Node.js SSE route reads these lines and forwards them to the browser.

def stream_parallel(symbols: list, max_workers: int = 4) -> None:
    if not symbols:
        return

    # ── Crumb warm-up ──────────────────────────────────────────────────────────
    # Fetch the first stock sequentially so yfinance establishes its crumb.
    # All subsequent threads reuse the same cached crumb (module-level in yfinance).
    warmup_sym = symbols[0]
    rest = symbols[1:]
    warmup = fetch_stock(warmup_sym)
    print(json.dumps(warmup), flush=True)
    time.sleep(0.3)  # let crumb settle

    failed = []

    # ── Parallel pass (remaining symbols) ─────────────────────────────────────
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(fetch_stock, sym): sym for sym in rest}
        for future in as_completed(futures):
            sym = futures[future]
            try:
                row = future.result()
            except Exception as e:
                row = {"symbol": sym, "error": str(e)[:80]}

            err = row.get("error", "")
            if "401" in err or "crumb" in err.lower() or "rate" in err.lower() or "too many" in err.lower():
                failed.append(sym)
            else:
                print(json.dumps(row), flush=True)

    # ── Retry pass ─────────────────────────────────────────────────────────────
    if failed:
        time.sleep(3)
        for sym in failed:
            time.sleep(0.5)
            row = fetch_stock(sym)
            print(json.dumps(row), flush=True)


# ── candles ────────────────────────────────────────────────────────────────────

def fetch_candles(symbol: str) -> list:
    try:
        ticker = yf.Ticker(symbol)
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
        ticker = yf.Ticker(symbol)
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
        ticker = yf.Ticker(symbol)

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
                    "qDate":             col.strftime("%Y-%m-%d") if hasattr(col,"strftime") else str(col)[:10],
                    "qRevenue":          _get(["Total Revenue","TotalRevenue","Revenue"]),
                    "qOperatingIncome":  _get(["Operating Income","OperatingIncome"]),
                    "qNetIncome":        _get(["Net Income","Net Income Common Stockholders","NetIncome"]),
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
                        "epsActual":    actual,
                        "epsEstimate":  estimate,
                        "surprisePct":  surprise,
                        "beat":         actual >= estimate,
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

"""
yfinance data fetcher — called from Next.js API routes via subprocess.
Outputs a single JSON object to stdout.

Usage:
  python yf_fetch.py stock   <SYMBOL>
  python yf_fetch.py batch   <SYM1,SYM2,...>
  python yf_fetch.py stream  <SYM1,SYM2,...>
  python yf_fetch.py candles <SYMBOL>
  python yf_fetch.py news    <SYMBOL>
  python yf_fetch.py enrich  <SYMBOL>
"""

import json, sys, os, time
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

# Add local _pylibs dir (installed at startup on Render)
_pylibs = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_pylibs")
if os.path.isdir(_pylibs):
    sys.path.insert(0, _pylibs)

import warnings
warnings.filterwarnings("ignore")

import yfinance as yf


# ── helpers ────────────────────────────────────────────────────────────────────

def sf(v):
    try:
        f = float(v)
        return f if f == f else None
    except (TypeError, ValueError):
        return None

def fmt_mc(mc, symbol):
    if not mc: return ""
    sym = "₪" if ".TA" in symbol else "$"
    if mc >= 1e12: return f"{sym}{mc/1e12:.1f}T"
    if mc >= 1e9:  return f"{sym}{mc/1e9:.1f}B"
    if mc >= 1e6:  return f"{sym}{mc/1e6:.1f}M"
    return f"{sym}{mc:.0f}"


# ── single stock ───────────────────────────────────────────────────────────────

def fetch_stock(symbol: str, max_retries: int = 3) -> dict:
    row  = {"symbol": symbol}
    info = None
    last_err = None

    for attempt in range(max_retries):
        try:
            # NOTE: no session= — let yfinance use its built-in curl_cffi browser
            ticker = yf.Ticker(symbol)
            info   = ticker.info or {}
            if info:
                break
        except Exception as e:
            last_err = e
            s = str(e).lower()
            if "401" in s or "crumb" in s or "rate" in s or "too many" in s or "429" in s:
                time.sleep(4 * (attempt + 1))
                continue
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

    prev = sf(info.get("regularMarketPreviousClose")) or sf(info.get("previousClose"))
    row["dayChange"] = ((price - prev) / prev * 100) if (prev and prev > 0) else sf(info.get("regularMarketChangePercent"))

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
    results = []
    for sym in symbols:
        results.append(fetch_stock(sym))
        time.sleep(0.35)
    return results


# ── stream (parallel, 4 workers) ──────────────────────────────────────────────

def stream_parallel(symbols: list, max_workers: int = 4) -> None:
    if not symbols:
        return

    # Warm up crumb with first stock sequentially
    first_row = fetch_stock(symbols[0])
    print(json.dumps(first_row), flush=True)
    time.sleep(0.5)

    rest   = symbols[1:]
    failed = []

    def fetch_staggered(sym: str, idx: int) -> dict:
        time.sleep(min(idx * 0.2, 0.6))  # stagger only first 4 workers
        return fetch_stock(sym)

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(fetch_staggered, sym, idx): sym
                   for idx, sym in enumerate(rest)}
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

    # Retry pass
    if failed:
        time.sleep(5)
        for sym in failed:
            row = fetch_stock(sym)
            print(json.dumps(row), flush=True)
            time.sleep(1.0)


# ── candles ────────────────────────────────────────────────────────────────────

def fetch_candles(symbol: str) -> list:
    try:
        hist = yf.Ticker(symbol).history(period="1mo")
        if hist.empty:
            return []
        return [
            {
                "time":  dt.strftime("%Y-%m-%d"),
                "open":  round(float(r["Open"]),  4),
                "high":  round(float(r["High"]),  4),
                "low":   round(float(r["Low"]),   4),
                "close": round(float(r["Close"]), 4),
            }
            for dt, r in hist.iterrows()
        ]
    except Exception:
        return []


# ── news ───────────────────────────────────────────────────────────────────────

def fetch_news(symbol: str) -> list:
    POS = {"surge","jump","rally","beat","gain","profit","growth","strong"}
    NEG = {"crash","drop","fall","miss","loss","decline","weak","slump"}
    try:
        news   = yf.Ticker(symbol).news or []
        result = []
        for item in news[:3]:
            c     = item.get("content", item)
            title = c.get("title") or item.get("title") or ""
            cu    = c.get("canonicalUrl") or {}
            link  = (cu.get("url","") if isinstance(cu, dict) else "") or c.get("link","") or item.get("link","")
            if not title:
                continue
            words = set(title.lower().split())
            sent  = "positive" if len(words & POS) > len(words & NEG) else ("negative" if len(words & NEG) > len(words & POS) else "neutral")
            result.append({"title": title.strip(), "link": link, "source": "Yahoo", "published": "", "sentiment": sent})
        return result
    except Exception:
        return []


# ── enrich ─────────────────────────────────────────────────────────────────────

def fetch_enrich(symbol: str) -> dict:
    out = {}
    try:
        ticker   = yf.Ticker(symbol)
        info     = ticker.info or {}
        officers = info.get("companyOfficers") or []
        ceo = cfo = None
        for o in officers:
            if not isinstance(o, dict): continue
            t = (o.get("title") or "").lower()
            rec = {"name": o.get("name",""), "title": o.get("title",""), "age": o.get("age")}
            if not ceo and ("ceo" in t or "chief executive" in t): ceo = rec
            elif not cfo and ("cfo" in t or "chief financial" in t): cfo = rec
        out["management"] = {"ceo": ceo, "cfo": cfo}

        try:
            qis = ticker.quarterly_income_stmt
            if qis is not None and not qis.empty:
                col = qis.columns[0]
                def _g(names):
                    for n in names:
                        if n in qis.index: return sf(qis.loc[n, col])
                    return None
                out["quarterly"] = {
                    "qDate":            col.strftime("%Y-%m-%d") if hasattr(col,"strftime") else str(col)[:10],
                    "qRevenue":         _g(["Total Revenue","TotalRevenue","Revenue"]),
                    "qOperatingIncome": _g(["Operating Income","OperatingIncome"]),
                    "qNetIncome":       _g(["Net Income","Net Income Common Stockholders","NetIncome"]),
                }
            else:
                out["quarterly"] = {}
        except Exception:
            out["quarterly"] = {}

        fwd = {}
        for attr, prefix in (("earnings_estimate","next"), ("revenue_estimate","next")):
            try:
                df = getattr(ticker, attr)
                if df is not None and not df.empty:
                    for label, pfx in (("+1q","nextQ"),("+1y","nextY")):
                        if label in df.index:
                            r = df.loc[label]
                            if attr == "earnings_estimate":
                                fwd[f"{pfx}Eps"]       = sf(r.get("avg"))
                                fwd[f"{pfx}EpsGrowth"] = sf(r.get("growth"))
                            else:
                                fwd[f"{pfx}Revenue"]       = sf(r.get("avg"))
                                fwd[f"{pfx}RevenueGrowth"] = sf(r.get("growth"))
            except Exception:
                pass
        out["forecasts"] = fwd

        try:
            eh = ticker.earnings_history
            if eh is not None and not eh.empty:
                latest = eh.iloc[-1]
                actual = sf(latest.get("epsActual"))
                est    = sf(latest.get("epsEstimate"))
                if actual is not None and est is not None:
                    out["lastEarnings"] = {"epsActual": actual, "epsEstimate": est,
                                           "surprisePct": sf(latest.get("surprisePercent")),
                                           "beat": actual >= est}
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

    cmd, arg = sys.argv[1], sys.argv[2]

    if   cmd == "stock":   print(json.dumps(fetch_stock(arg)))
    elif cmd == "batch":   print(json.dumps(fetch_batch([s.strip() for s in arg.split(",") if s.strip()])))
    elif cmd == "stream":  stream_parallel([s.strip() for s in arg.split(",") if s.strip()])
    elif cmd == "candles": print(json.dumps(fetch_candles(arg)))
    elif cmd == "news":    print(json.dumps(fetch_news(arg)))
    elif cmd == "enrich":  print(json.dumps(fetch_enrich(arg)))
    else:
        print(json.dumps({"error": f"unknown command: {cmd}"}))
        sys.exit(1)

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
from concurrent.futures import ThreadPoolExecutor, as_completed

# Add local _pylibs dir to path (installed at startup on Render)
_pylibs = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_pylibs")
if os.path.isdir(_pylibs):
    sys.path.insert(0, _pylibs)

import warnings
warnings.filterwarnings("ignore")

import requests
import yfinance as yf

# ── env ───────────────────────────────────────────────────────────────────────
FMP_KEY = os.environ.get("FMP_API_KEY", "")

# ── shared HTTP session (for direct API calls + yfinance crumb sharing) ────────
_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://finance.yahoo.com/",
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


# ── Financial Modeling Prep (primary when key is set) ─────────────────────────
# Free tier: 250 req/day — one bulk call for all symbols, no IP restrictions.

def _fmp_bulk(symbols: list) -> dict:
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
            if not r.ok:
                continue
            for q in (r.json() or []):
                sym = q.get("symbol", "")
                if not sym:
                    continue
                price = sf(q.get("price"))
                if not price:
                    continue
                mc   = sf(q.get("marketCap"))
                prev = sf(q.get("previousClose"))
                day_chg = ((price - prev) / prev * 100) if (prev and prev > 0) else sf(q.get("changesPercentage"))
                next_earn = ""
                try:
                    ea = q.get("earningsAnnouncement") or ""
                    if ea:
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
                    "totalRevenue": None,
                    "grossProfits": None,
                    "ebitda":       None,
                    "netIncomeTTM": None,
                    "opIncomeTTM":  None,
                    "targetMeanPrice":    None,
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


# ── yfinance single stock (fallback) ──────────────────────────────────────────

def fetch_stock(symbol: str, max_retries: int = 3) -> dict:
    # 1 — FMP fast path
    if FMP_KEY:
        raw = _fmp_bulk([symbol])
        if symbol in raw:
            return raw[symbol]

    # 2 — yfinance (works when Yahoo doesn't block the IP)
    row = {"symbol": symbol}
    info = None
    last_err = None

    for attempt in range(max_retries):
        try:
            # Pass shared session so all threads reuse the same crumb
            ticker = yf.Ticker(symbol, session=_session)
            info = ticker.info or {}
            if info:
                break
        except Exception as e:
            last_err = e
            err_str = str(e).lower()
            if "401" in err_str or "crumb" in err_str or "rate" in err_str or "too many" in err_str or "429" in err_str:
                time.sleep(4 * (attempt + 1))
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
    if FMP_KEY:
        raw = _fmp_bulk(symbols)
        return [raw.get(s) or {"symbol": s, "error": "no data"} for s in symbols]
    results = []
    for sym in symbols:
        results.append(fetch_stock(sym))
        time.sleep(0.35)
    return results


# ── stream ─────────────────────────────────────────────────────────────────────
# FMP path  → 1-2 HTTP requests, results in ~2 s.
# yfinance fallback → 4 parallel workers, shared session (one crumb), retry pass.

def stream_parallel(symbols: list, max_workers: int = 4) -> None:
    if not symbols:
        return

    # ── FMP fast path ─────────────────────────────────────────────────────────
    if FMP_KEY:
        raw = _fmp_bulk(symbols)
        missing = []
        for sym in symbols:
            row = raw.get(sym)
            if row:
                print(json.dumps(row), flush=True)
            else:
                missing.append(sym)
        # Sequential fallback for any FMP misses
        for sym in missing:
            row = fetch_stock(sym)
            print(json.dumps(row), flush=True)
            time.sleep(0.5)
        return

    # ── yfinance parallel path ────────────────────────────────────────────────
    # Warm up crumb with first stock, then run in parallel
    if symbols:
        first = fetch_stock(symbols[0])
        print(json.dumps(first), flush=True)
        time.sleep(0.5)

    rest = symbols[1:]
    if not rest:
        return

    failed = []

    def fetch_staggered(sym: str, idx: int) -> dict:
        time.sleep(idx * 0.2)   # stagger: 0, 0.2, 0.4, 0.6 s
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

    # Retry pass for any rate-limited symbols
    if failed:
        time.sleep(5)
        for sym in failed:
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

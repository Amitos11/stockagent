"""
yfinance data fetcher — called from Next.js API routes via subprocess.
Primary data source: Financial Modeling Prep (FMP) — fast, reliable, no IP blocks.
Fallback: yfinance (Yahoo Finance).

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

_pylibs = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_pylibs")
if os.path.isdir(_pylibs):
    sys.path.insert(0, _pylibs)

import warnings
warnings.filterwarnings("ignore")

import requests
import yfinance as yf

FMP_KEY = os.environ.get("FMP_API_KEY", "")

_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
})


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


# ── FMP — bulk quote (one request for all symbols) ─────────────────────────────

def _fmp_bulk(symbols: list) -> dict:
    """Returns {SYMBOL: row_dict} for all symbols in 1-2 HTTP requests."""
    if not FMP_KEY:
        return {}
    out = {}
    for i in range(0, len(symbols), 100):
        chunk = symbols[i:i+100]
        try:
            r = _session.get(
                "https://financialmodelingprep.com/stable/quote",
                params={"symbol": ",".join(chunk), "apikey": FMP_KEY},
                timeout=20,
            )
            if not r.ok:
                print(f"[fmp] HTTP {r.status_code}", file=sys.stderr, flush=True)
                continue
            for q in (r.json() or []):
                sym = q.get("symbol", "")
                if not sym: continue
                price = sf(q.get("price"))
                if not price: continue
                mc   = sf(q.get("marketCap"))
                prev = sf(q.get("previousClose"))
                day_chg = ((price - prev) / prev * 100) if (prev and prev > 0) else sf(q.get("changePercentage"))
                next_earn = (q.get("earningsAnnouncement") or "")[:10]
                out[sym] = {
                    "symbol":   sym,
                    "name":     q.get("name", ""),
                    "price":    price,
                    "currency": "USD",
                    "sector":   "",
                    "industry": "",
                    "marketCap":        mc,
                    "marketCapDisplay": fmt_mc(mc, sym),
                    "peRatio":          sf(q.get("pe")),
                    "forwardPE":        None,
                    "pegRatio":         None,
                    "earningsGrowth":   None,
                    "revenueGrowth":    None,
                    "operatingMargin":  None,
                    "profitMargin":     None,
                    "roe":              None,
                    "debtToEquity":     None,
                    "currentRatio":     None,
                    "financialCurrency": "USD",
                    "totalRevenue":     None,
                    "grossProfits":     None,
                    "ebitda":           None,
                    "netIncomeTTM":     None,
                    "opIncomeTTM":      None,
                    "targetMeanPrice":  None,
                    "targetHighPrice":  sf(q.get("yearHigh")),
                    "targetLowPrice":   sf(q.get("yearLow")),
                    "numAnalysts":      None,
                    "recommendationKey":  "",
                    "recommendationMean": None,
                    "dayChange":        day_chg,
                    "fiftyTwoWeekHigh": sf(q.get("yearHigh")),
                    "fiftyTwoWeekLow":  sf(q.get("yearLow")),
                    "nextEarnings":     next_earn,
                }
        except Exception as e:
            print(f"[fmp] error: {e}", file=sys.stderr, flush=True)
    return out


# ── yfinance fallback ──────────────────────────────────────────────────────────

def _yf_fetch(symbol: str, max_retries: int = 3) -> dict:
    row = {"symbol": symbol}
    info = None
    last_err = None
    for attempt in range(max_retries):
        try:
            ticker = yf.Ticker(symbol)
            info   = ticker.info or {}
            if info: break
        except Exception as e:
            last_err = e
            s = str(e).lower()
            if "401" in s or "crumb" in s or "rate" in s or "too many" in s or "429" in s:
                time.sleep(1.5 * (attempt + 1))
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

    mc = sf(info.get("marketCap"))
    om = sf(info.get("operatingMargins"))
    tr = sf(info.get("totalRevenue"))
    prev = sf(info.get("regularMarketPreviousClose")) or sf(info.get("previousClose"))

    row.update({
        "name":     info.get("shortName") or info.get("longName") or "",
        "price":    price,
        "currency": info.get("currency", ""),
        "sector":   info.get("sector", ""),
        "industry": info.get("industry", ""),
        "marketCap":        mc,
        "marketCapDisplay": fmt_mc(mc, symbol),
        "peRatio":          sf(info.get("trailingPE")),
        "forwardPE":        sf(info.get("forwardPE")),
        "pegRatio":         sf(info.get("pegRatio")),
        "earningsGrowth":   sf(info.get("earningsQuarterlyGrowth")),
        "revenueGrowth":    sf(info.get("revenueGrowth")),
        "operatingMargin":  om,
        "profitMargin":     sf(info.get("profitMargins")),
        "roe":              sf(info.get("returnOnEquity")),
        "debtToEquity":     sf(info.get("debtToEquity")),
        "currentRatio":     sf(info.get("currentRatio")),
        "financialCurrency": info.get("financialCurrency") or info.get("currency") or "USD",
        "totalRevenue":     tr,
        "grossProfits":     sf(info.get("grossProfits")),
        "ebitda":           sf(info.get("ebitda")),
        "netIncomeTTM":     sf(info.get("netIncomeToCommon")),
        "opIncomeTTM":      (om * tr) if (om is not None and tr is not None) else None,
        "targetMeanPrice":  sf(info.get("targetMeanPrice")),
        "targetHighPrice":  sf(info.get("targetHighPrice")),
        "targetLowPrice":   sf(info.get("targetLowPrice")),
        "numAnalysts":      info.get("numberOfAnalystOpinions"),
        "recommendationKey":  info.get("recommendationKey", ""),
        "recommendationMean": sf(info.get("recommendationMean")),
        "dayChange":        ((price - prev) / prev * 100) if (prev and prev > 0) else sf(info.get("regularMarketChangePercent")),
        "fiftyTwoWeekHigh": sf(info.get("fiftyTwoWeekHigh")),
        "fiftyTwoWeekLow":  sf(info.get("fiftyTwoWeekLow")),
        "nextEarnings":     "",
    })
    try:
        ts = info.get("earningsTimestampStart") or info.get("earningsTimestamp")
        if ts:
            row["nextEarnings"] = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
    except Exception:
        pass
    return row


# ── public API ─────────────────────────────────────────────────────────────────

def fetch_stock(symbol: str) -> dict:
    if FMP_KEY:
        raw = _fmp_bulk([symbol])
        if symbol in raw:
            return raw[symbol]
    return _yf_fetch(symbol)


def fetch_batch(symbols: list) -> list:
    if FMP_KEY:
        raw = _fmp_bulk(symbols)
        return [raw.get(s) or {"symbol": s, "error": "no data"} for s in symbols]
    results = []
    for sym in symbols:
        results.append(_yf_fetch(sym))
        time.sleep(0.35)
    return results


def stream_parallel(symbols: list, max_workers: int = 30) -> None:
    if not symbols:
        return

    # ── FMP path: bulk requests, all symbols in ~2-3s ─────────────────────────
    if FMP_KEY:
        raw = _fmp_bulk(symbols)
        missing = []
        for sym in symbols:
            row = raw.get(sym)
            if row:
                print(json.dumps(row), flush=True)
            else:
                missing.append(sym)
        # yfinance fallback for any FMP misses — parallel
        if missing:
            with ThreadPoolExecutor(max_workers=min(len(missing), 20)) as ex:
                futs = {ex.submit(_yf_fetch, sym): sym for sym in missing}
                for future in as_completed(futs):
                    try:
                        print(json.dumps(future.result()), flush=True)
                    except Exception as e:
                        print(json.dumps({"symbol": futs[future], "error": str(e)[:80]}), flush=True)
        return

    # ── yfinance fallback: chunked parallel batches ────────────────────────────
    # Split into chunks so we don't hammer Yahoo all at once
    CHUNK = 25
    failed = []

    for batch_start in range(0, len(symbols), CHUNK):
        chunk = symbols[batch_start:batch_start + CHUNK]
        with ThreadPoolExecutor(max_workers=min(len(chunk), max_workers)) as executor:
            futures = {executor.submit(_yf_fetch, sym): sym for sym in chunk}
            for future in as_completed(futures):
                sym = futures[future]
                try:
                    row = future.result()
                except Exception as e:
                    row = {"symbol": sym, "error": str(e)[:80]}
                err = row.get("error", "")
                if "401" in err or "crumb" in err.lower() or "rate" in err.lower() or "too many" in err.lower() or "429" in err:
                    failed.append(sym)
                else:
                    print(json.dumps(row), flush=True)
        # small pause between chunks to respect rate limits
        if batch_start + CHUNK < len(symbols):
            time.sleep(0.8)

    # retry rate-limited symbols sequentially
    if failed:
        time.sleep(3)
        for sym in failed:
            print(json.dumps(_yf_fetch(sym)), flush=True)
            time.sleep(0.3)


# ── candles ────────────────────────────────────────────────────────────────────

def fetch_candles(symbol: str) -> list:
    # ── FMP primary ────────────────────────────────────────────────────────────
    if FMP_KEY:
        try:
            from datetime import date, timedelta
            end   = date.today().isoformat()
            start = (date.today() - timedelta(days=45)).isoformat()
            r = _session.get(
                "https://financialmodelingprep.com/stable/historical-price-eod/light",
                params={"symbol": symbol, "from": start, "to": end, "apikey": FMP_KEY},
                timeout=15,
            )
            if r.ok:
                data = r.json() or []
                data = list(reversed(data))  # FMP: newest-first → reverse
                candles = []
                for d in data:
                    o = sf(d.get("open")); h = sf(d.get("high"))
                    lo = sf(d.get("low")); c = sf(d.get("close"))
                    if all(v is not None for v in [o, h, lo, c]):
                        candles.append({
                            "time":  d.get("date","")[:10],
                            "open":  round(o, 4), "high": round(h, 4),
                            "low":   round(lo, 4), "close": round(c, 4),
                        })
                if candles:
                    return candles
        except Exception as e:
            print(f"[fmp candles] {e}", file=sys.stderr, flush=True)

    # ── yfinance fallback ──────────────────────────────────────────────────────
    try:
        hist = yf.Ticker(symbol).history(period="1mo")
        if hist.empty:
            return []
        return [
            {"time": dt.strftime("%Y-%m-%d"), "open": round(float(r["Open"]),4),
             "high": round(float(r["High"]),4), "low": round(float(r["Low"]),4),
             "close": round(float(r["Close"]),4)}
            for dt, r in hist.iterrows()
        ]
    except Exception:
        return []


# ── news ───────────────────────────────────────────────────────────────────────

def fetch_news(symbol: str) -> list:
    POS = {"surge","jump","rally","beat","gain","profit","growth","strong"}
    NEG = {"crash","drop","fall","miss","loss","decline","weak","slump"}
    try:
        news = yf.Ticker(symbol).news or []
        result = []
        for item in news[:3]:
            c     = item.get("content", item)
            title = c.get("title") or item.get("title") or ""
            cu    = c.get("canonicalUrl") or {}
            link  = (cu.get("url","") if isinstance(cu, dict) else "") or c.get("link","") or item.get("link","")
            if not title: continue
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
        for attr in ("earnings_estimate", "revenue_estimate"):
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

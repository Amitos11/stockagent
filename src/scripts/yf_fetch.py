"""
yfinance data fetcher — called from Next.js API routes via subprocess.
Primary data source: Financial Modeling Prep (FMP) — fast, reliable, no IP blocks.
Fast fallback:       Yahoo chart + fundamentals-timeseries — no crumb needed.
Deep fallback:       yfinance — fundamentals for symbols the bulk APIs miss.

Usage:
  python yf_fetch.py stock        <SYMBOL>
  python yf_fetch.py batch        <SYM1,SYM2,...>
  python yf_fetch.py stream       <SYM1,SYM2,...>
  python yf_fetch.py candles      <SYMBOL>
  python yf_fetch.py news         <SYMBOL>
  python yf_fetch.py enrich       <SYMBOL>
  python yf_fetch.py enrich_cache <SYM1,SYM2,...>
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
AV_KEY  = os.environ.get("AV_API_KEY", "")

# Alpha Vantage fundamentals cache — 7-day TTL (data is quarterly)
_PROJECT_ROOT     = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
AV_CACHE_FILE     = os.path.join(_PROJECT_ROOT, ".av-cache.json")
AV_CACHE_TTL_SECS = 7 * 24 * 3600

_cffi_session = None
try:
    from curl_cffi import requests as cffi_req
    _cffi_session = cffi_req.Session(impersonate="chrome120")
except Exception:
    pass

_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
                    "marketCap":         mc,
                    "marketCapDisplay":  fmt_mc(mc, sym),
                    "peRatio":           sf(q.get("pe")),
                    "forwardPE":         None,
                    "pegRatio":          None,
                    "earningsGrowth":    None,
                    "revenueGrowth":     None,
                    "operatingMargin":   None,
                    "profitMargin":      None,
                    "roe":               None,
                    "debtToEquity":      None,
                    "currentRatio":      None,
                    "financialCurrency": "USD",
                    "totalRevenue":      None,
                    "grossProfits":      None,
                    "ebitda":            None,
                    "netIncomeTTM":      None,
                    "opIncomeTTM":       None,
                    "targetMeanPrice":   None,
                    "targetHighPrice":   sf(q.get("yearHigh")),
                    "targetLowPrice":    sf(q.get("yearLow")),
                    "numAnalysts":       None,
                    "recommendationKey":   "",
                    "recommendationMean":  None,
                    "dayChange":         day_chg,
                    "fiftyTwoWeekHigh":  sf(q.get("yearHigh")),
                    "fiftyTwoWeekLow":   sf(q.get("yearLow")),
                    "nextEarnings":      next_earn,
                }
        except Exception as e:
            print(f"[fmp] error: {e}", file=sys.stderr, flush=True)
    return out


# ── Alpha Vantage fundamentals cache ──────────────────────────────────────────
# AV OVERVIEW gives PE, margins, growth for any US/NASDAQ stock.
# Rate: 25 req/day (free tier). Cache 7 days so each symbol costs 1 call/week.

_av_cache: dict = {}

def _load_av_cache() -> None:
    global _av_cache
    try:
        if os.path.exists(AV_CACHE_FILE):
            with open(AV_CACHE_FILE, "r") as f:
                _av_cache = json.load(f)
    except Exception:
        _av_cache = {}

def _save_av_cache() -> None:
    try:
        with open(AV_CACHE_FILE, "w") as f:
            json.dump(_av_cache, f)
    except Exception as e:
        print(f"[av] save error: {e}", file=sys.stderr)

def _av_fundamentals(symbol: str) -> dict:
    """Fetch OVERVIEW from Alpha Vantage. Returns {} on quota/failure."""
    if not AV_KEY:
        return {}
    try:
        r = _session.get(
            "https://www.alphavantage.co/query",
            params={"function": "OVERVIEW", "symbol": symbol, "apikey": AV_KEY},
            timeout=15,
        )
        if not r.ok:
            return {}
        d = r.json()
        if not d or "Symbol" not in d:
            note = d.get("Note") or d.get("Information") or ""
            if note:
                print(f"[av] quota: {note[:120]}", file=sys.stderr, flush=True)
            return {}
        mc = sf(d.get("MarketCapitalization"))
        return {
            "peRatio":         sf(d.get("PERatio")),
            "forwardPE":       sf(d.get("ForwardPE")),
            "profitMargin":    sf(d.get("ProfitMargin")),
            "operatingMargin": sf(d.get("OperatingMarginTTM")),
            "roe":             sf(d.get("ReturnOnEquityTTM")),
            "revenueGrowth":   sf(d.get("QuarterlyRevenueGrowthYOY")),
            "earningsGrowth":  sf(d.get("QuarterlyEarningsGrowthYOY")),
            "marketCap":       mc,
            "sector":          d.get("Sector", ""),
            "industry":        d.get("Industry", ""),
            "name":            d.get("Name", ""),
        }
    except Exception as e:
        print(f"[av] {symbol}: {e}", file=sys.stderr, flush=True)
        return {}

def _merge_av(row: dict) -> dict:
    """Overlay AV cached fundamentals — only fills None/empty fields."""
    sym = row.get("symbol", "")
    entry = _av_cache.get(sym, {})
    av = entry.get("data", {}) if isinstance(entry, dict) else {}
    if not av:
        return row
    row = dict(row)
    for field in ("peRatio", "forwardPE", "profitMargin", "operatingMargin",
                  "roe", "revenueGrowth", "earningsGrowth"):
        if row.get(field) is None and av.get(field) is not None:
            row[field] = av[field]
    if not row.get("marketCap") and av.get("marketCap"):
        mc = av["marketCap"]
        row["marketCap"] = mc
        row["marketCapDisplay"] = fmt_mc(mc, sym)
    for field in ("sector", "industry", "name"):
        if not row.get(field) and av.get(field):
            row[field] = av[field]
    return row


# ── Yahoo Finance v7 bulk quote (no crumb needed) ─────────────────────────────

def _yf_bulk(symbols: list) -> dict:
    """Fetch quote + valuation fields for many symbols in one Yahoo request."""
    sess = _cffi_session or _session
    out = {}
    for i in range(0, len(symbols), 100):
        chunk = symbols[i:i+100]
        if not chunk:
            continue
        try:
            r = sess.get(
                "https://query1.finance.yahoo.com/v7/finance/quote",
                params={
                    "symbols": ",".join(chunk),
                    "lang": "en-US",
                    "region": "US",
                    "corsDomain": "finance.yahoo.com",
                },
                timeout=20,
            )
            if not r.ok:
                print(f"[yf_bulk] HTTP {r.status_code}", file=sys.stderr, flush=True)
                continue
            results = ((r.json() or {}).get("quoteResponse") or {}).get("result") or []
            for q in results:
                sym = q.get("symbol", "")
                if not sym:
                    continue
                price = sf(q.get("regularMarketPrice"))
                if not price:
                    continue
                mc = sf(q.get("marketCap"))
                out[sym] = {
                    "symbol":   sym,
                    "name":     q.get("longName") or q.get("shortName") or "",
                    "price":    price,
                    "currency": q.get("currency", "USD"),
                    "sector":   "",
                    "industry": "",
                    "marketCap":        mc,
                    "marketCapDisplay": fmt_mc(mc, sym),
                    "peRatio":          sf(q.get("trailingPE")),
                    "forwardPE":        sf(q.get("forwardPE")),
                    "pegRatio":         None,
                    "earningsGrowth":   sf(q.get("earningsGrowth")),
                    "revenueGrowth":    sf(q.get("revenueGrowth")),
                    "operatingMargin":  None,
                    "profitMargin":     None,
                    "roe":              None,
                    "debtToEquity":     None,
                    "currentRatio":     None,
                    "financialCurrency": q.get("currency", "USD"),
                    "totalRevenue":     None,
                    "grossProfits":     None,
                    "ebitda":           None,
                    "netIncomeTTM":     None,
                    "opIncomeTTM":      None,
                    "targetMeanPrice":  None,
                    "targetHighPrice":  sf(q.get("fiftyTwoWeekHigh")),
                    "targetLowPrice":   sf(q.get("fiftyTwoWeekLow")),
                    "numAnalysts":      None,
                    "recommendationKey":  "",
                    "recommendationMean": None,
                    "dayChange":        sf(q.get("regularMarketChangePercent")),
                    "fiftyTwoWeekHigh": sf(q.get("fiftyTwoWeekHigh")),
                    "fiftyTwoWeekLow":  sf(q.get("fiftyTwoWeekLow")),
                    "nextEarnings":     (q.get("earningsTimestamp") and
                                         datetime.fromtimestamp(q["earningsTimestamp"], tz=timezone.utc).strftime("%Y-%m-%d")) or "",
                }
        except Exception as e:
            print(f"[yf_bulk] error: {e}", file=sys.stderr, flush=True)
    return out


def _has_scoring_data(row: dict) -> bool:
    return bool(
        row.get("peRatio")
        or row.get("forwardPE")
        or row.get("earningsGrowth") is not None
        or row.get("revenueGrowth") is not None
        or row.get("operatingMargin") is not None
        or row.get("roe") is not None
    )


def _raw_reported(item: dict, key: str):
    vals = item.get(key) or []
    if not vals:
        return None
    latest = vals[-1] or {}
    return sf((latest.get("reportedValue") or {}).get("raw"))


def _yf_timeseries_fetch(symbol: str) -> dict:
    """
    Yahoo endpoints that currently do not require crumb:
      - chart: live price, name, currency, 52-week range
      - fundamentals-timeseries: PE, market cap, revenue growth, income metrics

    This is much faster and more stable than yfinance.Ticker(...).info for scans.
    """
    sess = _cffi_session or _session
    row = {"symbol": symbol}
    try:
        chart = sess.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
            params={"range": "1d", "interval": "1d"},
            timeout=12,
            headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
        )
        if not chart.ok:
            row["error"] = f"chart HTTP {chart.status_code}"
            return row
        result = (((chart.json() or {}).get("chart") or {}).get("result") or [])
        meta = (result[0] or {}).get("meta") if result else {}
        price = sf((meta or {}).get("regularMarketPrice"))
        if not price:
            row["error"] = "no price data"
            return row

        now = int(time.time())
        period1 = now - 3 * 365 * 24 * 3600
        period2 = now + 30 * 24 * 3600
        types = [
            "trailingPeRatio",
            "trailingForwardPeRatio",
            "trailingPegRatio",
            "trailingMarketCap",
            "quarterlyRevenueGrowth",
            "trailingTotalRevenue",
            "trailingGrossProfit",
            "trailingNetIncome",
            "quarterlyOperatingIncome",
            "quarterlyTotalRevenue",
        ]
        ts = sess.get(
            f"https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/{symbol}",
            params={
                "symbol": symbol,
                "type": ",".join(types),
                "period1": str(period1),
                "period2": str(period2),
            },
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
        )

        values = {}
        if ts.ok:
            for item in (((ts.json() or {}).get("timeseries") or {}).get("result") or []):
                for key in types:
                    if key in item:
                        values[key] = _raw_reported(item, key)

        mc = values.get("trailingMarketCap")
        total_revenue = values.get("trailingTotalRevenue")
        net_income = values.get("trailingNetIncome")
        q_op_income = values.get("quarterlyOperatingIncome")
        q_revenue = values.get("quarterlyTotalRevenue")
        prev = sf((meta or {}).get("chartPreviousClose")) or sf((meta or {}).get("previousClose"))

        row.update({
            "name":     (meta or {}).get("longName") or (meta or {}).get("shortName") or symbol,
            "price":    price,
            "currency": (meta or {}).get("currency", "USD"),
            "sector":   "",
            "industry": "",
            "marketCap":        mc,
            "marketCapDisplay": fmt_mc(mc, symbol),
            "peRatio":          values.get("trailingPeRatio"),
            "forwardPE":        values.get("trailingForwardPeRatio"),
            "pegRatio":         values.get("trailingPegRatio"),
            "earningsGrowth":   None,
            "revenueGrowth":    values.get("quarterlyRevenueGrowth"),
            "operatingMargin":  (q_op_income / q_revenue) if (q_op_income is not None and q_revenue) else None,
            "profitMargin":     (net_income / total_revenue) if (net_income is not None and total_revenue) else None,
            "roe":              None,
            "debtToEquity":     None,
            "currentRatio":     None,
            "financialCurrency": (meta or {}).get("currency", "USD"),
            "totalRevenue":     total_revenue,
            "grossProfits":     values.get("trailingGrossProfit"),
            "ebitda":           None,
            "netIncomeTTM":     net_income,
            "opIncomeTTM":      None,
            "targetMeanPrice":  None,
            "targetHighPrice":  sf((meta or {}).get("fiftyTwoWeekHigh")),
            "targetLowPrice":   sf((meta or {}).get("fiftyTwoWeekLow")),
            "numAnalysts":      None,
            "recommendationKey":  "",
            "recommendationMean": None,
            "dayChange":        ((price - prev) / prev * 100) if (prev and prev > 0) else None,
            "fiftyTwoWeekHigh": sf((meta or {}).get("fiftyTwoWeekHigh")),
            "fiftyTwoWeekLow":  sf((meta or {}).get("fiftyTwoWeekLow")),
            "nextEarnings":     "",
        })
        return row
    except Exception as e:
        row["error"] = f"timeseries failed: {str(e)[:80]}"
        return row


def _nasdaq_price(symbol: str) -> dict:
    """Last-resort price-only fallback. These rows are not counted as scored."""
    try:
        r = _session.get(
            f"https://api.nasdaq.com/api/quote/{symbol}/info",
            params={"assetclass": "stocks"},
            timeout=10,
        )
        if not r.ok:
            return {}
        data    = (r.json() or {}).get("data") or {}
        primary = data.get("primaryData") or {}
        price_str = primary.get("lastSalePrice", "")
        price = sf(price_str.replace("$", "").replace(",", "")) if price_str else None
        if not price:
            return {}
        pct_str = primary.get("percentageChange", "") or ""
        day_chg = sf(pct_str.replace("%", "").replace("+", "")) if pct_str else None

        # 52-week range: lives in keyStats (not summaryData)
        keystats   = data.get("keyStats") or {}
        wk52_entry = keystats.get("fiftyTwoWeekHighLow") or {}
        wk52  = wk52_entry.get("value", "") if isinstance(wk52_entry, dict) else ""
        low52 = high52 = None
        if wk52 and " - " in wk52:
            parts  = wk52.split(" - ", 1)
            low52  = sf(parts[0].strip().replace("$","").replace(",",""))
            high52 = sf(parts[1].strip().replace("$","").replace(",",""))

        return {
            "name":              data.get("companyName", ""),
            "price":             price,
            "currency":          "USD",
            "sector":            "",
            "industry":          "",
            "marketCap":         None,
            "marketCapDisplay":  "",
            "peRatio":           None,
            "forwardPE":         None,
            "pegRatio":          None,
            "earningsGrowth":    None,
            "revenueGrowth":     None,
            "operatingMargin":   None,
            "profitMargin":      None,
            "roe":               None,
            "debtToEquity":      None,
            "currentRatio":      None,
            "financialCurrency": "USD",
            "totalRevenue":      None,
            "grossProfits":      None,
            "ebitda":            None,
            "netIncomeTTM":      None,
            "opIncomeTTM":       None,
            "targetMeanPrice":   None,
            "targetHighPrice":   high52,
            "targetLowPrice":    low52,
            "numAnalysts":       None,
            "recommendationKey":   "",
            "recommendationMean":  None,
            "dayChange":         day_chg,
            "fiftyTwoWeekHigh":  high52,
            "fiftyTwoWeekLow":   low52,
            "nextEarnings":      "",
        }
    except Exception as e:
        print(f"[nasdaq] {symbol}: {e}", file=sys.stderr, flush=True)
        return {}


# ── yfinance single-stock fallback ─────────────────────────────────────────────

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
            if attempt < max_retries - 1:
                time.sleep(1.5 * (attempt + 1))
                continue

    if not info:
        row["error"] = f"fetch failed: {str(last_err)[:80] if last_err else 'no data'}"
        return row

    price = sf(info.get("currentPrice")) or sf(info.get("regularMarketPrice"))
    if not price:
        row["error"] = "no price data"
        return row

    mc   = sf(info.get("marketCap"))
    om   = sf(info.get("operatingMargins"))
    tr   = sf(info.get("totalRevenue"))
    prev = sf(info.get("regularMarketPreviousClose")) or sf(info.get("previousClose"))

    row.update({
        "name":     info.get("shortName") or info.get("longName") or "",
        "price":    price,
        "currency": info.get("currency", ""),
        "sector":   info.get("sector", ""),
        "industry": info.get("industry", ""),
        "marketCap":         mc,
        "marketCapDisplay":  fmt_mc(mc, symbol),
        "peRatio":           sf(info.get("trailingPE")),
        "forwardPE":         sf(info.get("forwardPE")),
        "pegRatio":          sf(info.get("pegRatio")),
        "earningsGrowth":    sf(info.get("earningsQuarterlyGrowth")),
        "revenueGrowth":     sf(info.get("revenueGrowth")),
        "operatingMargin":   om,
        "profitMargin":      sf(info.get("profitMargins")),
        "roe":               sf(info.get("returnOnEquity")),
        "debtToEquity":      sf(info.get("debtToEquity")),
        "currentRatio":      sf(info.get("currentRatio")),
        "financialCurrency": info.get("financialCurrency") or info.get("currency") or "USD",
        "totalRevenue":      tr,
        "grossProfits":      sf(info.get("grossProfits")),
        "ebitda":            sf(info.get("ebitda")),
        "netIncomeTTM":      sf(info.get("netIncomeToCommon")),
        "opIncomeTTM":       (om * tr) if (om is not None and tr is not None) else None,
        "targetMeanPrice":   sf(info.get("targetMeanPrice")),
        "targetHighPrice":   sf(info.get("targetHighPrice")),
        "targetLowPrice":    sf(info.get("targetLowPrice")),
        "numAnalysts":       info.get("numberOfAnalystOpinions"),
        "recommendationKey":   info.get("recommendationKey", ""),
        "recommendationMean":  sf(info.get("recommendationMean")),
        "dayChange":         ((price - prev) / prev * 100) if (prev and prev > 0)
                             else sf(info.get("regularMarketChangePercent")),
        "fiftyTwoWeekHigh":  sf(info.get("fiftyTwoWeekHigh")),
        "fiftyTwoWeekLow":   sf(info.get("fiftyTwoWeekLow")),
        "nextEarnings":      "",
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
    row = _yf_timeseries_fetch(symbol)
    if not row.get("error") and _has_scoring_data(row):
        return row
    raw = _yf_bulk([symbol])
    row = raw.get(symbol)
    if row and _has_scoring_data(row):
        return row
    deep = _yf_fetch(symbol)
    if not deep.get("error"):
        return deep
    if row:
        return row
    if ".TA" not in symbol:
        price = _nasdaq_price(symbol)
        if price:
            return {"symbol": symbol, **price}
    return deep


def fetch_batch(symbols: list) -> list:
    if FMP_KEY:
        raw = _fmp_bulk(symbols)
        return [raw.get(s) or {"symbol": s, "error": "no data"} for s in symbols]
    results = []
    for sym in symbols:
        results.append(_yf_fetch(sym))
        time.sleep(0.35)
    return results


def stream_parallel(symbols: list, max_workers: int = 8) -> None:
    """
    Scan all symbols and stream JSON rows one per line.

    Data cascade:
      1. FMP bulk   — fastest; covers ~35 US stocks with price + PE.
      2. Yahoo v7   — blocked on cloud IPs (401) but tried anyway.
      3. yfinance   — blocked on cloud IPs (401) but tried anyway.
      4. AV cache   — PE, margins, growth overlaid on ALL rows (no API call during scan).
      5. NASDAQ API — price-only fallback for US stocks with no other source.

    The AV cache is built in the background by `enrich_cache` after each scan.
    Once populated, NASDAQ-fetched stocks gain full fundamentals and start scoring.
    """
    if not symbols:
        return

    _load_av_cache()

    # ── Step 1: FMP bulk ──────────────────────────────────────────────────────
    fmp_rows: dict = {}
    if FMP_KEY:
        fmp_rows = _fmp_bulk(symbols)

    missing_after_fmp = []
    for sym in symbols:
        row = fmp_rows.get(sym)
        if row:
            print(json.dumps(_merge_av(row)), flush=True)
        else:
            missing_after_fmp.append(sym)

    if not missing_after_fmp:
        return

    # ── Step 2: Yahoo v7 bulk (may be 401-blocked on Render) ─────────────────
    yahoo_rows = {}
    with ThreadPoolExecutor(max_workers=min(len(missing_after_fmp), 24)) as ex:
        futs = {ex.submit(_yf_timeseries_fetch, sym): sym for sym in missing_after_fmp}
        for future in as_completed(futs):
            sym = futs[future]
            try:
                row = future.result()
            except Exception as e:
                row = {"symbol": sym, "error": str(e)[:80]}
            if not row.get("error"):
                yahoo_rows[sym] = row

    # If chart/timeseries misses anything, try the legacy Yahoo quote endpoint.
    still_missing = [s for s in missing_after_fmp if s not in yahoo_rows]
    if still_missing:
        yahoo_rows.update(_yf_bulk(still_missing))

    deep_missing = []
    price_fallbacks: dict = {}
    for sym in missing_after_fmp:
        row = yahoo_rows.get(sym)
        if row and _has_scoring_data(row):
            print(json.dumps(_merge_av(row)), flush=True)
        else:
            if row:
                price_fallbacks[sym] = row  # price available, no fundamentals
            deep_missing.append(sym)

    if not deep_missing:
        return

    # ── Step 3: yfinance deep-dive (may be 401-blocked on Render) ────────────
    still_no_data: list = []
    chunk_size = 16
    for start in range(0, len(deep_missing), chunk_size):
        chunk = deep_missing[start:start + chunk_size]
        with ThreadPoolExecutor(max_workers=min(len(chunk), max_workers)) as ex:
            futs = {ex.submit(_yf_fetch, sym): sym for sym in chunk}
            for future in as_completed(futs):
                sym = futs[future]
                try:
                    row = future.result()
                except Exception as e:
                    row = {"symbol": sym, "error": str(e)[:80]}
                if row.get("error"):
                    # yfinance failed — use price_fallback + AV merge if available
                    if sym in price_fallbacks:
                        print(json.dumps(_merge_av(price_fallbacks[sym])), flush=True)
                    else:
                        still_no_data.append(sym)
                else:
                    print(json.dumps(_merge_av(row)), flush=True)
        if start + chunk_size < len(deep_missing):
            time.sleep(1.0)

    # ── Step 4: NASDAQ price + AV cache for anything still empty ─────────────
    if still_no_data:
        us_syms   = [s for s in still_no_data if ".TA" not in s]
        tase_syms = [s for s in still_no_data if ".TA" in s]
        for sym in tase_syms:
            print(json.dumps({"symbol": sym, "error": "TASE: live price unavailable"}), flush=True)
        if us_syms:
            with ThreadPoolExecutor(max_workers=min(len(us_syms), 30)) as ex:
                futs = {ex.submit(_nasdaq_price, sym): sym for sym in us_syms}
                for future in as_completed(futs):
                    sym = futs[future]
                    try:
                        price_data = future.result()
                    except Exception:
                        price_data = {}
                    if price_data and price_data.get("price"):
                        print(json.dumps(_merge_av({"symbol": sym, **price_data})), flush=True)
                    else:
                        print(json.dumps({"symbol": sym, "error": "no price data"}), flush=True)


# ── AV cache enrichment (background task, fire-and-forget) ────────────────────

def enrich_cache(symbols: list) -> None:
    """
    Fetch Alpha Vantage OVERVIEW for stale/missing symbols at 5 req/min.
    Spawned as a detached background process after each scan — never blocks
    the SSE stream. Saves progress every 5 symbols to survive early kills.
    """
    if not AV_KEY:
        print("[av] AV_API_KEY not set — skipping", file=sys.stderr)
        return
    _load_av_cache()
    now = time.time()
    stale = [s for s in symbols
             if s not in _av_cache
             or _av_cache[s].get("expires_at", 0) < now]
    if not stale:
        print(f"[av] all {len(symbols)} symbols fresh", file=sys.stderr, flush=True)
        return
    print(f"[av] enriching {len(stale)}/{len(symbols)} symbols", file=sys.stderr, flush=True)
    for i, sym in enumerate(stale):
        data = _av_fundamentals(sym)
        if data:
            _av_cache[sym] = {"data": data, "expires_at": now + AV_CACHE_TTL_SECS}
            print(f"[av] {sym}: PE={data.get('peRatio')} margin={data.get('operatingMargin')}", file=sys.stderr, flush=True)
        else:
            print(f"[av] {sym}: no data", file=sys.stderr, flush=True)
        if (i % 5 == 4) or (i == len(stale) - 1):
            _save_av_cache()
        if i < len(stale) - 1:
            time.sleep(12)  # 5 req/min = 1 per 12s
    print(f"[av] done — {len(stale)} processed", file=sys.stderr, flush=True)


# ── candles ────────────────────────────────────────────────────────────────────

def fetch_candles(symbol: str) -> list:
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
                data = list(reversed(r.json() or []))
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

    # Yahoo chart API — same no-crumb endpoint the scan uses. yf.Ticker().history()
    # hits Yahoo's download endpoint that requires a crumb/cookie and is blocked on
    # datacenter IPs (Render), so it returned empty in production. The chart API
    # returns full OHLC arrays and works there.
    try:
        from datetime import datetime, timezone
        sess = _cffi_session or _session
        chart = sess.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}",
            params={"range": "6mo", "interval": "1d"},
            timeout=15,
            headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
        )
        if not chart.ok:
            return []
        result = (((chart.json() or {}).get("chart") or {}).get("result") or [])
        if not result:
            return []
        res = result[0] or {}
        stamps = res.get("timestamp") or []
        quote = (((res.get("indicators") or {}).get("quote") or [{}])[0]) or {}
        opens  = quote.get("open")  or []
        highs  = quote.get("high")  or []
        lows   = quote.get("low")   or []
        closes = quote.get("close") or []
        candles = []
        for i, ut in enumerate(stamps):
            try:
                o, h, lo, c = opens[i], highs[i], lows[i], closes[i]
            except IndexError:
                continue
            if None in (o, h, lo, c):
                continue
            day = datetime.fromtimestamp(ut, tz=timezone.utc).strftime("%Y-%m-%d")
            candles.append({
                "time": day,
                "open": round(float(o), 4), "high": round(float(h), 4),
                "low":  round(float(lo), 4), "close": round(float(c), 4),
            })
        return candles
    except Exception as e:
        print(f"[chart candles] {e}", file=sys.stderr, flush=True)
        return []


# ── earnings beat/miss (slim batch) ──────────────────────────────────────────────

def _earnings_one(symbol: str):
    """Latest quarter's EPS actual vs estimate → beat/miss. Slim: earnings_history only."""
    try:
        eh = yf.Ticker(symbol).earnings_history
        if eh is not None and not eh.empty:
            latest = eh.iloc[-1]
            actual = sf(latest.get("epsActual"))
            est    = sf(latest.get("epsEstimate"))
            if actual is not None and est is not None:
                return symbol, {
                    "epsActual": actual, "epsEstimate": est,
                    "surprisePct": sf(latest.get("surprisePercent")),
                    "beat": actual >= est,
                }
    except Exception:
        pass
    return symbol, None


def fetch_earnings_batch(symbols: list) -> dict:
    out = {}
    if not symbols:
        return out
    with ThreadPoolExecutor(max_workers=min(len(symbols), 12)) as ex:
        for fut in as_completed([ex.submit(_earnings_one, s) for s in symbols]):
            sym, data = fut.result()
            if data is not None:
                out[sym] = data
    return out


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
            sent  = ("positive" if len(words & POS) > len(words & NEG)
                     else "negative" if len(words & NEG) > len(words & POS)
                     else "neutral")
            result.append({"title": title.strip(), "link": link, "source": "Yahoo",
                            "published": "", "sentiment": sent})
        return result
    except Exception:
        return []


# ── enrich (yfinance deep-dive for single stock detail page) ──────────────────

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

        # Analyst price targets + recommendation (from quoteSummary via .info).
        out["analyst"] = {
            "targetMean":         sf(info.get("targetMeanPrice")),
            "targetHigh":         sf(info.get("targetHighPrice")),
            "targetLow":          sf(info.get("targetLowPrice")),
            "numAnalysts":        info.get("numberOfAnalystOpinions"),
            "recommendationKey":  info.get("recommendationKey") or "",
            "recommendationMean": sf(info.get("recommendationMean")),
        }

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
                            row = df.loc[label]
                            if attr == "earnings_estimate":
                                fwd[f"{pfx}Eps"]       = sf(row.get("avg"))
                                fwd[f"{pfx}EpsGrowth"] = sf(row.get("growth"))
                            else:
                                fwd[f"{pfx}Revenue"]       = sf(row.get("avg"))
                                fwd[f"{pfx}RevenueGrowth"] = sf(row.get("growth"))
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
                    out["lastEarnings"] = {
                        "epsActual": actual, "epsEstimate": est,
                        "surprisePct": sf(latest.get("surprisePercent")),
                        "beat": actual >= est,
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

    cmd, arg = sys.argv[1], sys.argv[2]
    syms = [s.strip() for s in arg.split(",") if s.strip()]

    if   cmd == "stock":        print(json.dumps(fetch_stock(arg)))
    elif cmd == "batch":        print(json.dumps(fetch_batch(syms)))
    elif cmd == "stream":       stream_parallel(syms)
    elif cmd == "candles":      print(json.dumps(fetch_candles(arg)))
    elif cmd == "earnings_batch": print(json.dumps(fetch_earnings_batch(syms)))
    elif cmd == "news":         print(json.dumps(fetch_news(arg)))
    elif cmd == "enrich":       print(json.dumps(fetch_enrich(arg)))
    elif cmd == "enrich_cache": enrich_cache(syms)
    else:
        print(json.dumps({"error": f"unknown command: {cmd}"}))
        sys.exit(1)

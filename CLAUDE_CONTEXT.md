# StockBot Web — Claude Session Context

## Project Overview
A Next.js 15 stock screening web app that scans 59 reliable tickers using yfinance (Python subprocess),
scores them by Growth / Profitability / Valuation weights, and streams results via SSE.

**Live URL:** https://stockagent-zudp.onrender.com  
**GitHub:** https://github.com/Amitos11/stockagent  
**Local dev:** `npm run dev` → http://localhost:3000  

---

## Tech Stack
- **Frontend:** Next.js 15 App Router, TypeScript, Tailwind CSS v4
- **Data fetching:** Python 3 + yfinance (subprocess via Node.js `spawn`)
- **Deployment:** Render.com (Starter $7/mo, Node.js service)
- **News:** NewsAPI.org (`NEWS_API_KEY` in `.env.local`)

---

## Render Start Command
```
python3 -m pip install yfinance --target=./src/scripts/_pylibs -q --upgrade; npm start -- -p $PORT
```
This installs yfinance into `src/scripts/_pylibs/` at startup so Python can import it.
`yf_fetch.py` adds that path via `sys.path.insert(0, _pylibs)`.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Main UI — scan controls, SSE client, results table, drawer |
| `src/app/api/scan/stream/route.ts` | SSE endpoint — spawns Python, streams rows, caches results |
| `src/scripts/yf_fetch.py` | Python data fetcher — stock/batch/stream/candles/news/enrich |
| `src/lib/tickers.ts` | List of ~83 ticker symbols |
| `src/lib/scoring.ts` | `applyScores`, `generateInsight`, `isValuePlay`, `hasMinData` |
| `src/lib/types.ts` | TypeScript types: `StockRow`, `ScanResult`, `ScanWeights` |
| `src/lib/fetcher.ts` | Node.js helpers — calls Python subprocess |
| `src/components/CandlestickChart.tsx` | TradingView lightweight-charts candle chart |
| `src/components/NewsSection.tsx` | NewsAPI.org news cards per stock |
| `src/app/api/news/[symbol]/route.ts` | NewsAPI proxy route |
| `src/app/api/candles/[symbol]/route.ts` | Candle history route |
| `src/app/globals.css` | Global CSS including custom range slider styles |
| `.env.local` | `NEWS_API_KEY=47d467bac8cc472e8fce33401d2900d8` |
| `requirements.txt` | `yfinance==0.2.54` |

---

## Architecture — SSE Scan Flow
1. User adjusts Growth/Profitability/Valuation sliders → clicks Scan
2. Frontend opens `EventSource` → `GET /api/scan/stream?growth=X&profitability=Y&valuation=Z`
3. Server checks 30-min file cache (`.scan-cache.json`) — hit → returns complete event immediately
4. Cache miss → spawns `python3 src/scripts/yf_fetch.py stream SYM1,SYM2,...`
5. Python fetches stocks in parallel (4 workers), prints each row as JSON line to stdout
6. Node reads stdout line-by-line → scores each row → emits `stock` SSE event to browser
7. On Python exit → builds final ranked result → emits `complete` event → saves to cache
8. Browser receives `stock` events (live updates) then `complete` event (final ranked table)

---

## SSE Event Format
```json
{ "type": "start",    "data": { "total": 83 } }
{ "type": "stock",    "data": { "row": {...}, "received": 5, "total": 83 } }
{ "type": "complete", "data": { "allRows": [...], "valid": [...], "top10": [...], "scannedAt": "...", "weights": {...} } }
{ "type": "error",    "data": { "message": "..." } }
```

---

## Python yf_fetch.py — Key Design
- **Shared session:** `requests.Session()` at module level, passed to all `yf.Ticker(symbol, session=_session)`
  — This prevents Yahoo Finance 401 crumb errors when running parallel threads
- **stream_parallel:** 4 workers, first batch staggered (0.2s each), retry pass for any 401/rate failures
- **fetch_stock:** max 2 retries, sleep max 4s on rate limit
- **Next earnings:** read from `info["earningsTimestampStart"]` — no extra HTTP call
- **_pylibs path:** auto-added at top of script for Render deployment

---

## Slider UI (WeightSlider component in page.tsx)
- Three sliders: Growth (blue #60a5fa), Profitability (purple #a78bfa), Valuation (amber #fbbf24)
- Each has: colored filled track (inline gradient), white thumb with colored border (CSS in globals.css)
- +/− buttons (±5) and number input for precise control
- Colors sum enforced: when one changes, others scale proportionally

---

## Known Issues / Fixed
- ✅ SSE results disappearing — fixed `sseEvent()` to nest under `data` key
- ✅ Hydration error — `suppressHydrationWarning` on timestamp span
- ✅ clientWidth null crash — null check after async import in CandlestickChart
- ✅ NewsAPI returning PyPI packages — added financial keywords to query
- ✅ python not found on Linux — `process.platform === "win32" ? "python" : "python3"`
- ✅ 401 Invalid Crumb errors — shared `requests.Session` across all threads
- ✅ Slider track black — removed `background` from globals.css, use inline gradient only
- ✅ Scan taking 4+ min — removed calendar HTTP call, stagger only first batch

---

## What's Working
- Full scan of ~83 stocks with parallel fetching + retry
- Live streaming results to browser via SSE
- 30-min persistent cache (survives Render restarts)
- Weighted scoring: Growth / Profitability / Valuation
- Stock drawer: candle chart (1 month), news (NewsAPI), enriched data
- Deployed and running on Render.com

---

## Next Steps (Discussed, Not Yet Implemented)
1. **Additional APIs** — Financial Modeling Prep (FMP), Alpha Vantage, or FRED to supplement yfinance
2. **Dark mode**
3. **Watchlist** — save favorite stocks
4. **Price alerts**

---

## How to Resume
Paste this file's contents at the start of a new Claude conversation, then say what you want to do next.
The full project is at: `C:\Users\User\Documents\stockbot-web`

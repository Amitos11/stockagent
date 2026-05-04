/**
 * GET /api/scan/stream?growth=33&profitability=33&valuation=34
 *
 * Scans stocks via Finnhub API (Node.js, no Python).
 * Falls back to Python/yfinance if Finnhub key is missing.
 */

import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { TICKERS } from "@/lib/tickers";
import { hasMinData, applyScores, generateInsight, isValuePlay } from "@/lib/scoring";
import { putStock } from "@/lib/stockCache";
import { getFinnhubQuote, getFinnhubMetrics, getFinnhubProfile } from "@/lib/finnhub";
import { fmt_mc } from "@/lib/formatters";
import type { ScanWeights, StockRow, ScanResult } from "@/lib/types";

// ── Persistent file cache ─────────────────────────────────────────────────────

interface CacheEntry { result: ScanResult; expiresAt: number; }
const CACHE_FILE  = join(process.cwd(), ".scan-cache.json");
const CACHE_TTL_MS = 30 * 60 * 1000;
const memCache    = new Map<string, CacheEntry>();

function cacheKey(w: ScanWeights) { return `${w.growth}:${w.profitability}:${w.valuation}`; }

function loadCache() {
  try {
    if (existsSync(CACHE_FILE)) {
      const data = JSON.parse(readFileSync(CACHE_FILE, "utf-8")) as Record<string, CacheEntry>;
      for (const [k, v] of Object.entries(data)) {
        if (v.expiresAt > Date.now()) memCache.set(k, v);
      }
    }
  } catch { /* ignore */ }
}
function saveCache() {
  try {
    const data: Record<string, CacheEntry> = {};
    memCache.forEach((v, k) => { data[k] = v; });
    writeFileSync(CACHE_FILE, JSON.stringify(data), "utf-8");
  } catch { /* ignore */ }
}
loadCache();

// ── Score + rank ──────────────────────────────────────────────────────────────

function buildResult(allRows: StockRow[], weights: ScanWeights): ScanResult {
  const scored = allRows.map((r) => {
    if (!hasMinData(r)) return r;
    const s = applyScores(r, weights);
    return { ...s, insight: generateInsight(s), isValuePlay: isValuePlay(s) };
  });
  const valid = scored
    .filter(hasMinData)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((r, i) => ({ ...r, rank: i + 1 }));
  return { allRows: [...valid, ...scored.filter((r) => !hasMinData(r))], valid, top10: valid.slice(0, 10), scannedAt: new Date().toISOString(), weights };
}

function sseEvent(type: string, data?: unknown): string {
  const payload: Record<string, unknown> = { type };
  if (data !== undefined) payload["data"] = data;
  return `data: ${JSON.stringify(payload)}\n\n`;
}

// ── Build StockRow from Finnhub data ─────────────────────────────────────────

function buildFinnhubRow(
  symbol: string,
  quote: Awaited<ReturnType<typeof getFinnhubQuote>>,
  metrics: Awaited<ReturnType<typeof getFinnhubMetrics>>,
  profile: Awaited<ReturnType<typeof getFinnhubProfile>>,
): StockRow {
  if (!quote || quote.c <= 0) return { symbol, error: "no price data" };

  const sf = (v: number | undefined | null): number | undefined =>
    v != null && isFinite(v) ? v : undefined;

  const mc = (metrics?.marketCapitalization ?? 0) * 1_000_000;

  return {
    symbol,
    name:     profile?.name ?? symbol,
    price:    quote.c,
    currency: profile?.currency ?? "USD",
    sector:   profile?.finnhubIndustry ?? "",
    industry: "",
    marketCap:        mc || undefined,
    marketCapDisplay: mc ? fmt_mc(mc, symbol) : "",
    peRatio:          sf(metrics?.peTTM ?? metrics?.peAnnual),
    forwardPE:        undefined,
    pegRatio:         undefined,
    earningsGrowth:   metrics?.epsGrowthTTMYoy    != null ? metrics.epsGrowthTTMYoy    / 100 : undefined,
    revenueGrowth:    metrics?.revenueGrowthTTMYoy != null ? metrics.revenueGrowthTTMYoy / 100 : undefined,
    operatingMargin:  metrics?.operatingMarginTTM  != null ? metrics.operatingMarginTTM  / 100 : undefined,
    profitMargin:     metrics?.netMarginTTM         != null ? metrics.netMarginTTM         / 100 : undefined,
    roe:              metrics?.roeTTM               != null ? metrics.roeTTM               / 100 : undefined,
    debtToEquity:     sf(metrics?.["totalDebt/totalEquityAnnual"]),
    currentRatio:     sf(metrics?.currentRatioAnnual),
    dayChange:        quote.dp,
    fiftyTwoWeekHigh: sf(metrics?.["52WeekHigh"]),
    fiftyTwoWeekLow:  sf(metrics?.["52WeekLow"]),
    financialCurrency: profile?.currency ?? "USD",
  };
}

// ── Finnhub scan ──────────────────────────────────────────────────────────────

const BATCH_SIZE   = 3;   // stocks per batch
const BATCH_DELAY  = 6000; // ms between batches — 3 stocks × 2 calls = 6 calls per 6s = 60/min

async function scanWithFinnhub(
  symbols: string[],
  weights: ScanWeights,
  onRow: (row: StockRow, received: number) => void,
  total: number,
): Promise<StockRow[]> {
  const allRows: StockRow[] = [];

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const batchStart = Date.now();

    await Promise.all(batch.map(async (sym) => {
      try {
        const [quote, metrics, profile] = await Promise.all([
          getFinnhubQuote(sym),
          getFinnhubMetrics(sym),
          getFinnhubProfile(sym),
        ]);
        const row = buildFinnhubRow(sym, quote, metrics, profile);
        allRows.push(row);
        onRow(row, allRows.length);
      } catch {
        const row: StockRow = { symbol: sym, error: "fetch failed" };
        allRows.push(row);
        onRow(row, allRows.length);
      }
    }));

    // Rate-limit: wait remainder of BATCH_DELAY
    if (i + BATCH_SIZE < symbols.length) {
      const elapsed = Date.now() - batchStart;
      const wait = Math.max(0, BATCH_DELAY - elapsed);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }
  }

  return allRows;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const weights: ScanWeights = {
    growth:        Number(sp.get("growth")        ?? 33),
    profitability: Number(sp.get("profitability") ?? 33),
    valuation:     Number(sp.get("valuation")     ?? 34),
  };

  const key = cacheKey(weights);
  const cached = memCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    const body = sseEvent("complete", cached.result as unknown as Record<string, unknown>);
    return new Response(body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
  }

  const allSymbols = Array.from(TICKERS);
  const useFinnhub = !!process.env.FINNHUB_API_KEY;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let closed = false;

      const safeEnqueue = (data: Uint8Array) => {
        if (closed) return;
        try { controller.enqueue(data); } catch { closed = true; }
      };
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      };

      safeEnqueue(enc.encode(sseEvent("start", { total: allSymbols.length, source: useFinnhub ? "finnhub" : "yfinance" })));

      const onRow = (row: StockRow, received: number) => {
        let enriched = row;
        if (hasMinData(row)) {
          const s = applyScores(row, weights);
          enriched = { ...s, insight: generateInsight(s), isValuePlay: isValuePlay(s) };
        }
        putStock(enriched);
        safeEnqueue(enc.encode(sseEvent("stock", { row: enriched, received, total: allSymbols.length })));
      };

      if (useFinnhub) {
        // ── Finnhub path (Node.js, no Python) ──────────────────────────────
        req.signal.addEventListener("abort", () => safeClose());
        try {
          const allRows = await scanWithFinnhub(allSymbols, weights, onRow, allSymbols.length);
          const result = buildResult(allRows, weights);
          memCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
          saveCache();
          safeEnqueue(enc.encode(sseEvent("complete", result)));
        } catch (err) {
          safeEnqueue(enc.encode(sseEvent("error", { message: String(err) })));
        }
        safeClose();

      } else {
        // ── Python/yfinance fallback ──────────────────────────────────────
        const SCRIPT = join(process.cwd(), "src", "scripts", "yf_fetch.py");
        const py = spawn("python3", [SCRIPT, "stream", allSymbols.join(",")], { timeout: 300_000 });
        let buf = "";

        py.stdout.on("data", (chunk: Buffer) => {
          buf += chunk.toString();
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const row = JSON.parse(trimmed) as StockRow;
              onRow(row, 0);
            } catch { /* skip */ }
          }
        });

        py.stderr.on("data", (d: Buffer) => console.error("[yf_fetch stream]", d.toString().slice(0, 200)));

        py.on("close", () => {
          const allRows: StockRow[] = [];
          const result = buildResult(allRows, weights);
          memCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
          saveCache();
          safeEnqueue(enc.encode(sseEvent("complete", result)));
          safeClose();
        });

        py.on("error", (err) => { safeEnqueue(enc.encode(sseEvent("error", { message: err.message }))); safeClose(); });
        req.signal.addEventListener("abort", () => { py.kill(); safeClose(); });
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no" },
  });
}

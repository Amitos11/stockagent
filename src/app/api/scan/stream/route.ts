/**
 * GET /api/scan/stream?growth=33&profitability=33&valuation=34
 *
 * Server-Sent Events endpoint.
 * - Cache hit  → single `complete` event immediately
 * - Cache miss → spawn Python stream command, emit `stock` events as rows
 *   arrive in parallel, then emit `complete` event with full ranked result
 */

import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { join } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { TICKERS } from "@/lib/tickers";
import { hasMinData, applyScores, generateInsight, isValuePlay } from "@/lib/scoring";
import type { ScanWeights, StockRow, ScanResult } from "@/lib/types";

// ── Persistent file cache (survives server restarts, 30-min TTL) ──────────────

interface CacheEntry {
  result: ScanResult;
  expiresAt: number;
}

const CACHE_FILE = join(process.cwd(), ".scan-cache.json");
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const memCache = new Map<string, CacheEntry>();

function cacheKey(weights: ScanWeights) {
  return `${weights.growth}:${weights.profitability}:${weights.valuation}`;
}

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

// Load persisted cache on startup
loadCache();

// ── Score + rank helper (same logic as /api/scan POST) ────────────────────────

function buildResult(allRows: StockRow[], weights: ScanWeights): ScanResult {
  const scored: StockRow[] = allRows.map((r) => {
    if (!hasMinData(r)) return r;
    const s = applyScores(r, weights);
    return { ...s, insight: generateInsight(s), isValuePlay: isValuePlay(s) };
  });

  const valid = scored
    .filter(hasMinData)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((r, i) => ({ ...r, rank: i + 1 }));

  return {
    allRows: [...valid, ...scored.filter((r) => !hasMinData(r))],
    valid,
    top10: valid.slice(0, 10),
    scannedAt: new Date().toISOString(),
    weights,
  };
}

// ── SSE helper ────────────────────────────────────────────────────────────────

function sseEvent(type: string, data?: unknown): string {
  const payload: Record<string, unknown> = { type };
  if (data !== undefined) payload["data"] = data;
  return `data: ${JSON.stringify(payload)}\n\n`;
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
    // Cache hit — return complete event immediately (wrap in data key)
    const body = sseEvent("complete", cached.result as unknown as Record<string, unknown>);
    return new Response(body, {
      headers: {
        "Content-Type":  "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection":    "keep-alive",
      },
    });
  }

  // Cache miss — stream rows from Python
  const SCRIPT = join(process.cwd(), "src", "scripts", "yf_fetch.py");
  const allSymbols = Array.from(TICKERS);

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const allRows: StockRow[] = [];
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

      // Send initial progress event
      safeEnqueue(enc.encode(sseEvent("start", { total: allSymbols.length })));

      const py = spawn("python3", [SCRIPT, "stream", allSymbols.join(",")], {
        timeout: 300_000,
      });

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
            allRows.push(row);

            let enriched = row;
            if (hasMinData(row)) {
              const s = applyScores(row, weights);
              enriched = { ...s, insight: generateInsight(s), isValuePlay: isValuePlay(s) };
            }

            safeEnqueue(enc.encode(sseEvent("stock", { row: enriched, received: allRows.length, total: allSymbols.length })));
          } catch {
            // non-JSON line — skip
          }
        }
      });

      py.stderr.on("data", (d: Buffer) => {
        console.error("[yf_fetch stream]", d.toString().slice(0, 200));
      });

      py.on("close", () => {
        const result = buildResult(allRows, weights);
        memCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
        saveCache();
        safeEnqueue(enc.encode(sseEvent("complete", result)));
        safeClose();
      });

      py.on("error", (err) => {
        safeEnqueue(enc.encode(sseEvent("error", { message: err.message })));
        safeClose();
      });

      req.signal.addEventListener("abort", () => {
        py.kill();
        safeClose();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

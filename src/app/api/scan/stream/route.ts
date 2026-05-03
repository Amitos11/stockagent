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
import { TICKERS } from "@/lib/tickers";
import { hasMinData, applyScores, generateInsight, isValuePlay } from "@/lib/scoring";
import type { ScanWeights, StockRow, ScanResult } from "@/lib/types";

// ── In-memory cache (15-minute TTL) ───────────────────────────────────────────

interface CacheEntry {
  result: ScanResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function cacheKey(weights: ScanWeights) {
  return `${weights.growth}:${weights.profitability}:${weights.valuation}`;
}

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
  const cached = cache.get(key);
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

      // Send initial progress event
      controller.enqueue(enc.encode(sseEvent("start", { total: allSymbols.length })));

      const py = spawn("python", [SCRIPT, "stream", allSymbols.join(",")], {
        timeout: 300_000,
      });

      let buf = "";

      py.stdout.on("data", (chunk: Buffer) => {
        buf += chunk.toString();
        const lines = buf.split("\n");
        buf = lines.pop() ?? ""; // keep incomplete last line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const row = JSON.parse(trimmed) as StockRow;
            allRows.push(row);

            // Score this row immediately so the client can display partial data
            let enriched = row;
            if (hasMinData(row)) {
              const s = applyScores(row, weights);
              enriched = { ...s, insight: generateInsight(s), isValuePlay: isValuePlay(s) };
            }

            controller.enqueue(enc.encode(sseEvent("stock", { row: enriched, received: allRows.length, total: allSymbols.length })));
          } catch {
            // non-JSON line — skip
          }
        }
      });

      py.stderr.on("data", (d: Buffer) => {
        // stderr is informational; don't crash on it
        console.error("[yf_fetch stream]", d.toString().slice(0, 200));
      });

      py.on("close", () => {
        // Build final ranked result
        const result = buildResult(allRows, weights);

        // Cache it
        cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });

        controller.enqueue(enc.encode(sseEvent("complete", result)));
        controller.close();
      });

      py.on("error", (err) => {
        controller.enqueue(enc.encode(sseEvent("error", { message: err.message })));
        controller.close();
      });

      // Abort if client disconnects
      req.signal.addEventListener("abort", () => {
        py.kill();
        controller.close();
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

import { NextRequest, NextResponse } from "next/server";
import { fetchEarningsBatch } from "@/lib/fetcher";
import type { EarningsHistory } from "@/lib/types";

export const dynamic = "force-dynamic";

// Per-symbol cache — earnings surprise only changes once a quarter.
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const cache = new Map<string, { data: EarningsHistory; expiresAt: number }>();

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 40); // hard cap per request

  const now = Date.now();
  const out: Record<string, EarningsHistory> = {};
  const missing: string[] = [];

  for (const sym of symbols) {
    const hit = cache.get(sym);
    if (hit && hit.expiresAt > now) out[sym] = hit.data;
    else missing.push(sym);
  }

  if (missing.length) {
    const fetched = await fetchEarningsBatch(missing);
    for (const sym of missing) {
      const data = fetched[sym];
      if (data) {
        cache.set(sym, { data, expiresAt: now + TTL_MS });
        out[sym] = data;
      }
    }
  }

  return NextResponse.json(out);
}

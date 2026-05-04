/**
 * Shared in-memory stock cache.
 * Populated by the scan stream; read by individual stock lookups.
 * TTL: 30 minutes.
 */
import type { StockRow } from "./types";

const TTL_MS = 30 * 60 * 1000;

interface Entry {
  row: StockRow;
  expiresAt: number;
}

const cache = new Map<string, Entry>();

export function putStock(row: StockRow) {
  if (!row.symbol) return;
  cache.set(row.symbol.toUpperCase(), { row, expiresAt: Date.now() + TTL_MS });
}

export function getStock(symbol: string): StockRow | null {
  const entry = cache.get(symbol.toUpperCase());
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { cache.delete(symbol.toUpperCase()); return null; }
  return entry.row;
}

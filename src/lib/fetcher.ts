/**
 * Data fetcher — delegates to yf_fetch.py via Python subprocess.
 * Identical data pipeline to the original Streamlit app.
 */

import { execFile } from "child_process";
import { join } from "path";
import type {
  StockRow, NewsItem, Management, QuarterlyData,
  ForwardEstimates, EarningsHistory, CandleData,
} from "./types";

// ── subprocess helper ──────────────────────────────────────────────────────────

const SCRIPT = join(process.cwd(), "src", "scripts", "yf_fetch.py");

function runPython(cmd: string, arg: string, timeoutMs = 30_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    execFile(
      "python",
      [SCRIPT, cmd, arg],
      { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          // Try to parse whatever stdout we got first
          const trimmed = stdout?.trim();
          if (trimmed) {
            try { return resolve(JSON.parse(trimmed)); } catch { /* fall through */ }
          }
          return reject(new Error(stderr?.slice(0, 200) ?? err.message));
        }
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          reject(new Error(`JSON parse error: ${stdout.slice(0, 200)}`));
        }
      }
    );
  });
}

// ── public API ─────────────────────────────────────────────────────────────────

export async function fetchStock(symbol: string): Promise<StockRow> {
  try {
    const data = await runPython("stock", symbol, 25_000) as StockRow;
    return data;
  } catch (err) {
    return { symbol, error: `fetch failed: ${String(err).slice(0, 80)}` };
  }
}

export async function fetchBatch(symbols: string[]): Promise<StockRow[]> {
  try {
    const data = await runPython("batch", symbols.join(","), 120_000) as StockRow[];
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return symbols.map((s) => ({ symbol: s, error: String(err).slice(0, 80) }));
  }
}

export async function fetchCandleHistory(symbol: string): Promise<CandleData[]> {
  try {
    const data = await runPython("candles", symbol, 20_000) as CandleData[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchNews(symbol: string): Promise<NewsItem[]> {
  try {
    const data = await runPython("news", symbol, 15_000) as NewsItem[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Returns management + quarterly + forward estimates + last earnings */
async function fetchEnrich(symbol: string): Promise<{
  management: Management;
  quarterly: QuarterlyData;
  forecasts: ForwardEstimates;
  lastEarnings: EarningsHistory;
}> {
  try {
    const data = await runPython("enrich", symbol, 30_000) as {
      management?: Management;
      quarterly?: QuarterlyData;
      forecasts?: ForwardEstimates;
      lastEarnings?: EarningsHistory;
    };
    return {
      management:  data.management  ?? {},
      quarterly:   data.quarterly   ?? {},
      forecasts:   data.forecasts   ?? {},
      lastEarnings: data.lastEarnings ?? {},
    };
  } catch {
    return { management: {}, quarterly: {}, forecasts: {}, lastEarnings: {} };
  }
}

export async function fetchManagement(symbol: string): Promise<Management> {
  return (await fetchEnrich(symbol)).management;
}

export async function fetchQuarterly(symbol: string): Promise<QuarterlyData> {
  return (await fetchEnrich(symbol)).quarterly;
}

export async function fetchForwardEstimates(symbol: string): Promise<ForwardEstimates> {
  return (await fetchEnrich(symbol)).forecasts;
}

export async function fetchEarningsHistory(symbol: string): Promise<EarningsHistory> {
  return (await fetchEnrich(symbol)).lastEarnings;
}

/** Full enrichment in one Python call (used by Top 10) */
export async function fetchFullEnrich(symbol: string): Promise<{
  news: NewsItem[];
  management: Management;
  quarterly: QuarterlyData;
  forecasts: ForwardEstimates;
  lastEarnings: EarningsHistory;
}> {
  const [news, enrich] = await Promise.all([
    fetchNews(symbol),
    fetchEnrich(symbol),
  ]);
  return { news, ...enrich };
}

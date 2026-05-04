import { NextRequest, NextResponse } from "next/server";
import { getFinnhubCandles } from "@/lib/finnhub";
import { fetchCandleHistory } from "@/lib/fetcher";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const sym = symbol.toUpperCase().replace(/\.TA$/, ""); // Finnhub doesn't support TASE

  // Try Finnhub first (fast, no rate limit)
  const fhCandles = await getFinnhubCandles(sym);
  if (fhCandles.length > 0) {
    return NextResponse.json(fhCandles);
  }

  // Fallback: yfinance via Python
  const candles = await fetchCandleHistory(symbol.toUpperCase());
  return NextResponse.json(candles);
}

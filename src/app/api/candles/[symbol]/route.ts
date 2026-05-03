import { NextRequest, NextResponse } from "next/server";
import { fetchCandleHistory } from "@/lib/fetcher";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const candles = await fetchCandleHistory(symbol.toUpperCase());
  return NextResponse.json(candles);
}

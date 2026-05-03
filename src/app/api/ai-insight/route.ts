import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { StockRow } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { stock, apiKey }: { stock: StockRow; apiKey: string } = body;

  if (!apiKey?.startsWith("sk-")) {
    return NextResponse.json({ error: "Invalid OpenAI API key" }, { status: 400 });
  }
  if (!stock?.symbol) {
    return NextResponse.json({ error: "No stock provided" }, { status: 400 });
  }

  try {
    const client = new OpenAI({ apiKey });

    const {
      symbol, name = "", sector = "",
      peRatio, forwardPE, earningsGrowth, revenueGrowth,
      operatingMargin, roe, debtToEquity,
      forecasts, lastEarnings, news = [],
    } = stock;

    const metrics: string[] = [];
    if (peRatio   != null) metrics.push(`Trailing P/E: ${peRatio.toFixed(1)}`);
    if (forwardPE != null) metrics.push(`Forward P/E: ${forwardPE.toFixed(1)}`);
    if (earningsGrowth != null) metrics.push(`EPS YoY: ${(earningsGrowth*100).toFixed(0)}%`);
    if (revenueGrowth  != null) metrics.push(`Revenue YoY: ${(revenueGrowth*100).toFixed(0)}%`);
    if (operatingMargin!= null) metrics.push(`Op Margin: ${(operatingMargin*100).toFixed(0)}%`);
    if (roe            != null) metrics.push(`ROE: ${(roe*100).toFixed(0)}%`);
    if (debtToEquity   != null) metrics.push(`D/E: ${debtToEquity.toFixed(0)}`);

    // Forward estimates
    const fwd: string[] = [];
    if (forecasts?.nextQEps     != null) fwd.push(`Fwd EPS (Q): $${forecasts.nextQEps.toFixed(2)}`);
    if (forecasts?.nextQRevenue != null) fwd.push(`Fwd Rev (Q): $${(forecasts.nextQRevenue/1e9).toFixed(1)}B`);
    if (forecasts?.nextYEps     != null) fwd.push(`Fwd EPS (Y): $${forecasts.nextYEps.toFixed(2)}`);
    if (forecasts?.nextYRevenue != null) fwd.push(`Fwd Rev (Y): $${(forecasts.nextYRevenue/1e9).toFixed(1)}B`);

    // Last earnings
    let earningsText = "";
    if (lastEarnings?.epsActual != null && lastEarnings?.epsEstimate != null) {
      const beat = lastEarnings.beat ? "BEAT" : "MISSED";
      earningsText = `\nLast earnings: ${beat} — Actual $${lastEarnings.epsActual.toFixed(2)} vs Est $${lastEarnings.epsEstimate.toFixed(2)}`;
      if (lastEarnings.surprisePct != null) {
        earningsText += ` (surprise: ${(lastEarnings.surprisePct*100).toFixed(1)}%)`;
      }
    }

    const newsText = news.length
      ? "\nRecent headlines:\n" + news.map(n => `- ${(n.title || "").slice(0, 120)}`).join("\n")
      : "";

    const userMsg = [
      `Stock: ${symbol} (${name}) — Sector: ${sector}`,
      `Metrics: ${metrics.join(", ") || "limited data"}`,
      fwd.length ? `Forward estimates: ${fwd.join(", ")}` : "",
      earningsText,
      newsText,
      "\nProduce the analysis with the three-section structure described in the system prompt.",
    ].filter(Boolean).join("\n");

    const systemMsg = [
      "You are a financial data analyst writing concise stock analyses.",
      "Output MUST use this EXACT three-section structure with the emoji headers:\n",
      "📈 Technical / Momentum:",
      "<2 sentences describing the 30-day price trend (upward/downward/sideways), approximate range, where current price sits, and momentum direction. Use observational language only.>\n",
      "📊 Forward Valuation:",
      "<2 sentences comparing Trailing P/E to Forward P/E and any forward EPS/revenue estimates. Explain what analysts expect. Connect to news if relevant.>\n",
      "🔥 Hot Themes / Growth Drivers:",
      "<2 sentences identifying sector tailwinds or industry trends the company is currently positioned within. Describe POSITIONING, not predictions.>\n",
      "STRICT RULES:",
      "- NEVER use 'buy', 'sell', 'should', 'recommend', 'target price'",
      "- NEVER predict future prices",
      "- Use observational language only ('the data shows', 'metrics suggest', 'the trend has been')",
      "- Maximum 2 sentences per section",
      "- English output",
      "- Always include all three emoji-prefixed section headers exactly as shown",
    ].join("\n");

    const response = await client.chat.completions.create({
      model:       "gpt-4o-mini",
      messages:    [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }],
      max_tokens:  500,
      temperature: 0.3,
    });

    return NextResponse.json({ insight: response.choices[0].message.content?.trim() ?? "" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 });
  }
}

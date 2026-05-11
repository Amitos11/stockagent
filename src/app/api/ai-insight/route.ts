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
      price, dayChange, fiftyTwoWeekHigh, fiftyTwoWeekLow,
      peRatio, forwardPE, earningsGrowth, revenueGrowth,
      operatingMargin, roe, debtToEquity, score,
      forecasts, lastEarnings, news = [],
    } = stock;

    // Price / momentum context
    const priceLines: string[] = [];
    if (price != null) priceLines.push(`Current price: $${price.toFixed(2)}`);
    if (dayChange != null) priceLines.push(`Day change: ${dayChange >= 0 ? "+" : ""}${dayChange.toFixed(2)}%`);
    if (fiftyTwoWeekLow != null && fiftyTwoWeekHigh != null && price != null) {
      const pct = ((price - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow) * 100).toFixed(0);
      priceLines.push(`52-week range: $${fiftyTwoWeekLow.toFixed(2)}–$${fiftyTwoWeekHigh.toFixed(2)} (currently at ${pct}% of range)`);
    }
    if (score != null) priceLines.push(`Composite score: ${score.toFixed(1)}/100`);

    const metrics: string[] = [];
    if (peRatio        != null) metrics.push(`Trailing P/E: ${peRatio.toFixed(1)}`);
    if (forwardPE      != null) metrics.push(`Forward P/E: ${forwardPE.toFixed(1)}`);
    if (earningsGrowth != null) metrics.push(`EPS YoY: ${(earningsGrowth*100).toFixed(0)}%`);
    if (revenueGrowth  != null) metrics.push(`Revenue YoY: ${(revenueGrowth*100).toFixed(0)}%`);
    if (operatingMargin!= null) metrics.push(`Op Margin: ${(operatingMargin*100).toFixed(0)}%`);
    if (roe            != null) metrics.push(`ROE: ${(roe*100).toFixed(0)}%`);
    if (debtToEquity   != null) metrics.push(`D/E: ${debtToEquity.toFixed(0)}`);

    const fwd: string[] = [];
    if (forecasts?.nextQEps     != null) fwd.push(`Fwd EPS (Q): $${forecasts.nextQEps.toFixed(2)}`);
    if (forecasts?.nextQRevenue != null) fwd.push(`Fwd Rev (Q): $${(forecasts.nextQRevenue/1e9).toFixed(1)}B`);
    if (forecasts?.nextYEps     != null) fwd.push(`Fwd EPS (Y): $${forecasts.nextYEps.toFixed(2)}`);
    if (forecasts?.nextYRevenue != null) fwd.push(`Fwd Rev (Y): $${(forecasts.nextYRevenue/1e9).toFixed(1)}B`);

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
      priceLines.length ? `Price data: ${priceLines.join(" | ")}` : "",
      `Fundamentals: ${metrics.join(", ") || "limited data"}`,
      fwd.length ? `Forward estimates: ${fwd.join(", ")}` : "",
      earningsText,
      newsText,
      "\nProduce the analysis with the three-section structure described in the system prompt.",
    ].filter(Boolean).join("\n");

    const systemMsg = [
      "You are a financial data analyst writing concise, data-driven stock analyses based ONLY on the numbers provided.",
      "Output MUST use this EXACT three-section structure:\n",
      "📈 Price & Momentum:",
      "<2 sentences. Use the exact price, day-change %, and 52-week range position provided. State whether the stock is near its 52-week high or low, and describe the day's movement. Be specific with numbers.>\n",
      "📊 Valuation & Estimates:",
      "<2 sentences. Compare Trailing P/E to Forward P/E — if Forward P/E is lower, earnings growth is expected. Reference any analyst estimates or last earnings beat/miss if provided.>\n",
      "🔥 Fundamentals Snapshot:",
      "<2 sentences. Highlight the strongest or weakest fundamental metric (EPS growth, revenue growth, operating margin, ROE). Tie it to the composite score if available.>\n",
      "STRICT RULES:",
      "- Use ONLY the data provided — do not invent numbers",
      "- NEVER use 'buy', 'sell', 'should', 'recommend'",
      "- NEVER predict future prices",
      "- Be specific: mention actual numbers from the data",
      "- Maximum 2 sentences per section",
      "- English only",
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

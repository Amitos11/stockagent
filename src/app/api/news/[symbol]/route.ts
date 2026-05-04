import { NextRequest, NextResponse } from "next/server";
import { getFinnhubNews } from "@/lib/finnhub";

const POSITIVE = new Set(["surge","jump","rally","beat","gain","profit","growth","strong","record","rise","soar","upgrade"]);
const NEGATIVE = new Set(["crash","drop","fall","miss","loss","decline","weak","slump","downgrade","layoff","cut","warning"]);

function sentiment(title: string) {
  const words = new Set(title.toLowerCase().split(/\W+/));
  const pos = [...words].filter((w) => POSITIVE.has(w)).length;
  const neg = [...words].filter((w) => NEGATIVE.has(w)).length;
  return pos > neg ? "positive" : neg > pos ? "negative" : "neutral";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const ticker = symbol.replace(/\.[A-Z]+$/, ""); // strip .TA etc

  // ── Try Finnhub first ──────────────────────────────────────────────────────
  const fhNews = await getFinnhubNews(ticker, 7);
  if (fhNews.length > 0) {
    const articles = fhNews.slice(0, 3).map((n) => ({
      title:     n.headline,
      url:       n.url,
      source:    n.source,
      published: new Date(n.datetime * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      sentiment: sentiment(n.headline),
    }));
    return NextResponse.json({ articles });
  }

  // ── Fallback: NewsAPI ──────────────────────────────────────────────────────
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return NextResponse.json({ articles: [] });

  const companyName = req.nextUrl.searchParams.get("name") ?? "";
  const q = companyName
    ? `"${companyName}" AND (stock OR earnings OR shares OR investor OR market)`
    : `"${ticker}" AND (stock OR earnings OR shares OR investor OR market)`;

  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", q);
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "5");
  url.searchParams.set("apiKey", apiKey);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 600 } });
    if (!res.ok) return NextResponse.json({ articles: [] });
    const data = await res.json() as { articles?: { title: string; url: string; source: { name: string }; publishedAt: string }[] };
    const articles = (data.articles ?? [])
      .filter((a) => a.title && !a.title.includes("[Removed]"))
      .slice(0, 2)
      .map((a) => ({
        title:     a.title,
        url:       a.url,
        source:    a.source?.name ?? "",
        published: a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
        sentiment: sentiment(a.title),
      }));
    return NextResponse.json({ articles });
  } catch {
    return NextResponse.json({ articles: [] });
  }
}

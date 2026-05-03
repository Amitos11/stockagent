import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "NEWS_API_KEY not configured" }, { status: 500 });
  }

  // Optional company name passed as ?name=Apple+Inc
  const companyName = req.nextUrl.searchParams.get("name") ?? "";

  // Strip exchange suffix (e.g. "TEVA.TA" → "TEVA")
  const ticker = symbol.replace(/\.[A-Z]+$/, "");

  // Build a focused financial query:
  // If we have the company name, use it; otherwise fall back to ticker + stock keywords
  const q = companyName
    ? `"${companyName}" AND (stock OR earnings OR shares OR investor OR market)`
    : `"${ticker}" AND (stock OR earnings OR shares OR investor OR market)`;

  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", q);
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "5"); // fetch 5, filter junk, keep 2
  url.searchParams.set("apiKey", apiKey);

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 600 },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text.slice(0, 120) }, { status: res.status });
    }

    const data = await res.json() as {
      articles?: {
        title: string;
        url: string;
        source: { name: string };
        publishedAt: string;
        description: string | null;
      }[];
    };

    // Filter out articles with [Removed] titles (NewsAPI placeholder)
    const articles = (data.articles ?? [])
      .filter((a) => a.title && !a.title.includes("[Removed]"))
      .slice(0, 2)
      .map((a) => ({
        title:     a.title,
        url:       a.url,
        source:    a.source?.name ?? "",
        published: a.publishedAt
          ? new Date(a.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "",
      }));

    return NextResponse.json({ articles });
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 120) }, { status: 500 });
  }
}

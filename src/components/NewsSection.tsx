"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Loader2, Newspaper } from "lucide-react";

interface Article {
  title: string;
  url: string;
  source: string;
  published: string;
}

interface NewsSectionProps {
  symbol: string;
  name?: string;
}

export function NewsSection({ symbol, name }: NewsSectionProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setArticles([]);

    const qs = name ? `?name=${encodeURIComponent(name)}` : "";
    fetch(`/api/news/${encodeURIComponent(symbol)}${qs}`)
      .then((r) => r.json())
      .then((data: { articles?: Article[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        else setArticles(data.articles ?? []);
      })
      .catch((e) => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [symbol, name]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
        <Loader2 size={12} className="animate-spin" />
        Loading news…
      </div>
    );
  }

  if (error || articles.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
        <Newspaper size={12} />
        {error ? "Could not load news" : "No recent news found"}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {articles.map((a, i) => (
        <a
          key={i}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 hover:bg-amber-50 hover:border-amber-100 border border-transparent transition-all group"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-700 group-hover:text-amber-700 line-clamp-2 transition-colors leading-snug">
              {a.title}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
              <span>{a.source}</span>
              {a.published && <><span>·</span><span>{a.published}</span></>}
            </div>
          </div>
          <ExternalLink size={13} className="flex-shrink-0 mt-0.5 text-slate-300 group-hover:text-amber-400 transition-colors" />
        </a>
      ))}
    </div>
  );
}

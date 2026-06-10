"use client";

export type TabId = "top10" | "all" | "value" | "watchlist" | "sectors" | "heatmap";

const TAB_LIST: { id: TabId; label: string }[] = [
  { id: "top10",     label: "Top 10" },
  { id: "all",       label: "All" },
  { id: "value",     label: "Value plays" },
  { id: "watchlist", label: "Watchlist" },
  { id: "sectors",   label: "Sectors" },
  { id: "heatmap",   label: "Heatmap" },
];

interface Props {
  tab: TabId;
  setTab: (t: TabId) => void;
  counts: Partial<Record<TabId, number>>;
}

export function Tabs({ tab, setTab, counts }: Props) {
  return (
    <div className="tabs" role="tablist">
      {TAB_LIST.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={tab === t.id}
          className={`tab-btn${tab === t.id ? " on" : ""}`}
          onClick={() => setTab(t.id)}
        >
          {t.label}
          {counts[t.id] != null ? (
            <span className="tab-count num">{counts[t.id]}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

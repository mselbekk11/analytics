import { useState } from "react";

// The chart's series, one per stat tile. The tiles switch them on and off, and the
// choice is kept per browser.

export const SERIES_KEYS = [
  "visitors",
  "pageviews",
  "revenue",
  "conversionRate",
  "goal",
  "bounceRate",
  "visitDuration",
] as const;

export type SeriesKey = (typeof SERIES_KEYS)[number];

/** Monochrome: the foreground for Visitors and Revenue, greys for the rest. */
export const SERIES_COLOR: Record<SeriesKey, string> = {
  visitors: "var(--chart-1)",
  pageviews: "var(--chart-2)",
  revenue: "var(--chart-1)",
  conversionRate: "var(--chart-4)",
  goal: "var(--chart-3)",
  bounceRate: "var(--chart-2)",
  visitDuration: "var(--chart-4)",
};

/** Series on the chart until the owner picks others. */
export const DEFAULT_SERIES: SeriesKey[] = ["visitors", "pageviews", "revenue", "goal"];

const STORAGE_KEY = "dashboard.chartSeries";

function load(): SeriesKey[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (Array.isArray(parsed)) return SERIES_KEYS.filter((k) => parsed.includes(k));
  } catch {
    // No storage (private window, blocked site data): the defaults
  }
  return DEFAULT_SERIES;
}

function save(keys: SeriesKey[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Not remembered, but the chart still changes
  }
}

/**
 * The series shown out of those the site has, and a toggle that keeps at least one on.
 * The stored choice keeps series this site lacks (Revenue, say), so another site's
 * chart keeps them.
 */
export function useChartSeries(available: SeriesKey[]): {
  shown: SeriesKey[];
  toggle: (key: SeriesKey) => void;
} {
  const [chosen, setChosen] = useState<SeriesKey[]>(load);
  const picked = chosen.filter((k) => available.includes(k));
  const fallback = DEFAULT_SERIES.filter((k) => available.includes(k));
  const shown = picked.length > 0 ? picked : fallback.length > 0 ? fallback : available.slice(0, 1);

  function toggle(key: SeriesKey) {
    const on = shown.includes(key);
    if (on && shown.length === 1) return;
    const base = [...new Set([...chosen, ...shown])];
    const next = on ? base.filter((k) => k !== key) : [...base, key];
    const ordered = SERIES_KEYS.filter((k) => next.includes(k));
    setChosen(ordered);
    save(ordered);
  }

  return { shown, toggle };
}

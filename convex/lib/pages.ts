import { v, type Infer } from "convex/values";
import { rankEntries, type DimEntry } from "./dims";
import { percentChange } from "./ranges";

// The Pages tab's table (design v4): every page in the range with its counts and a trend
// series, sorted, searched and cut into pages of rows here, so the browser only gets the
// rows it shows.

export const PAGE_SORTS = ["path", "trend", "views", "sessions", "bounce", "duration", "revenue"] as const;

export type PageSort = (typeof PAGE_SORTS)[number];

export const pageSortValidator = v.union(...PAGE_SORTS.map((s) => v.literal(s)));

export const PAGE_ROWS = 50;

/**
 * One page's counts over the range (see PageStats), its sessions over the period before,
 * and its pageviews at each point of the range.
 */
export type PageEntry = DimEntry & PageStats & { previousSessions: number; trend: number[] };

/** What a page row counts besides pageviews (rollups.PageDelta), summed over a range. */
export type PageStats = { entries: number; bounces: number; engagedMs: number; durationCount: number };

export function emptyPageEntry(key: string, points: number): PageEntry {
  return {
    key,
    pageviews: 0,
    visitors: 0,
    sessions: 0,
    events: 0,
    revenueMinor: 0,
    entries: 0,
    bounces: 0,
    engagedMs: 0,
    durationCount: 0,
    previousSessions: 0,
    trend: Array.from({ length: points }, () => 0),
  };
}

export const pageRow = v.object({
  path: v.string(),
  /** The latest title the page was seen with; null for pages from before titles were sent */
  title: v.union(v.null(), v.string()),
  views: v.number(),
  /** Sessions that viewed the page; 0 on cookieless days */
  sessions: v.number(),
  /** Against the period before; null with none then, or when visitor tracking started in between */
  sessionsChange: v.union(v.null(), v.number()),
  /** Bounces ÷ sessions that started on the page; null when none did */
  bounceRate: v.union(v.null(), v.number()),
  /** Average engaged time per pageview that sent any; null when none did */
  durationMs: v.union(v.null(), v.number()),
  revenueMinor: v.number(),
  /** Pageviews per day (or per hour on hour ranges), oldest first */
  trend: v.array(v.number()),
});

export type PageRow = Infer<typeof pageRow>;

/**
 * How fast a page is rising or falling: the least-squares slope of its series over its
 * mean, so a small page that doubles ranks above a big one that grows a little.
 */
export function trendScore(series: number[]): number {
  const n = series.length;
  if (n < 2) return 0;
  const mean = series.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;
  const mid = (n - 1) / 2;
  let num = 0;
  let den = 0;
  series.forEach((y, x) => {
    num += (x - mid) * (y - mean);
    den += (x - mid) ** 2;
  });
  return num / den / mean;
}

export function bounceRate(e: PageStats): number | null {
  return e.entries === 0 ? null : e.bounces / e.entries;
}

export function avgDuration(e: PageStats): number | null {
  return e.durationCount === 0 ? null : Math.round(e.engagedMs / e.durationCount);
}

// null (no sessions started there, no time sent) sorts after every number, either way
const VALUE: Record<PageSort, (e: PageEntry) => number | null> = {
  path: () => 0,
  trend: (e) => trendScore(e.trend),
  views: (e) => e.pageviews,
  sessions: (e) => e.sessions,
  bounce: bounceRate,
  duration: avgDuration,
  revenue: (e) => e.revenueMinor,
};

/**
 * The pages with any pageviews whose path or title contains `search` (ignoring case), sorted by
 * `sort` (ties keep views, then path), and the `limit` rows from `offset`, moved back to
 * the last page of rows if it is past the end. `matched` counts every page the search
 * kept, `pages` every page in the range.
 */
export function pageTable(
  entries: PageEntry[],
  opts: {
    sort: PageSort;
    desc: boolean;
    search: string;
    offset: number;
    limit?: number;
    /** False when visitor tracking started in the period before or this one: no session changes */
    comparable: boolean;
    /** Page titles by path: searched with the paths, and put on the rows */
    titles?: Map<string, string>;
  },
): { rows: PageRow[]; offset: number; matched: number; pages: number } {
  // rankEntries keeps pages with views (or revenue) and orders them by views, then path
  const all = rankEntries("page", entries) as PageEntry[];
  const needle = opts.search.trim().toLowerCase();
  const title = (path: string) => opts.titles?.get(path) ?? null;
  const kept =
    needle === ""
      ? all
      : all.filter((e) => e.key.toLowerCase().includes(needle) || title(e.key)?.toLowerCase().includes(needle));
  const dir = opts.desc ? -1 : 1;
  const value = VALUE[opts.sort];
  // Sorting is stable, so equal values keep the views order
  const sorted = [...kept].sort((a, b) => {
    if (opts.sort === "path") return dir * a.key.localeCompare(b.key, "en", { numeric: true });
    const x = value(a);
    const y = value(b);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    return dir * (x - y);
  });
  const limit = opts.limit ?? PAGE_ROWS;
  const last = Math.max(0, Math.ceil(sorted.length / limit) - 1) * limit;
  const offset = Math.min(Math.max(0, Math.floor(opts.offset / limit) * limit), last);
  return {
    rows: sorted.slice(offset, offset + limit).map((e) => ({
      path: e.key,
      title: title(e.key),
      views: e.pageviews,
      sessions: e.sessions,
      sessionsChange: opts.comparable ? percentChange(e.sessions, e.previousSessions) : null,
      bounceRate: bounceRate(e),
      durationMs: avgDuration(e),
      revenueMinor: e.revenueMinor,
      trend: e.trend,
    })),
    offset,
    matched: kept.length,
    pages: all.length,
  };
}

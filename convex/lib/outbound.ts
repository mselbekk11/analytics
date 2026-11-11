import { v, type Infer } from "convex/values";
import { percentChange } from "./ranges";
import { trendScore } from "./pages";

// The Outbound tab (launch v1 Phase 9): clicks on links to other sites, from the outbound
// events the script already sends (origin + path). Links are grouped by host and path, so
// http and https, and a trailing slash, are one link. The table is sorted, searched and
// cut into pages here, as the Pages tab's is, so the browser only gets the rows it shows.

export const LINK_SORTS = ["link", "trend", "clicks", "visitors"] as const;

export type LinkSort = (typeof LINK_SORTS)[number];

export const linkSortValidator = v.union(...LINK_SORTS.map((s) => v.literal(s)));

export const LINK_ROWS = 50;

/**
 * The key a link is grouped by: its host and path, without the scheme or a trailing
 * slash ("github.com/acme/widget", "docs.stripe.com"). Anything that isn't a URL is kept
 * as sent, without its scheme.
 */
export function linkKey(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.host}${path}`;
  } catch {
    return url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/+$/, "");
  }
}

/** A link key's host and path ("" for the site's root). */
export function splitLinkKey(key: string): { host: string; path: string } {
  const slash = key.indexOf("/");
  return slash === -1 ? { host: key, path: "" } : { host: key.slice(0, slash), path: key.slice(slash) };
}

/**
 * One link over the range: its clicks, visitors (once per link, per day on the rollups),
 * visitors over the period before, clicks at each point of the range, and the URL it was
 * clicked as most (what the row opens).
 */
export type LinkEntry = {
  key: string;
  url: string;
  clicks: number;
  visitors: number;
  previousVisitors: number;
  trend: number[];
};

/** One outbound URL as it was stored, before grouping. */
export type RawLink = Omit<LinkEntry, "key">;

/**
 * Merges URLs into links by host and path (see linkKey): counts and trends add up, and
 * the link keeps the URL with the most clicks (ties A to Z).
 */
export function groupLinks(raw: RawLink[]): LinkEntry[] {
  const byKey = new Map<string, LinkEntry & { urlClicks: number }>();
  for (const r of raw) {
    const key = linkKey(r.url);
    const e = byKey.get(key);
    if (!e) {
      byKey.set(key, { ...r, key, trend: [...r.trend], urlClicks: r.clicks });
      continue;
    }
    e.clicks += r.clicks;
    e.visitors += r.visitors;
    e.previousVisitors += r.previousVisitors;
    r.trend.forEach((n, i) => (e.trend[i] = (e.trend[i] ?? 0) + n));
    if (r.clicks > e.urlClicks || (r.clicks === e.urlClicks && r.url < e.url)) {
      e.url = r.url;
      e.urlClicks = r.clicks;
    }
  }
  return [...byKey.values()].map((e) => ({
    key: e.key,
    url: e.url,
    clicks: e.clicks,
    visitors: e.visitors,
    previousVisitors: e.previousVisitors,
    trend: e.trend,
  }));
}

/** The range's totals and the period before's, for the tiles. */
export const linkTotals = v.object({
  clicks: v.number(),
  previousClicks: v.number(),
  /** Each link's visitors, added up: a visitor counts once per link (and day on the rollups) */
  unique: v.number(),
  previousUnique: v.number(),
  /** Links with any clicks */
  links: v.number(),
  previousLinks: v.number(),
});

export type LinkTotals = Infer<typeof linkTotals>;

/**
 * The four tiles and their change against the period before. Unique clicks' change is
 * left out when visitor tracking started in this period or the one before (`comparable`
 * false), and clicks per link has none without links.
 */
export function linkTiles(t: LinkTotals, comparable: boolean) {
  const perLink = t.links === 0 ? null : t.clicks / t.links;
  const previousPerLink = t.previousLinks === 0 ? null : t.previousClicks / t.previousLinks;
  return {
    clicks: { value: t.clicks, change: percentChange(t.clicks, t.previousClicks) },
    unique: { value: t.unique, change: comparable ? percentChange(t.unique, t.previousUnique) : null },
    links: { value: t.links, change: percentChange(t.links, t.previousLinks) },
    perLink: {
      value: perLink,
      change: perLink === null || previousPerLink === null ? null : percentChange(perLink, previousPerLink),
    },
  };
}

export const linkRow = v.object({
  /** Host and path, the grouping key */
  key: v.string(),
  /** The URL as clicked most, which the row opens */
  url: v.string(),
  clicks: v.number(),
  visitors: v.number(),
  /** Against the period before; null with none then, or when visitor tracking started in between */
  visitorsChange: v.union(v.null(), v.number()),
  /** Clicks per day (or per hour on hour ranges), oldest first */
  trend: v.array(v.number()),
});

export type LinkRow = Infer<typeof linkRow>;

// Ties keep clicks (then the key) order
const VALUE: Record<Exclude<LinkSort, "link">, (e: LinkEntry) => number> = {
  trend: (e) => trendScore(e.trend),
  clicks: (e) => e.clicks,
  visitors: (e) => e.visitors,
};

/**
 * The links with clicks whose host and path contain `search` (ignoring case), sorted by
 * `sort`, and the `limit` rows from `offset`, moved back to the last page of rows if it is
 * past the end. `matched` counts the links the search kept, `links` every link with clicks.
 */
export function linkTable(
  entries: LinkEntry[],
  opts: { sort: LinkSort; desc: boolean; search: string; offset: number; limit?: number; comparable: boolean },
): { rows: LinkRow[]; offset: number; matched: number; links: number } {
  const all = entries
    .filter((e) => e.clicks > 0)
    .sort((a, b) => b.clicks - a.clicks || b.visitors - a.visitors || a.key.localeCompare(b.key));
  const needle = opts.search.trim().toLowerCase();
  const kept = needle === "" ? all : all.filter((e) => e.key.toLowerCase().includes(needle));
  const dir = opts.desc ? -1 : 1;
  const sort = opts.sort;
  // Sorting is stable, so equal values keep the clicks order
  const sorted =
    sort === "link"
      ? [...kept].sort((a, b) => dir * a.key.localeCompare(b.key, "en", { numeric: true }))
      : [...kept].sort((a, b) => dir * (VALUE[sort](a) - VALUE[sort](b)));
  const limit = opts.limit ?? LINK_ROWS;
  const last = Math.max(0, Math.ceil(sorted.length / limit) - 1) * limit;
  const offset = Math.min(Math.max(0, Math.floor(opts.offset / limit) * limit), last);
  return {
    rows: sorted.slice(offset, offset + limit).map((e) => ({
      key: e.key,
      url: e.url,
      clicks: e.clicks,
      visitors: e.visitors,
      visitorsChange: opts.comparable ? percentChange(e.visitors, e.previousVisitors) : null,
      trend: e.trend,
    })),
    offset,
    matched: kept.length,
    links: all.length,
  };
}

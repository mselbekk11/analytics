import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { requireReadableSite } from "./lib/auth";
import { hourWindow as hourBounds } from "./lib/dates";
import { dayWindow, filteredOutbound, hourWindow } from "./lib/filtered";
import { filterValidator, MAX_FILTER_DAYS, MAX_FILTERS } from "./lib/filters";
import {
  groupLinks,
  linkKey,
  linkRow,
  linkSortValidator,
  linkTable,
  linkTotals,
  type LinkEntry,
  type LinkTotals,
  type RawLink,
} from "./lib/outbound";
import { eachDate, isValidRange, previousRange, rangeDays, type DateRange } from "./lib/ranges";
import { rangeArg } from "./pages";

// The Outbound tab (launch v1 Phase 9). Like the Pages tab, day ranges read the daily
// rollups (the rows the Analytics Outbound list sums), and filters or hour ranges go
// through the filtered view, so the totals are that list's for the same range.

// One row per outbound URL and day
const MAX_LINK_ROWS = 15_000;
// Rows read for the period before; past it no change is shown
const MAX_PREVIOUS_ROWS = 10_000;

type Counted =
  | { status: "ok"; links: LinkEntry[]; totals: LinkTotals; chart: number[]; points: string[]; comparable: boolean }
  | { status: "range" | "tooMany" };

/**
 * One page of the Links table: links (grouped by host and path) sorted by `sort`, limited
 * to those whose host or path contains `search`, 50 from `offset`, each with its clicks,
 * visitors, visitors' change and clicks per day (per hour on Today, Yesterday and 24h).
 * `matched` counts the links the search kept and `links` every link clicked in the range.
 * `totals` has this period's and the one before's clicks, unique clicks and links for the
 * tiles, and `chart` the clicks at each point. `comparable` is false when visitor tracking
 * started in this period or the one before, so visitor changes are left out. `status`
 * says when a filtered range is too long, or the rows would go past the read limits.
 */
export const list = query({
  args: {
    domain: v.string(),
    range: rangeArg,
    filters: v.array(filterValidator),
    sort: linkSortValidator,
    desc: v.boolean(),
    search: v.string(),
    offset: v.number(),
  },
  returns: v.union(
    v.object({
      status: v.literal("ok"),
      rows: v.array(linkRow),
      offset: v.number(),
      matched: v.number(),
      links: v.number(),
      totals: linkTotals,
      chart: v.array(v.object({ date: v.string(), clicks: v.number() })),
      comparable: v.boolean(),
    }),
    v.object({ status: v.union(v.literal("range"), v.literal("tooMany")) }),
  ),
  handler: async (ctx, args) => {
    const site = await requireReadableSite(ctx, args.domain);
    if (args.filters.length > MAX_FILTERS) throw new ConvexError(`At most ${MAX_FILTERS} filters`);

    let counted: Counted;
    if ("period" in args.range) {
      const { start, end } = hourBounds(args.range.period, args.range.now, site.timezone);
      const window = hourWindow(site, start, end);
      const view = await filteredOutbound(ctx, site, window, args.filters);
      counted = view.status === "ok" ? { ...view, points: window.points, comparable: window.comparable } : view;
    } else {
      const range = { from: args.range.from, to: args.range.to };
      if (!isValidRange(range)) throw new ConvexError("Invalid date range");
      if (args.filters.length > 0) {
        if (rangeDays(range) > MAX_FILTER_DAYS) {
          counted = { status: "range" };
        } else {
          const window = dayWindow(site, range);
          const view = await filteredOutbound(ctx, site, window, args.filters);
          counted = view.status === "ok" ? { ...view, points: window.points, comparable: window.comparable } : view;
        }
      } else {
        counted = await rollupLinks(ctx, site, range);
      }
    }
    if (counted.status !== "ok") return { status: counted.status };

    const { links, totals, chart, points, comparable } = counted;
    const table = linkTable(links, {
      sort: args.sort,
      desc: args.desc,
      search: args.search,
      offset: args.offset,
      comparable,
    });
    return {
      status: "ok" as const,
      ...table,
      totals,
      chart: points.map((date, i) => ({ date, clicks: chart[i] })),
      comparable,
    };
  },
});

/**
 * Every link's clicks and visitors over the range from the daily outbound rollups (what
 * stats.breakdown sums for the Analytics Outbound list), with clicks per day, and the
 * period before's for the changes. Visitors count once per link and day, as the list does.
 */
async function rollupLinks(ctx: QueryCtx, site: Doc<"sites">, range: DateRange): Promise<Counted> {
  const linkRows = (r: DateRange, limit: number) =>
    ctx.db
      .query("dailyDims")
      .withIndex("by_site_dim_date", (q) =>
        q.eq("siteId", site._id).eq("dim", "outbound").gte("date", r.from).lte("date", r.to),
      )
      .take(limit + 1);
  const rows = await linkRows(range, MAX_LINK_ROWS);
  if (rows.length > MAX_LINK_ROWS) return { status: "tooMany" };
  const before = await linkRows(previousRange(range), MAX_PREVIOUS_ROWS);
  // Too many to read: no changes rather than wrong ones
  const previous = before.length > MAX_PREVIOUS_ROWS ? [] : before;

  const days = eachDate(range);
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const chart = days.map(() => 0);
  const byUrl = new Map<string, RawLink>();
  for (const r of rows) {
    const clicks = r.events ?? 0;
    let link = byUrl.get(r.key);
    if (!link) {
      link = { url: r.key, clicks: 0, visitors: 0, previousVisitors: 0, trend: days.map(() => 0) };
      byUrl.set(r.key, link);
    }
    link.clicks += clicks;
    link.visitors += r.visitors;
    const i = dayIndex.get(r.date)!;
    link.trend[i] += clicks;
    chart[i] += clicks;
  }
  // The period before, by link (host and path)
  const previousVisitors = new Map<string, number>();
  const previousKeys = new Set<string>();
  let previousClicks = 0;
  let previousUnique = 0;
  for (const r of previous) {
    const clicks = r.events ?? 0;
    const key = linkKey(r.key);
    previousClicks += clicks;
    previousUnique += r.visitors;
    if (clicks > 0) previousKeys.add(key);
    previousVisitors.set(key, (previousVisitors.get(key) ?? 0) + r.visitors);
  }

  const links = groupLinks([...byUrl.values()])
    .filter((l) => l.clicks > 0)
    .map((l) => ({ ...l, previousVisitors: previousVisitors.get(l.key) ?? 0 }));
  return {
    status: "ok",
    links,
    totals: {
      clicks: links.reduce((n, l) => n + l.clicks, 0),
      previousClicks,
      unique: links.reduce((n, l) => n + l.visitors, 0),
      previousUnique,
      links: links.length,
      previousLinks: previousKeys.size,
    },
    chart,
    points: days,
    comparable: dayWindow(site, range).comparable && before.length <= MAX_PREVIOUS_ROWS,
  };
}

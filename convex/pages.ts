import { ConvexError, v, type Infer, type ObjectType } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { requireReadableSite } from "./lib/auth";
import { hourWindow as hourBounds } from "./lib/dates";
import { dayWindow, filteredPage, filteredPages, hourWindow, type ViewWindow } from "./lib/filtered";
import { filterValidator, MAX_FILTER_DAYS, MAX_FILTERS } from "./lib/filters";
import {
  avgDuration,
  bounceRate,
  emptyPageEntry,
  pageRow,
  pageSortValidator,
  pageTable,
  type PageEntry,
} from "./lib/pages";
import { eachDate, isValidRange, previousRange, rangeDays, type DateRange } from "./lib/ranges";
import { breakdownResult, type Totals } from "./lib/statsShapes";
import { readDailyStats, sumTotals } from "./stats";

// The Pages tab (design v4). Like the dashboard, day ranges read the page rollups, and
// filters or hour ranges go through the filtered view, so the table's counts are the
// Pages card's.

// One row per page and day. A year of a site with ~40 pages a day stays under it.
const MAX_PAGE_ROWS = 15_000;
// Rows read for the period before, for the sessions change; past it no change is shown
const MAX_PREVIOUS_ROWS = 10_000;
// Titles read to search them; past it, later pages are found by path only
const MAX_SEARCH_TITLES = 5_000;

const pageTiles = v.object({
  pageviews: v.number(),
  previousPageviews: v.number(),
  sessions: v.number(),
  bounceRate: v.union(v.null(), v.number()),
  timeOnPageMs: v.union(v.null(), v.number()),
});

export type PageTiles = Infer<typeof pageTiles>;

// Day ranges, or Today, Yesterday and 24h with the clock (snapped) from the page
export const rangeArg = v.union(
  v.object({ from: v.string(), to: v.string() }),
  v.object({
    period: v.union(v.literal("today"), v.literal("yesterday"), v.literal("24h")),
    now: v.number(),
  }),
);

type Listed =
  | { status: "ok"; pages: PageEntry[]; totalPageviews: number; tiles: PageTiles; comparable: boolean }
  | { status: "range" | "tooMany" };

function tiles(current: Totals, previous: Totals): PageTiles {
  return {
    pageviews: current.pageviews,
    previousPageviews: previous.pageviews,
    sessions: current.sessions,
    bounceRate: current.bounceRate,
    timeOnPageMs: current.timeOnPageMs,
  };
}

/**
 * One page of the All pages table: rows sorted by `sort`, limited to pages whose path or
 * title contains `search`, 50 from `offset`, each with its title, its pageviews per day (per hour on Today,
 * Yesterday and 24h). `matched` counts the pages the search kept, `pages` all pages in
 * the range and `totalPageviews` the views to take shares of. `tiles` sums the range
 * (the site's sessions, bounce rate and time on page) and `comparable` is false when
 * visitor tracking started in this period or the one before, so session changes are
 * left out. `status` says when a filtered range is too long, or the rows would go past
 * the read limits.
 */
const listArgs = {
  domain: v.string(),
  range: rangeArg,
  filters: v.array(filterValidator),
  sort: pageSortValidator,
  desc: v.boolean(),
  search: v.string(),
  offset: v.number(),
};

export const list = query({
  args: listArgs,
  returns: v.union(
    v.object({
      status: v.literal("ok"),
      rows: v.array(pageRow),
      offset: v.number(),
      matched: v.number(),
      pages: v.number(),
      totalPageviews: v.number(),
      tiles: pageTiles,
      comparable: v.boolean(),
    }),
    v.object({ status: v.union(v.literal("range"), v.literal("tooMany")) }),
  ),
  handler: async (ctx, args) => await pageList(ctx, await requireReadableSite(ctx, args.domain), args),
});

/** `list` for a site already resolved to its owner; the MCP server calls it too. */
export async function pageList(
  ctx: QueryCtx,
  site: Doc<"sites">,
  args: Omit<ObjectType<typeof listArgs>, "domain">,
) {
  if (args.filters.length > MAX_FILTERS) throw new ConvexError(`At most ${MAX_FILTERS} filters`);
  const table = { sort: args.sort, desc: args.desc, search: args.search, offset: args.offset };

  let result: Listed;
  if ("period" in args.range) {
    const { start, end } = hourBounds(args.range.period, args.range.now, site.timezone);
    result = filteredResult(await filteredPages(ctx, site, hourWindow(site, start, end), args.filters));
  } else {
    const range = { from: args.range.from, to: args.range.to };
    if (!isValidRange(range)) throw new ConvexError("Invalid date range");
    if (args.filters.length > 0) {
      result =
        rangeDays(range) > MAX_FILTER_DAYS
          ? { status: "range" }
          : filteredResult(await filteredPages(ctx, site, dayWindow(site, range), args.filters));
    } else {
      result = await rollupPages(ctx, site, range);
    }
  }
  if (result.status !== "ok") return { status: result.status };
  const { pages, totalPageviews, comparable } = result;
  // Searching reads every title; otherwise only the rows shown are looked up
  const titles = args.search.trim() === "" ? undefined : await siteTitles(ctx, site._id);
  const shown = pageTable(pages, { ...table, comparable, titles });
  const rows = titles
    ? shown.rows
    : await Promise.all(shown.rows.map(async (r) => ({ ...r, title: await pageTitle(ctx, site._id, r.path) })));
  return {
    status: "ok" as const,
    ...shown,
    rows,
    totalPageviews,
    tiles: result.tiles,
    comparable,
  };
}

/**
 * The page drawer: one page over the range, through the filtered view with `page:<path>`
 * added to `filters` (see lib/filtered.ts filteredPage). Its title, Visitors, Pageviews,
 * Bounce (on sessions that started there) and Avg. time, its pageviews at each point
 * (days, or hours on Today, Yesterday and 24h), and the Sources (and Referrers),
 * Countries, Devices and Browsers lists of the sessions that viewed it. Day ranges are
 * limited to MAX_FILTER_DAYS, as filters are; `status` says when, or when the rows would
 * go past the read limits.
 */
export const detail = query({
  args: { domain: v.string(), range: rangeArg, filters: v.array(filterValidator), path: v.string() },
  returns: v.union(
    v.object({
      status: v.literal("ok"),
      title: v.union(v.null(), v.string()),
      visitors: v.number(),
      pageviews: v.number(),
      bounceRate: v.union(v.null(), v.number()),
      durationMs: v.union(v.null(), v.number()),
      chart: v.array(v.object({ date: v.string(), pageviews: v.number() })),
      breakdowns: v.record(v.string(), breakdownResult),
    }),
    v.object({ status: v.union(v.literal("range"), v.literal("tooMany")) }),
  ),
  handler: async (ctx, args) => {
    const site = await requireReadableSite(ctx, args.domain);
    if (args.filters.length > MAX_FILTERS) throw new ConvexError(`At most ${MAX_FILTERS} filters`);
    let window: ViewWindow;
    if ("period" in args.range) {
      const { start, end } = hourBounds(args.range.period, args.range.now, site.timezone);
      window = hourWindow(site, start, end);
    } else {
      const range = { from: args.range.from, to: args.range.to };
      if (!isValidRange(range)) throw new ConvexError("Invalid date range");
      if (rangeDays(range) > MAX_FILTER_DAYS) return { status: "range" as const };
      window = dayWindow(site, range);
    }
    const view = await filteredPage(ctx, site, window, args.filters, args.path);
    if (view.status !== "ok") return view;
    const { page } = view;
    return {
      status: "ok" as const,
      title: await pageTitle(ctx, site._id, args.path),
      visitors: page.visitors,
      pageviews: page.pageviews,
      bounceRate: bounceRate(page),
      durationMs: avgDuration(page),
      chart: window.points.map((date, i) => ({ date, pageviews: page.trend[i] })),
      breakdowns: view.breakdowns,
    };
  },
});

async function siteTitles(ctx: QueryCtx, siteId: Id<"sites">): Promise<Map<string, string>> {
  const rows = await ctx.db
    .query("pageTitles")
    .withIndex("by_site_path", (q) => q.eq("siteId", siteId))
    .take(MAX_SEARCH_TITLES);
  return new Map(rows.map((r) => [r.path, r.title]));
}

async function pageTitle(ctx: QueryCtx, siteId: Id<"sites">, path: string): Promise<string | null> {
  const row = await ctx.db
    .query("pageTitles")
    .withIndex("by_site_path", (q) => q.eq("siteId", siteId).eq("path", path))
    .unique();
  return row?.title ?? null;
}

function filteredResult(view: Awaited<ReturnType<typeof filteredPages>>): Listed {
  if (view.status !== "ok") return view;
  const { summary } = view;
  return {
    status: "ok",
    pages: view.pages,
    totalPageviews: view.totalPageviews,
    tiles: tiles(summary.current, summary.previous),
    comparable: summary.comparable,
  };
}

/**
 * Every page's counts over the range from the daily page rollups, with views per day,
 * and its sessions over the period before. The tiles come from the daily stats.
 */
async function rollupPages(ctx: QueryCtx, site: Doc<"sites">, range: DateRange): Promise<Listed> {
  const pageRows = (r: DateRange, limit: number) =>
    ctx.db
      .query("dailyDims")
      .withIndex("by_site_dim_date", (q) =>
        q.eq("siteId", site._id).eq("dim", "page").gte("date", r.from).lte("date", r.to),
      )
      .take(limit + 1);
  const rows = await pageRows(range, MAX_PAGE_ROWS);
  if (rows.length > MAX_PAGE_ROWS) return { status: "tooMany" };
  const prev = previousRange(range);
  const before = await pageRows(prev, MAX_PREVIOUS_ROWS);

  const days = eachDate(range);
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const byPath = new Map<string, PageEntry>();
  const page = (path: string) => {
    let e = byPath.get(path);
    if (!e) {
      e = emptyPageEntry(path, days.length);
      byPath.set(path, e);
    }
    return e;
  };
  let totalPageviews = 0;
  for (const r of rows) {
    const e = page(r.key);
    e.pageviews += r.pageviews;
    e.visitors += r.visitors;
    e.sessions += r.sessions ?? 0;
    e.events += r.events ?? 0;
    e.revenueMinor += r.revenueMinor ?? 0;
    e.entries += r.entries ?? 0;
    e.bounces += r.bounces ?? 0;
    e.engagedMs += r.engagedMs ?? 0;
    e.durationCount += r.durationCount ?? 0;
    e.trend[dayIndex.get(r.date)!] += r.pageviews;
    totalPageviews += r.pageviews;
  }
  for (const r of before) {
    // Pages only seen before the range don't get a row
    const e = byPath.get(r.key);
    if (e) e.previousSessions += r.sessions ?? 0;
  }

  const current = sumTotals(await readDailyStats(ctx, site._id, range));
  const previous = sumTotals(await readDailyStats(ctx, site._id, prev));
  return {
    status: "ok",
    pages: [...byPath.values()],
    totalPageviews,
    tiles: tiles(current, previous),
    comparable: dayWindow(site, range).comparable && before.length <= MAX_PREVIOUS_ROWS,
  };
}

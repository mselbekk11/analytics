import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { ownedSite } from "./lib/auth";
import { hourWindow as hourBounds, localDate } from "./lib/dates";
import { breakdownKey, CARD_METRICS, dimValidator, listChannelValidator, rankEntries } from "./lib/dims";
import { dayWindow, filteredView, hourWindow } from "./lib/filtered";
import { MAX_FILTER_DAYS, type Filter } from "./lib/filters";
import { formatToolFilters, parseToolFilters, parseToolRange, type ToolRange } from "./lib/mcp";
import { pageSortValidator } from "./lib/pages";
import { rangeDays } from "./lib/ranges";
import { siteCurrency } from "./lib/revenue";
import { checkSecret } from "./lib/secret";
import { pageList } from "./pages";
import { ownerSites } from "./sites";
import {
  siteBreakdown,
  siteConversions,
  siteGoals,
  siteLive,
  siteLiveFeed,
  siteOnline,
  siteSummary,
  siteTimeseries,
} from "./stats";
import { visitorList, visitorProfile } from "./visitors";

// The MCP server's reads (design v4). /api/mcp can't use a Clerk session, so it calls
// these public functions with INGEST_SECRET and the SHA-256 of the caller's Bearer key.
// Each resolves the key to its owner, the domain to one of the owner's sites (someone
// else's reads as "Site not found", like a missing one), then calls the same helpers as
// the dashboard's queries. Nothing here writes, except `authenticate`'s lastUsedAt.
//
// Results are what the dashboard shows, trimmed to what an assistant needs, with the
// domain, timezone, range and filters echoed back. Revenue is in the currency's smallest
// unit, timestamps are Unix milliseconds and dates are days in the site's timezone.

// lastUsedAt moves at most this often, so busy clients don't write on every request
export const LAST_USED_STEP_MS = 60 * 1000;
// "Online now" as the top bar and Live count it, and the Live feed's window
const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const FEED_WINDOW_MS = 24 * 60 * 60 * 1000;
const LIVE_FEED_ROWS = 25;
const MAX_BREAKDOWN_ROWS = 100;

const keyArgs = { secret: v.string(), keyHash: v.string() };
// `now` comes from the route, because queries can't read the clock
const siteArgs = { ...keyArgs, domain: v.string(), now: v.number() };
const viewArgs = { ...siteArgs, range: v.optional(v.string()), filters: v.optional(v.string()) };

async function activeKey(ctx: QueryCtx, secret: string, keyHash: string): Promise<Doc<"apiKeys"> | null> {
  checkSecret(secret);
  const key = await ctx.db
    .query("apiKeys")
    .withIndex("by_hash", (q) => q.eq("hash", keyHash))
    .unique();
  return key === null || key.revokedAt !== undefined ? null : key;
}

/** The key's owner; a revoked or unknown key is refused at once. */
async function keyOwner(ctx: QueryCtx, args: { secret: string; keyHash: string }): Promise<string> {
  const key = await activeKey(ctx, args.secret, args.keyHash);
  if (key === null) throw new ConvexError("Unauthorized");
  return key.ownerId;
}

async function keySite(ctx: QueryCtx, args: { secret: string; keyHash: string; domain: string }) {
  const site = await ownedSite(ctx, await keyOwner(ctx, args), args.domain);
  if (site === null) throw new ConvexError("Site not found");
  return site;
}

/**
 * Checks a Bearer key for /api/mcp, once per HTTP request: false for an unknown or
 * revoked key (the route answers 401). Moves lastUsedAt at most once a minute.
 */
export const authenticate = mutation({
  args: keyArgs,
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const key = await activeKey(ctx, args.secret, args.keyHash);
    if (key === null) return false;
    const now = Date.now();
    if (key.lastUsedAt === undefined || now - key.lastUsedAt >= LAST_USED_STEP_MS) {
      await ctx.db.patch("apiKeys", key._id, { lastUsedAt: now });
    }
    return true;
  },
});

type View = {
  site: Doc<"sites">;
  range: ToolRange;
  filters: Filter[];
  hours: { start: number; end: number } | null;
  echo: Echo;
};

type Echo = {
  domain: string;
  timezone: string;
  range: { param: string; from: string; to: string; granularity: "day" | "hour"; start?: string; end?: string };
  filters?: string;
  note?: string;
};

/** The range and filters a tool asked for, read as the dashboard reads `?range=` and `?f=`. */
function resolveView(site: Doc<"sites">, args: { range?: string; filters?: string; now: number }): View {
  const range = parseToolRange(args.range, localDate(args.now, site.timezone));
  if ("error" in range) throw new ConvexError(range.error);
  const parsed = parseToolFilters(args.filters);
  if ("error" in parsed) throw new ConvexError(parsed.error);
  // Filters pick sessions, so a site that never sent a visitor id ignores them, as the dashboard does
  const filters = site.trackingStartedAt === undefined ? [] : parsed;
  const hours = range.hourly === null ? null : hourBounds(range.hourly, args.now, site.timezone);
  return {
    site,
    range,
    filters,
    hours,
    echo: {
      domain: site.domain,
      timezone: site.timezone,
      range: {
        param: range.param,
        from: range.range.from,
        to: range.range.to,
        granularity: hours === null ? ("day" as const) : ("hour" as const),
        ...(hours && { start: new Date(hours.start).toISOString(), end: new Date(hours.end).toISOString() }),
      },
      filters: formatToolFilters(filters),
      ...(parsed.length > filters.length && { note: "Filters need visitor ids; this site has none, so they were ignored" }),
    },
  };
}

/**
 * The raw-row view the dashboard uses for hour ranges and filtered day ranges, or null
 * when the daily rollups apply (a day range without filters).
 */
async function rawView(ctx: QueryCtx, view: View) {
  const { site, filters, hours, range } = view;
  let window;
  if (hours !== null) {
    window = hourWindow(site, hours.start, hours.end);
  } else if (filters.length > 0) {
    if (rangeDays(range.range) > MAX_FILTER_DAYS) {
      throw new ConvexError(`Filtered ranges are limited to ${MAX_FILTER_DAYS} days`);
    }
    window = dayWindow(site, range.range);
  } else {
    return null;
  }
  const result = await filteredView(ctx, site, window, filters);
  if (result.status !== "ok") throw new ConvexError("Too many rows to read; try a shorter range or fewer filters");
  return result;
}

/** pages.list and visitors.list take a day range, or an hour period with the clock. */
function listRange(view: View, now: number) {
  return view.range.hourly === null ? view.range.range : { period: view.range.hourly, now };
}

const hasRevenue = (site: Doc<"sites">) => (site.revenueSource ?? "none") !== "none";

/** The key owner's sites, with what each one tracks. */
export const sites = query({
  args: keyArgs,
  returns: v.any(),
  handler: async (ctx, args) => {
    const sites = await ownerSites(ctx, await keyOwner(ctx, args));
    return sites.map((s) => ({
      domain: s.domain,
      timezone: s.timezone,
      visitorIds: s.trackingStartedAt !== undefined && s.cookieless !== true,
      currency: hasRevenue(s) ? siteCurrency(s) : null,
      keyGoal: s.keyGoal ?? null,
    }));
  },
});

/**
 * The Analytics tiles: totals for the range and the one before it, converted visitors
 * (paying ones on a site with revenue, otherwise key-goal ones) and the key goal's completions.
 */
export const summary = query({
  args: viewArgs,
  returns: v.any(),
  handler: async (ctx, args) => {
    const view = resolveView(await keySite(ctx, args), args);
    const { site } = view;
    const keyGoal = site.keyGoal ?? null;
    const raw = await rawView(ctx, view);
    const summary = raw?.summary ?? (await siteSummary(ctx, site, view.range.range));
    const conversions =
      raw?.conversions ??
      (hasRevenue(site) || keyGoal !== null ? await siteConversions(ctx, site, view.range.range) : null);
    const goals = raw?.goals ?? (keyGoal !== null ? await siteGoals(ctx, site, view.range.range) : null);
    return {
      ...view.echo,
      currency: hasRevenue(site) ? siteCurrency(site) : null,
      ...summary,
      conversions:
        conversions === null || conversions.kind === null
          ? null
          : { kind: conversions.kind, current: conversions.current, previous: conversions.previous },
      keyGoal:
        keyGoal === null || goals === null
          ? null
          : {
              name: keyGoal,
              completions: goals.rows.find((r) => r.name === keyGoal)?.completions ?? 0,
              previous: goals.keyGoalPrevious,
            },
    };
  },
});

/** The chart: one point per day (per hour on today, yesterday and 24h). */
export const timeseries = query({
  args: viewArgs,
  returns: v.any(),
  handler: async (ctx, args) => {
    const view = resolveView(await keySite(ctx, args), args);
    const { site } = view;
    const raw = await rawView(ctx, view);
    const series = raw?.timeseries ?? (await siteTimeseries(ctx, site, view.range.range));
    const revenue = hasRevenue(site);
    const keyGoal = site.keyGoal !== undefined;
    // Only the series the dashboard can draw for this site
    const points = series.map(({ revenueMinor, goal, conversionRate, ...point }) => ({
      ...point,
      ...(revenue && { revenueMinor }),
      ...(keyGoal && { goal }),
      ...((revenue || keyGoal) && { conversionRate }),
    }));
    return { ...view.echo, currency: revenue ? siteCurrency(site) : null, keyGoal: site.keyGoal ?? null, points };
  },
});

/** One of the dashboard's lists, ranked as its cards rank it for the chosen metric. */
export const breakdown = query({
  args: {
    ...viewArgs,
    dim: dimValidator,
    channel: v.optional(listChannelValidator),
    metric: v.optional(v.union(...CARD_METRICS.map((m) => v.literal(m)))),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const view = resolveView(await keySite(ctx, args), args);
    const { site } = view;
    if (args.channel !== undefined && args.dim !== "source") {
      throw new ConvexError("A channel limit only applies to sources");
    }
    const raw = await rawView(ctx, view);
    const list =
      raw?.breakdowns[breakdownKey(args.dim, args.channel)] ??
      (await siteBreakdown(ctx, site, { ...view.range.range, dim: args.dim, channel: args.channel }));
    const revenue = hasRevenue(site);
    const limit = Math.max(1, Math.min(MAX_BREAKDOWN_ROWS, Math.floor(args.limit ?? 20)));
    const ranked = rankEntries(args.dim, list.rows, args.metric);
    return {
      ...view.echo,
      dim: args.dim,
      ...(args.channel && { channel: args.channel }),
      metric: args.metric ?? null,
      currency: revenue ? siteCurrency(site) : null,
      rows: ranked.slice(0, limit).map(({ revenueMinor, ...row }) => ({ ...row, ...(revenue && { revenueMinor }) })),
      more: ranked.length > limit,
      totals: {
        visitors: list.totalVisitors,
        pageviews: list.totalPageviews,
        sessions: list.totalSessions,
        events: list.totalEvents,
        ...(revenue && { revenueMinor: list.totalRevenueMinor }),
      },
    };
  },
});

/** The Pages table: 50 rows from `offset`, sorted and searched as on the Pages tab. */
export const pages = query({
  args: {
    ...viewArgs,
    sort: v.optional(pageSortValidator),
    desc: v.optional(v.boolean()),
    search: v.optional(v.string()),
    offset: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const view = resolveView(await keySite(ctx, args), args);
    const result = await pageList(ctx, view.site, {
      range: listRange(view, args.now),
      filters: view.filters,
      sort: args.sort ?? "views",
      desc: args.desc ?? true,
      search: args.search ?? "",
      offset: args.offset ?? 0,
    });
    if (result.status !== "ok") {
      throw new ConvexError(
        result.status === "range"
          ? `Filtered ranges are limited to ${MAX_FILTER_DAYS} days`
          : "Too many rows to read; try a shorter range",
      );
    }
    return {
      ...view.echo,
      currency: hasRevenue(view.site) ? siteCurrency(view.site) : null,
      // The sparkline (`trend`) is left out; get_timeseries charts the site
      rows: result.rows.map((r) => ({
        path: r.path,
        title: r.title,
        views: r.views,
        sessions: r.sessions,
        sessionsChange: r.sessionsChange,
        bounceRate: r.bounceRate,
        durationMs: r.durationMs,
        ...(hasRevenue(view.site) && { revenueMinor: r.revenueMinor }),
      })),
      offset: result.offset,
      matched: result.matched,
      pages: result.pages,
      totalPageviews: result.totalPageviews,
      tiles: result.tiles,
      comparable: result.comparable,
    };
  },
});

/** The Users table: visitors seen in the range, latest first, 50 from `offset`. */
export const visitors = query({
  args: {
    ...siteArgs,
    range: v.optional(v.string()),
    kind: v.optional(v.union(v.literal("all"), v.literal("customers"))),
    search: v.optional(v.string()),
    offset: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const view = resolveView(await keySite(ctx, args), { ...args, filters: undefined });
    // The Users table isn't filtered
    const echo = { ...view.echo };
    delete echo.filters;
    const result = await visitorList(ctx, view.site, {
      range: listRange(view, args.now),
      kind: args.kind ?? "all",
      search: args.search ?? "",
      offset: args.offset ?? 0,
    });
    if (result.status === "cookieless") {
      return { ...echo, rows: [], note: "This site has no visitor ids (cookieless), so visitors aren't listed" };
    }
    return {
      ...echo,
      rows: result.rows,
      offset: result.offset,
      matched: result.matched,
      truncated: result.truncated,
      customerKinds: result.customerKinds,
      currency: result.currency,
    };
  },
});

/** One visitor's profile and journey: their latest 50 sessions, each with its pages and events. */
export const journey = query({
  args: { ...siteArgs, visitorId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const site = await keySite(ctx, args);
    const profile = await visitorProfile(ctx, site, { visitorId: args.visitorId });
    if (profile === null) throw new ConvexError("Visitor not found");
    return { domain: site.domain, timezone: site.timezone, ...profile };
  },
});

/** The Live tab: visitors online now (last 5 minutes) and the latest pageviews, goals and payments of the last day. */
export const live = query({
  args: siteArgs,
  returns: v.any(),
  handler: async (ctx, args) => {
    const site = await keySite(ctx, args);
    const onlineSince = args.now - ONLINE_WINDOW_MS;
    const tracking = site.trackingStartedAt !== undefined;
    const feed = await siteLiveFeed(ctx, site, { since: args.now - FEED_WINDOW_MS, onlineSince });
    return {
      domain: site.domain,
      timezone: site.timezone,
      // Cookieless sites have no visitors to count, so they get pageviews in the window instead
      ...(tracking
        ? { online: await siteOnline(ctx, site, { since: onlineSince }) }
        : { pageviewsLast5Min: await siteLive(ctx, site, { since: onlineSince }) }),
      visitors: feed.visitors.map((x) => ({
        visitorId: x.visitorId,
        name: x.name,
        country: x.country,
        city: x.city,
        device: x.device,
        browser: x.browser,
        source: x.source,
        path: x.path,
        lastSeenAt: x.lastSeenAt,
      })),
      moreVisitors: feed.moreVisitors,
      feed: feed.feed.slice(0, LIVE_FEED_ROWS).map((row) => ({
        kind: row.kind,
        ts: row.ts,
        visitorId: row.visitorId,
        name: row.name,
        path: row.path,
        goal: row.goal,
        amountMinor: row.amountMinor,
        currency: row.currency,
        country: row.country,
      })),
    };
  },
});

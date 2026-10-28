import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { sessionSource } from "./lib/attribution";
import { requireSite } from "./lib/auth";
import { localDate } from "./lib/dates";
import { DIM_COUNTS, dimValidator, rankEntries, type Dim, type DimEntry } from "./lib/dims";
import { filteredView } from "./lib/filtered";
import { filterValidator, MAX_FILTER_DAYS, MAX_FILTERS } from "./lib/filters";
import { eachDate, isValidRange, previousRange, rangeDays, type DateRange } from "./lib/ranges";
import { siteCurrency } from "./lib/revenue";
import {
  breakdownResult,
  conversionsResult,
  goalsResult,
  seriesResult,
  summaryResult,
} from "./lib/statsShapes";

// Dashboard reads. Every query checks ownership with requireSite, takes the date range
// as "YYYY-MM-DD" strings in the site's timezone (the page computes them, because
// queries must not read the clock), and reads the daily rollups, except for the
// distinct-visitor count in `summary` and the live counts, which read raw rows.

// A year of daily rows is at most 366 per site; the cap only guards against surprises.
const MAX_STATS_ROWS = 800;
// dailyDims has one row per day per distinct key. Pages and referrers are the long
// tail; this stays well inside Convex's per-query read limits.
const MAX_DIM_ROWS = 15_000;
// The lists page through 10 rows at a time; nobody pages past this.
const MAX_BREAKDOWN_KEYS = 500;
const MAX_LIVE_ROWS = 1_000;
// Distinct visitors are counted from session rows. A year of the busiest site is a few
// thousand; past this the tile falls back to summing daily visitors.
const MAX_SESSION_ROWS = 10_000;
const HOUR_MS = 60 * 60 * 1000;

const rangeArgs = { domain: v.string(), from: v.string(), to: v.string() };

function checkRange(range: DateRange): void {
  if (!isValidRange(range)) {
    throw new ConvexError("Invalid date range");
  }
}

async function readDailyStats(
  ctx: QueryCtx,
  siteId: Id<"sites">,
  { from, to }: DateRange,
): Promise<Doc<"dailyStats">[]> {
  return await ctx.db
    .query("dailyStats")
    .withIndex("by_site_date", (q) =>
      q.eq("siteId", siteId).gte("date", from).lte("date", to),
    )
    .take(MAX_STATS_ROWS);
}

function sumTotals(rows: Doc<"dailyStats">[]) {
  let visitors = 0;
  let pageviews = 0;
  let durationSumMs = 0;
  let durationCount = 0;
  let sessions = 0;
  let bounces = 0;
  let sessionEngagedMs = 0;
  let revenueMinor = 0;
  let payments = 0;
  let refundsMinor = 0;
  for (const r of rows) {
    visitors += r.visitors;
    pageviews += r.pageviews;
    durationSumMs += r.durationSumMs;
    durationCount += r.durationCount;
    sessions += r.sessions ?? 0;
    bounces += r.bounces ?? 0;
    sessionEngagedMs += r.sessionEngagedMs ?? 0;
    revenueMinor += r.revenueMinor ?? 0;
    payments += r.payments ?? 0;
    refundsMinor += r.refundsMinor ?? 0;
  }
  return {
    visitors,
    pageviews,
    timeOnPageMs: durationCount === 0 ? null : Math.round(durationSumMs / durationCount),
    sessions,
    bounceRate: sessions === 0 ? null : bounces / sessions,
    sessionTimeMs: sessions === 0 ? null : Math.round(sessionEngagedMs / sessions),
    revenueMinor,
    payments,
    refundsMinor,
  };
}

/**
 * Sessions that started on the days of the range, or null if there are more than
 * MAX_SESSION_ROWS. Local days run from UTC-12 to UTC+14, so the timestamp window is
 * widened and the stored `date` decides.
 */
async function readSessions(
  ctx: QueryCtx,
  siteId: Id<"sites">,
  { from, to }: DateRange,
): Promise<Doc<"sessions">[] | null> {
  const start = Date.parse(`${from}T00:00:00Z`) - 14 * HOUR_MS;
  const end = Date.parse(`${to}T00:00:00Z`) + 36 * HOUR_MS;
  const rows = await ctx.db
    .query("sessions")
    .withIndex("by_site_started", (q) =>
      q.eq("siteId", siteId).gte("startedAt", start).lt("startedAt", end),
    )
    .take(MAX_SESSION_ROWS + 1);
  if (rows.length > MAX_SESSION_ROWS) return null;
  return rows.filter((r) => r.date >= from && r.date <= to);
}

/**
 * Visitors over a range: SA-style unique visits for days before visitor tracking
 * started, plus distinct visitor ids from the sessions on and after that day.
 */
function countVisitors(
  stats: Doc<"dailyStats">[],
  sessions: Doc<"sessions">[],
  { from, to }: DateRange,
  launch: string,
): number {
  let visitors = 0;
  for (const r of stats) {
    if (r.date >= from && r.date <= to && r.date < launch) visitors += r.visitors;
  }
  const ids = new Set<string>();
  for (const s of sessions) {
    if (s.date >= from && s.date <= to && s.date >= launch) ids.add(s.visitorId);
  }
  return visitors + ids.size;
}

/**
 * Totals for the range and the equal-length range before it. From the day visitor
 * tracking started, Visitors counts distinct visitor ids. `comparable` is false when
 * the previous range starts before that day, so visitor-based changes are not shown.
 * `visitorsApprox` is true when there were too many sessions to count and Visitors
 * fell back to the sum of daily visitors.
 */
export const summary = query({
  args: rangeArgs,
  returns: summaryResult,
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    const range = { from: args.from, to: args.to };
    checkRange(range);
    const prev = previousRange(range);

    // One index read covers both ranges, since they are adjacent
    const rows = await readDailyStats(ctx, site._id, { from: prev.from, to: range.to });
    const current = sumTotals(rows.filter((r) => r.date >= range.from));
    const previous = sumTotals(rows.filter((r) => r.date < range.from));

    const launch =
      site.trackingStartedAt === undefined
        ? null
        : localDate(site.trackingStartedAt, site.timezone);
    let visitorsApprox = false;
    if (launch !== null && launch <= range.to) {
      const from = launch > prev.from ? launch : prev.from;
      const sessions = await readSessions(ctx, site._id, { from, to: range.to });
      if (sessions === null) {
        visitorsApprox = true;
      } else {
        current.visitors = countVisitors(rows, sessions, range, launch);
        previous.visitors = countVisitors(rows, sessions, prev, launch);
      }
    }

    return {
      current,
      previous,
      comparable: launch === null || launch <= prev.from || launch > range.to,
      visitorsApprox,
    };
  },
});

/** One point per day in the range, with days that had no traffic filled as zero. */
export const timeseries = query({
  args: rangeArgs,
  returns: seriesResult,
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    const range = { from: args.from, to: args.to };
    checkRange(range);

    const byDate = new Map<string, Doc<"dailyStats">>();
    for (const r of await readDailyStats(ctx, site._id, range)) byDate.set(r.date, r);
    return eachDate(range).map((date) => {
      const r = byDate.get(date);
      return {
        date,
        pageviews: r?.pageviews ?? 0,
        visitors: r?.visitors ?? 0,
        revenueMinor: r?.revenueMinor ?? 0,
      };
    });
  },
});

/** Sums one dimension's daily rows per key over the range, plus the totals over every row. */
async function sumDim(ctx: QueryCtx, siteId: Id<"sites">, dim: Dim, { from, to }: DateRange) {
  const rows = await ctx.db
    .query("dailyDims")
    .withIndex("by_site_dim_date", (q) =>
      q.eq("siteId", siteId).eq("dim", dim).gte("date", from).lte("date", to),
    )
    .take(MAX_DIM_ROWS);

  const byKey = new Map<string, DimEntry>();
  const total = { pageviews: 0, visitors: 0, sessions: 0, events: 0, revenueMinor: 0 };
  for (const r of rows) {
    const add = {
      pageviews: r.pageviews,
      visitors: r.visitors,
      sessions: r.sessions ?? 0,
      events: r.events ?? 0,
      revenueMinor: r.revenueMinor ?? 0,
    };
    const entry = byKey.get(r.key) ?? { key: r.key, pageviews: 0, visitors: 0, sessions: 0, events: 0, revenueMinor: 0 };
    byKey.set(r.key, entry);
    for (const m of DIM_COUNTS) {
      total[m] += add[m];
      entry[m] += add[m];
    }
  }
  return { entries: [...byKey.values()], total };
}

/**
 * Pageviews, visitors, sessions and events per key of one dimension over the range,
 * largest first by the dim's metric (see dimMetric): pageviews for pages, sessions for
 * entry and exit pages, events for goals and outbound links, visitors (unique visits,
 * as SA does) for the rest. Keys with none of that metric are left out, unless they
 * have revenue ("Unattributed" has no visitors). The totals cover every key, including
 * any cut off by the row limit.
 */
export const breakdown = query({
  args: { ...rangeArgs, dim: dimValidator },
  returns: breakdownResult,
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    const range = { from: args.from, to: args.to };
    checkRange(range);

    const { entries, total } = await sumDim(ctx, site._id, args.dim, range);
    const sorted = rankEntries(args.dim, entries);
    return {
      rows: sorted.slice(0, MAX_BREAKDOWN_KEYS),
      totalPageviews: total.pageviews,
      totalVisitors: total.visitors,
      totalSessions: total.sessions,
      totalEvents: total.events,
      totalRevenueMinor: total.revenueMinor,
    };
  },
});

/**
 * Each goal's completions and visitors over the range, most completions first, and the
 * site's visitors to divide by for a conversion rate. Both visitor counts are summed
 * per day (a visitor counts once per goal and day, and once per day overall), so the
 * rate is the share of daily visitors who completed the goal. The key goal is always
 * listed, with zeros if it had no completions.
 */
export const goals = query({
  args: rangeArgs,
  returns: goalsResult,
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    const range = { from: args.from, to: args.to };
    checkRange(range);

    const { entries } = await sumDim(ctx, site._id, "goal", range);
    const rows = entries
      .filter((e) => e.events > 0)
      .map((e) => ({ name: e.key, completions: e.events, visitors: e.visitors }));
    const keyGoal = site.keyGoal ?? null;
    if (keyGoal !== null && !rows.some((r) => r.name === keyGoal)) {
      rows.push({ name: keyGoal, completions: 0, visitors: 0 });
    }
    rows.sort((a, b) => b.completions - a.completions || b.visitors - a.visitors || a.name.localeCompare(b.name));

    const stats = await readDailyStats(ctx, site._id, range);
    return {
      rows: rows.slice(0, MAX_BREAKDOWN_KEYS),
      visitors: stats.reduce((n, r) => n + r.visitors, 0),
      keyGoal,
    };
  },
});

// Payments and goal events read for the conversion count, over two ranges
const MAX_CONVERSION_ROWS = 10_000;

/**
 * Distinct visitors who converted in the range and in the one before it: visitors with
 * a payment in the site's currency on a site with revenue, otherwise visitors who
 * completed the key goal. Read from the raw rows, so they divide by the Visitors tile.
 * `kind` is null when the site has neither, and the counts are null when there were
 * too many rows to read. `otherCurrencyPayments` counts payments in the range left out
 * of the totals because of their currency.
 */
export const conversions = query({
  args: rangeArgs,
  returns: conversionsResult,
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    const range = { from: args.from, to: args.to };
    checkRange(range);
    const prev = previousRange(range);
    // Local days run from UTC-12 to UTC+14; the stored `date` decides
    const start = Date.parse(`${prev.from}T00:00:00Z`) - 14 * HOUR_MS;
    const end = Date.parse(`${range.to}T00:00:00Z`) + 36 * HOUR_MS;
    const inRange = (date: string, r: DateRange) => date >= r.from && date <= r.to;
    const distinct = (rows: { date: string; visitorId?: string }[], r: DateRange) =>
      new Set(rows.filter((x) => x.visitorId !== undefined && inRange(x.date, r)).map((x) => x.visitorId)).size;

    if ((site.revenueSource ?? "none") !== "none") {
      const rows = await ctx.db
        .query("payments")
        .withIndex("by_site_ts", (q) => q.eq("siteId", site._id).gte("ts", start).lt("ts", end))
        .take(MAX_CONVERSION_ROWS + 1);
      const currency = siteCurrency(site);
      const paid = rows.filter((p) => p.kind === "payment" && p.currency === currency);
      const tooMany = rows.length > MAX_CONVERSION_ROWS;
      return {
        kind: "revenue" as const,
        current: tooMany ? null : distinct(paid, range),
        previous: tooMany ? null : distinct(paid, prev),
        otherCurrencyPayments: rows.filter((p) => p.currency !== currency && inRange(p.date, range)).length,
      };
    }

    const keyGoal = site.keyGoal;
    if (keyGoal === undefined) {
      return { kind: null, current: null, previous: null, otherCurrencyPayments: 0 };
    }
    const rows = await ctx.db
      .query("events")
      .withIndex("by_site_ts", (q) => q.eq("siteId", site._id).gte("ts", start).lt("ts", end))
      .take(MAX_CONVERSION_ROWS + 1);
    const done = rows.filter((e) => e.type === "goal" && e.name === keyGoal);
    const tooMany = rows.length > MAX_CONVERSION_ROWS;
    return {
      kind: "goal" as const,
      current: tooMany ? null : distinct(done, range),
      previous: tooMany ? null : distinct(done, prev),
      otherCurrencyPayments: 0,
    };
  },
});

/**
 * The dashboard with up to MAX_FILTERS filters: summary, chart, every list, goals and
 * conversions in the shapes the rollup queries return, worked out from the raw sessions
 * (see lib/filtered.ts). Limited to MAX_FILTER_DAYS; `status` says when the range is
 * longer, or when the rows would go past Convex's read limits.
 */
export const filtered = query({
  args: { ...rangeArgs, filters: v.array(filterValidator) },
  returns: v.union(
    v.object({
      status: v.literal("ok"),
      summary: summaryResult,
      timeseries: seriesResult,
      breakdowns: v.record(v.string(), breakdownResult),
      goals: goalsResult,
      conversions: conversionsResult,
    }),
    v.object({ status: v.union(v.literal("range"), v.literal("tooMany")) }),
  ),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    const range = { from: args.from, to: args.to };
    checkRange(range);
    if (args.filters.length === 0 || args.filters.length > MAX_FILTERS) {
      throw new ConvexError(`Between 1 and ${MAX_FILTERS} filters`);
    }
    if (rangeDays(range) > MAX_FILTER_DAYS) return { status: "range" as const };
    return await filteredView(ctx, site, range, args.filters);
  },
});

/**
 * Pageviews since `since`, a timestamp the page passes in and moves forward every
 * 30 seconds: a query re-runs when its data changes, not when the clock moves.
 */
export const live = query({
  args: { domain: v.string(), since: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    const rows = await ctx.db
      .query("pageviews")
      .withIndex("by_site_ts", (q) => q.eq("siteId", site._id).gte("ts", args.since))
      .take(MAX_LIVE_ROWS);
    return rows.length;
  },
});

/**
 * Distinct visitors with a pageview or ping since `since` (passed in like `live`).
 * Shown as "online now" once a site has visitor ids; `live` stays for cookieless sites.
 */
export const online = query({
  args: { domain: v.string(), since: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    const rows = await ctx.db
      .query("sessions")
      .withIndex("by_site_lastSeenAt", (q) =>
        q.eq("siteId", site._id).gte("lastSeenAt", args.since),
      )
      .take(MAX_LIVE_ROWS);
    return new Set(rows.map((r) => r.visitorId)).size;
  },
});

// The live tab (5h): at most this many visitors on the map and rows in the feed
const MAX_LIVE_FEED = 200;

const liveVisitor = v.object({
  visitorId: v.string(),
  name: v.union(v.null(), v.string()),
  email: v.union(v.null(), v.string()),
  // Rounded to 1 decimal at ingest; null when Vercel gave no position
  lat: v.union(v.null(), v.number()),
  lon: v.union(v.null(), v.number()),
  country: v.string(),
  region: v.union(v.null(), v.string()),
  city: v.union(v.null(), v.string()),
  device: v.string(),
  browser: v.string(),
  os: v.union(v.null(), v.string()),
  source: v.string(),
  channel: v.string(),
  path: v.string(), // the last page of their latest session
  lastSeenAt: v.number(),
});

const liveRow = v.object({
  kind: v.union(v.literal("pageview"), v.literal("goal"), v.literal("payment"), v.literal("refund")),
  id: v.string(),
  ts: v.number(),
  visitorId: v.union(v.null(), v.string()),
  name: v.union(v.null(), v.string()),
  email: v.union(v.null(), v.string()),
  path: v.union(v.null(), v.string()),
  goal: v.union(v.null(), v.string()),
  amountMinor: v.union(v.null(), v.number()),
  currency: v.union(v.null(), v.string()),
  country: v.union(v.null(), v.string()),
  city: v.union(v.null(), v.string()),
});

/**
 * The live tab: visitors online since `onlineSince` (one dot each, from their latest
 * session) and the newest pageviews, goals and payments since `since`, with visitor
 * names. Both times come from the page, like `live`. Payments only on sites with revenue.
 */
export const liveFeed = query({
  args: { domain: v.string(), since: v.number(), onlineSince: v.number() },
  returns: v.object({
    visitors: v.array(liveVisitor),
    moreVisitors: v.boolean(),
    feed: v.array(liveRow),
  }),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    const siteId = site._id;

    const visitorRows = new Map<string, Doc<"visitors"> | null>();
    async function visitor(visitorId: string | undefined) {
      if (visitorId === undefined) return null;
      if (!visitorRows.has(visitorId)) {
        const row = await ctx.db
          .query("visitors")
          .withIndex("by_site_visitor", (q) => q.eq("siteId", siteId).eq("visitorId", visitorId))
          .unique();
        visitorRows.set(visitorId, row);
      }
      return visitorRows.get(visitorId) ?? null;
    }
    const sessionRows = new Map<string, Doc<"sessions"> | null>();
    async function session(sessionId: string | undefined) {
      if (sessionId === undefined) return null;
      if (!sessionRows.has(sessionId)) {
        const row = await ctx.db
          .query("sessions")
          .withIndex("by_site_session", (q) => q.eq("siteId", siteId).eq("sessionId", sessionId))
          .unique();
        sessionRows.set(sessionId, row);
      }
      return sessionRows.get(sessionId) ?? null;
    }

    // Newest first, so each visitor's first row is their latest session
    const online = await ctx.db
      .query("sessions")
      .withIndex("by_site_lastSeenAt", (q) =>
        q.eq("siteId", siteId).gte("lastSeenAt", args.onlineSince),
      )
      .order("desc")
      .take(MAX_LIVE_ROWS);
    const latest = new Map<string, Doc<"sessions">>();
    for (const s of online) {
      sessionRows.set(s.sessionId, s);
      if (!latest.has(s.visitorId)) latest.set(s.visitorId, s);
    }
    const visitors = [];
    for (const s of [...latest.values()].slice(0, MAX_LIVE_FEED)) {
      const row = await visitor(s.visitorId);
      const { source, channel } = sessionSource(s);
      visitors.push({
        visitorId: s.visitorId,
        name: row?.name ?? null,
        email: row?.email ?? null,
        lat: s.lat ?? null,
        lon: s.lon ?? null,
        country: s.country,
        region: s.region ?? null,
        city: s.city ?? null,
        device: s.device,
        browser: s.browser,
        os: s.os ?? null,
        source,
        channel,
        path: s.exitPath,
        lastSeenAt: s.lastSeenAt,
      });
    }

    const pageviews = await ctx.db
      .query("pageviews")
      .withIndex("by_site_ts", (q) => q.eq("siteId", siteId).gte("ts", args.since))
      .order("desc")
      .take(MAX_LIVE_FEED);
    // Outbound clicks, identify calls and claims share the table; goals are what's shown
    const events = await ctx.db
      .query("events")
      .withIndex("by_site_ts", (q) => q.eq("siteId", siteId).gte("ts", args.since))
      .order("desc")
      .take(MAX_LIVE_ROWS);
    const goals = events.filter((e) => e.type === "goal");
    const revenue = (site.revenueSource ?? "none") !== "none";
    const payments = revenue
      ? await ctx.db
          .query("payments")
          .withIndex("by_site_ts", (q) => q.eq("siteId", siteId).gte("ts", args.since))
          .order("desc")
          .take(MAX_LIVE_FEED)
      : [];

    type Entry = { ts: number; build: () => Promise<Infer<typeof liveRow>> };
    const entries: Entry[] = [];
    const empty = { goal: null, amountMinor: null, currency: null };
    // The visitor's name and where their session came from
    const who = async (visitorId: string | undefined, sessionId: string | undefined) => {
      const row = await visitor(visitorId);
      const s = await session(sessionId);
      return {
        visitorId: visitorId ?? null,
        name: row?.name ?? null,
        email: row?.email ?? null,
        country: s?.country ?? null,
        city: s?.city ?? null,
      };
    };
    for (const p of pageviews) {
      entries.push({
        ts: p.ts,
        build: async () => ({
          kind: "pageview",
          id: p._id,
          ts: p.ts,
          path: p.path,
          ...empty,
          ...(await who(p.visitorId, p.sessionId)),
          country: p.country,
        }),
      });
    }
    for (const e of goals) {
      entries.push({
        ts: e.ts,
        build: async () => ({
          kind: "goal",
          id: e._id,
          ts: e.ts,
          path: e.path,
          ...empty,
          goal: e.name,
          ...(await who(e.visitorId, e.sessionId)),
        }),
      });
    }
    for (const p of payments) {
      entries.push({
        ts: p.ts,
        build: async () => {
          const row = await visitor(p.visitorId);
          return {
            kind: p.kind,
            id: p._id,
            ts: p.ts,
            visitorId: p.visitorId ?? null,
            name: row?.name ?? null,
            email: row?.email ?? p.email ?? null,
            path: null,
            goal: null,
            amountMinor: p.amountMinor,
            currency: p.currency,
            // Where the visitor paid from isn't known; the credited session may be older
            country: null,
            city: null,
          };
        },
      });
    }
    entries.sort((a, b) => b.ts - a.ts);
    const feed = [];
    for (const entry of entries.slice(0, MAX_LIVE_FEED)) feed.push(await entry.build());

    return { visitors, moreVisitors: latest.size > MAX_LIVE_FEED, feed };
  },
});

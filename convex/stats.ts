import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { requireSite } from "./lib/auth";
import { localDate } from "./lib/dates";
import { eachDate, isValidRange, previousRange, type DateRange } from "./lib/ranges";

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

const dim = v.union(
  v.literal("page"),
  v.literal("referrer"),
  v.literal("device"),
  v.literal("browser"),
  v.literal("country"),
);

const totals = v.object({
  visitors: v.number(),
  pageviews: v.number(),
  timeOnPageMs: v.union(v.null(), v.number()),
  sessions: v.number(),
  bounceRate: v.union(v.null(), v.number()), // fraction of sessions
  sessionTimeMs: v.union(v.null(), v.number()),
});

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
  for (const r of rows) {
    visitors += r.visitors;
    pageviews += r.pageviews;
    durationSumMs += r.durationSumMs;
    durationCount += r.durationCount;
    sessions += r.sessions ?? 0;
    bounces += r.bounces ?? 0;
    sessionEngagedMs += r.sessionEngagedMs ?? 0;
  }
  return {
    visitors,
    pageviews,
    timeOnPageMs: durationCount === 0 ? null : Math.round(durationSumMs / durationCount),
    sessions,
    bounceRate: sessions === 0 ? null : bounces / sessions,
    sessionTimeMs: sessions === 0 ? null : Math.round(sessionEngagedMs / sessions),
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
  returns: v.object({
    current: totals,
    previous: totals,
    comparable: v.boolean(),
    visitorsApprox: v.boolean(),
  }),
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
  returns: v.array(
    v.object({ date: v.string(), pageviews: v.number(), visitors: v.number() }),
  ),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    const range = { from: args.from, to: args.to };
    checkRange(range);

    const byDate = new Map<string, Doc<"dailyStats">>();
    for (const r of await readDailyStats(ctx, site._id, range)) byDate.set(r.date, r);
    return eachDate(range).map((date) => {
      const r = byDate.get(date);
      return { date, pageviews: r?.pageviews ?? 0, visitors: r?.visitors ?? 0 };
    });
  },
});

/**
 * Pageviews and visitors per key of one dimension over the range, largest first.
 * Pages sort by pageviews; the other lists count visitors (unique visits, as SA
 * does), so keys that only ever had repeat pageviews are left out of them.
 * The totals cover every key, including any cut off by the row limit.
 */
export const breakdown = query({
  args: { ...rangeArgs, dim },
  returns: v.object({
    rows: v.array(
      v.object({ key: v.string(), pageviews: v.number(), visitors: v.number() }),
    ),
    totalPageviews: v.number(),
    totalVisitors: v.number(),
  }),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    checkRange({ from: args.from, to: args.to });

    const rows = await ctx.db
      .query("dailyDims")
      .withIndex("by_site_dim_date", (q) =>
        q
          .eq("siteId", site._id)
          .eq("dim", args.dim)
          .gte("date", args.from)
          .lte("date", args.to),
      )
      .take(MAX_DIM_ROWS);

    const byKey = new Map<string, { key: string; pageviews: number; visitors: number }>();
    let totalPageviews = 0;
    let totalVisitors = 0;
    for (const r of rows) {
      totalPageviews += r.pageviews;
      totalVisitors += r.visitors;
      const entry = byKey.get(r.key);
      if (entry === undefined) {
        byKey.set(r.key, { key: r.key, pageviews: r.pageviews, visitors: r.visitors });
      } else {
        entry.pageviews += r.pageviews;
        entry.visitors += r.visitors;
      }
    }

    const byPageviews = args.dim === "page";
    const sorted = [...byKey.values()]
      .filter((e) => byPageviews || e.visitors > 0)
      .sort((a, b) =>
        byPageviews
          ? b.pageviews - a.pageviews || b.visitors - a.visitors || a.key.localeCompare(b.key)
          : b.visitors - a.visitors || b.pageviews - a.pageviews || a.key.localeCompare(b.key),
      );
    return {
      rows: sorted.slice(0, MAX_BREAKDOWN_KEYS),
      totalPageviews,
      totalVisitors,
    };
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

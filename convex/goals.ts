import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { sessionSource } from "./lib/attribution";
import { requireReadableSite, requireSite } from "./lib/auth";
import { hourWindow as hourBounds, localDate } from "./lib/dates";
import { dayWindow, filteredGoals, hourWindow } from "./lib/filtered";
import { filterValidator, MAX_FILTER_DAYS, MAX_FILTERS } from "./lib/filters";
import {
  goalKindValidator,
  goalRow,
  goalRows,
  MAX_GOALS,
  otherEvent,
  parseGoal,
  sortGoals,
  SourceTally,
} from "./lib/goals";
import { isValidRange, rangeDays, type DateRange } from "./lib/ranges";
import { rangeArg } from "./pages";
import { readDailyStats, sumDim } from "./stats";

// The Goals tab and the goals list in Settings (launch v1 Phase 8). See lib/goals.ts.

const HOUR_MS = 60 * 60 * 1000;
// Raw rows read for the top sources on day ranges without filters (events, pageviews of
// page goals, and the sessions they belong to); past this a kind's top sources are null
const MAX_SOURCE_ROWS = 8_000;
const MAX_SOURCE_SESSIONS = 2_000;

async function siteGoals(ctx: QueryCtx, siteId: Id<"sites">): Promise<Doc<"goals">[]> {
  return await ctx.db
    .query("goals")
    .withIndex("by_site_kind_key", (q) => q.eq("siteId", siteId))
    .take(MAX_GOALS);
}

/** The site's goals, oldest first, for Settings. */
export const list = query({
  args: { domain: v.string() },
  returns: v.array(v.object({ id: v.id("goals"), kind: goalKindValidator, key: v.string(), name: v.string() })),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    return sortGoals(await siteGoals(ctx, site._id)).map((g) => ({ id: g._id, kind: g.kind, key: g.key, name: g.name }));
  },
});

/**
 * Adds a goal: an event by the name it is sent with, or one exact path. `name` is what
 * the table shows (the key when empty). A goal that exists already is left as it is.
 */
export const create = mutation({
  args: { domain: v.string(), kind: goalKindValidator, key: v.string(), name: v.optional(v.string()) },
  returns: v.id("goals"),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    const { key, name } = parseGoal(args.kind, args.key, args.name);
    const existing = await ctx.db
      .query("goals")
      .withIndex("by_site_kind_key", (q) => q.eq("siteId", site._id).eq("kind", args.kind).eq("key", key))
      .unique();
    if (existing !== null) return existing._id;
    if ((await siteGoals(ctx, site._id)).length >= MAX_GOALS) {
      throw new ConvexError(`A site can have at most ${MAX_GOALS} goals`);
    }
    return await ctx.db.insert("goals", { siteId: site._id, kind: args.kind, key, name, createdAt: Date.now() });
  },
});

/** Removes a goal. What was recorded stays; an event goal shows under "Other events" again. */
export const remove = mutation({
  args: { domain: v.string(), id: v.id("goals") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    const goal = await ctx.db.get("goals", args.id);
    if (goal === null || goal.siteId !== site._id) throw new ConvexError("Goal not found");
    await ctx.db.delete("goals", goal._id);
    return null;
  },
});

/**
 * The Goals tab: each goal's conversions, visitors and top source over the range, the
 * recorded events that aren't goals, and the site's visitors to divide by. Day ranges
 * read the rollups (the numbers stats.goals gives the Events card); filters and hour
 * ranges go through the filtered view, as the dashboard does.
 */
export const overview = query({
  args: { domain: v.string(), range: rangeArg, filters: v.array(filterValidator) },
  returns: v.union(
    v.object({
      status: v.literal("ok"),
      rows: v.array(goalRow),
      others: v.array(otherEvent),
      visitors: v.number(),
      keyGoal: v.union(v.null(), v.string()),
    }),
    v.object({ status: v.union(v.literal("range"), v.literal("tooMany")) }),
  ),
  handler: async (ctx, args) => {
    const site = await requireReadableSite(ctx, args.domain);
    if (args.filters.length > MAX_FILTERS) throw new ConvexError(`At most ${MAX_FILTERS} filters`);
    const goals = await siteGoals(ctx, site._id);
    const keyGoal = site.keyGoal ?? null;

    if ("period" in args.range) {
      const { start, end } = hourBounds(args.range.period, args.range.now, site.timezone);
      const view = await filteredGoals(ctx, site, hourWindow(site, start, end), args.filters, goals);
      return view.status === "ok" ? { ...view, keyGoal } : view;
    }
    const range = { from: args.range.from, to: args.range.to };
    if (!isValidRange(range)) throw new ConvexError("Invalid date range");
    if (args.filters.length > 0) {
      if (rangeDays(range) > MAX_FILTER_DAYS) return { status: "range" as const };
      const view = await filteredGoals(ctx, site, dayWindow(site, range), args.filters, goals);
      return view.status === "ok" ? { ...view, keyGoal } : view;
    }

    const events = await sumDim(ctx, site._id, "goal", range);
    const hasPages = goals.some((g) => g.kind === "page");
    const pages = hasPages ? await sumDim(ctx, site._id, "page", range) : { entries: [] };
    const tally = await topSources(ctx, site, range, goals);
    const { rows, others } = goalRows(goals, events.entries, pages.entries, (id) => tally.top(id));
    const stats = await readDailyStats(ctx, site._id, range);
    return { status: "ok" as const, rows, others, visitors: stats.reduce((n, r) => n + r.visitors, 0), keyGoal };
  },
});

/**
 * Each goal's conversions by the source of the session they happened in, from the raw
 * events and (for page goals) pageviews of the range. Conversions without a session
 * (cookieless) have no source. A kind with more rows than MAX_SOURCE_ROWS, or more
 * sessions than MAX_SOURCE_SESSIONS, gets no top sources rather than wrong ones.
 */
async function topSources(
  ctx: QueryCtx,
  site: Doc<"sites">,
  { from, to }: DateRange,
  goals: Doc<"goals">[],
): Promise<SourceTally> {
  const tally = new SourceTally();
  // Local days run from UTC-12 to UTC+14; the stored or local date decides
  const start = Date.parse(`${from}T00:00:00Z`) - 14 * HOUR_MS;
  const end = Date.parse(`${to}T00:00:00Z`) + 36 * HOUR_MS;
  const inRange = (date: string) => date >= from && date <= to;
  const sessions = new Map<string, string | null>();

  // Reads each session once, by id; false when there are too many
  async function sourcesOf(ids: string[]): Promise<boolean> {
    const missing = [...new Set(ids)].filter((id) => !sessions.has(id));
    if (sessions.size + missing.length > MAX_SOURCE_SESSIONS) return false;
    for (const sessionId of missing) {
      const s = await ctx.db
        .query("sessions")
        .withIndex("by_site_session", (q) => q.eq("siteId", site._id).eq("sessionId", sessionId))
        .first();
      sessions.set(sessionId, s === null ? null : sessionSource(s).source);
    }
    return true;
  }
  async function count(hits: { goal: Id<"goals">; sessionId: string }[]) {
    if (!(await sourcesOf(hits.map((h) => h.sessionId)))) return;
    for (const h of hits) {
      const source = sessions.get(h.sessionId);
      if (source) tally.add(h.goal, source);
    }
  }

  const eventGoals = new Map(goals.filter((g) => g.kind === "event").map((g) => [g.key, g._id]));
  if (eventGoals.size > 0) {
    const rows = await ctx.db
      .query("events")
      .withIndex("by_site_ts", (q) => q.eq("siteId", site._id).gte("ts", start).lt("ts", end))
      .take(MAX_SOURCE_ROWS + 1);
    if (rows.length <= MAX_SOURCE_ROWS) {
      const hits = [];
      for (const e of rows) {
        const goal = e.type === "goal" ? eventGoals.get(e.name) : undefined;
        if (goal !== undefined && e.sessionId !== undefined && inRange(e.date)) hits.push({ goal, sessionId: e.sessionId });
      }
      await count(hits);
    }
  }

  const pageGoals = new Map(goals.filter((g) => g.kind === "page").map((g) => [g.key, g._id]));
  if (pageGoals.size > 0) {
    const rows = await ctx.db
      .query("pageviews")
      .withIndex("by_site_ts", (q) => q.eq("siteId", site._id).gte("ts", start).lt("ts", end))
      .take(MAX_SOURCE_ROWS + 1);
    if (rows.length <= MAX_SOURCE_ROWS) {
      const hits = [];
      for (const p of rows) {
        const goal = pageGoals.get(p.path);
        if (goal !== undefined && p.sessionId !== undefined && inRange(localDate(p.ts, site.timezone))) {
          hits.push({ goal, sessionId: p.sessionId });
        }
      }
      await count(hits);
    }
  }
  return tally;
}

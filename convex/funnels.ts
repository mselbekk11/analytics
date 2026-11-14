import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireReadableSite, requireSite } from "./lib/auth";
import { hourWindow, localDate } from "./lib/dates";
import { funnelCounts, funnelStepValidator, MAX_FUNNELS, parseFunnel, type Hit } from "./lib/funnels";
import { isValidRange } from "./lib/ranges";
import { rangeArg } from "./pages";

// The Funnels tab (launch v1 Phase 12). See lib/funnels.ts for how a funnel counts.

const HOUR_MS = 60 * 60 * 1000;
// Documents read per results query, pageviews and events together. Past this the tab
// asks for a shorter range instead of hitting Convex's read limits.
const MAX_READS = 15_000;

const funnelDoc = v.object({
  id: v.id("funnels"),
  name: v.string(),
  steps: v.array(funnelStepValidator),
  windowHours: v.number(),
});

async function siteFunnels(ctx: QueryCtx, siteId: Id<"sites">): Promise<Doc<"funnels">[]> {
  const rows = await ctx.db
    .query("funnels")
    .withIndex("by_site", (q) => q.eq("siteId", siteId))
    .take(MAX_FUNNELS);
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

function shape(f: Doc<"funnels">) {
  return { id: f._id, name: f.name, steps: f.steps, windowHours: f.windowHours };
}

/** The site's funnels, oldest first. */
export const list = query({
  args: { domain: v.string() },
  returns: v.array(funnelDoc),
  handler: async (ctx, args) => {
    const site = await requireReadableSite(ctx, args.domain);
    return (await siteFunnels(ctx, site._id)).map(shape);
  },
});

/** Adds a funnel: a name, 2 to 8 steps and a window in hours (24 when left out). */
export const create = mutation({
  args: {
    domain: v.string(),
    name: v.string(),
    steps: v.array(funnelStepValidator),
    windowHours: v.optional(v.number()),
  },
  returns: v.id("funnels"),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    const funnel = parseFunnel(args.name, args.steps, args.windowHours);
    if ((await siteFunnels(ctx, site._id)).length >= MAX_FUNNELS) {
      throw new ConvexError(`A site can have at most ${MAX_FUNNELS} funnels`);
    }
    return await ctx.db.insert("funnels", { siteId: site._id, ...funnel, createdAt: Date.now() });
  },
});

/**
 * Every funnel's visitors per step over the range, computed from the raw pageviews and
 * goal events: entries in the range, later steps up to each funnel's window after it.
 * Only hits with a visitor id count, so cookieless sites get `cookieless`. `read` is
 * how many documents the query read.
 */
export const results = query({
  args: { domain: v.string(), range: rangeArg },
  returns: v.union(
    v.object({
      status: v.literal("ok"),
      funnels: v.array(v.object({ id: v.id("funnels"), counts: v.array(v.number()) })),
      read: v.number(),
    }),
    v.object({ status: v.union(v.literal("cookieless"), v.literal("tooMany")) }),
  ),
  handler: async (ctx, args) => {
    const site = await requireReadableSite(ctx, args.domain);
    if (site.cookieless === true) return { status: "cookieless" as const };
    const funnels = await siteFunnels(ctx, site._id);
    if (funnels.length === 0) return { status: "ok" as const, funnels: [], read: 0 };

    // Entries are hits in the range; later steps may land up to the longest window after it
    let start: number;
    let end: number;
    let inRange: (ts: number, date: string) => boolean;
    if ("period" in args.range) {
      const w = hourWindow(args.range.period, args.range.now, site.timezone);
      start = w.start;
      end = w.end;
      inRange = (ts) => ts >= w.start && ts < w.end;
    } else {
      const range = { from: args.range.from, to: args.range.to };
      if (!isValidRange(range)) throw new ConvexError("Invalid date range");
      // Local days run from UTC-12 to UTC+14; the local date decides
      start = Date.parse(`${range.from}T00:00:00Z`) - 14 * HOUR_MS;
      end = Date.parse(`${range.to}T00:00:00Z`) + 36 * HOUR_MS;
      inRange = (_ts, date) => date >= range.from && date <= range.to;
    }
    const readEnd = end + Math.max(...funnels.map((f) => f.windowHours)) * HOUR_MS;

    const pageviews = await ctx.db
      .query("pageviews")
      .withIndex("by_site_ts", (q) => q.eq("siteId", site._id).gte("ts", start).lt("ts", readEnd))
      .take(MAX_READS + 1);
    if (pageviews.length > MAX_READS) return { status: "tooMany" as const };
    const left = MAX_READS - pageviews.length;
    const events = await ctx.db
      .query("events")
      .withIndex("by_site_ts", (q) => q.eq("siteId", site._id).gte("ts", start).lt("ts", readEnd))
      .take(left + 1);
    if (events.length > left) return { status: "tooMany" as const };

    // Each visitor's hits in time order, a pageview before the events it carries
    const journeys = new Map<string, Hit[]>();
    const add = (visitorId: string, hit: Hit) => {
      const hits = journeys.get(visitorId);
      if (hits === undefined) journeys.set(visitorId, [hit]);
      else hits.push(hit);
    };
    // Hits after the range only matter for visitors already seen in it
    const late = (ts: number, visitorId: string) => ts >= end && !journeys.has(visitorId);
    for (const p of pageviews) {
      if (p.visitorId === undefined || late(p.ts, p.visitorId)) continue;
      const entry = p.ts < end && inRange(p.ts, localDate(p.ts, site.timezone));
      add(p.visitorId, { ts: p.ts, kind: "page", key: p.path, entry });
    }
    for (const e of events) {
      if (e.type !== "goal" || e.visitorId === undefined || late(e.ts, e.visitorId)) continue;
      add(e.visitorId, { ts: e.ts, kind: "event", key: e.name, entry: e.ts < end && inRange(e.ts, e.date) });
    }
    for (const hits of journeys.values()) {
      hits.sort((a, b) => a.ts - b.ts || (a.kind === b.kind ? 0 : a.kind === "page" ? -1 : 1));
    }

    return {
      status: "ok" as const,
      funnels: funnels.map((f) => ({ id: f._id, counts: funnelCounts(journeys.values(), f.steps, f.windowHours) })),
      read: pageviews.length + events.length,
    };
  },
});

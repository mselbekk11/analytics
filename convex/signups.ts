import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireReadableSite } from "./lib/auth";
import { hourWindow as hourBounds, localDate } from "./lib/dates";
import { dayWindow, hourWindow, type ViewWindow } from "./lib/filtered";
import { JOURNEY_CAP } from "./lib/payments";
import { isValidRange } from "./lib/ranges";
import {
  countSignups,
  rankSignups,
  signupList,
  signupRow,
  signupTable,
  signupTotals,
  toSignupRow,
  type SignupRow,
} from "./lib/signups";
import { rangeArg } from "./pages";

// The Signups tab (launch v1 Phase 14). Signups are visitors by `identifiedAt` (see
// lib/signups.ts), read from one index over the range and the period before, so a query
// reads its signups and, for the 50 rows shown, their sessions up to the signup.

// Visitors read over the range and the period before; past it the tab says "too many"
export const MAX_SIGNUP_READS = 5_000;

/**
 * The Signups tab: `totals` for the tiles (lib/signups.ts signupTiles), free and paying
 * signups at each point of the range for the chart, signups by source, country and
 * landing page, and one page of "People who signed up" (50 from `offset`, newest first,
 * kept to what `search` matches; `matched` counts those). Filters don't apply. `status`
 * is "cookieless" on a cookieless site (no visitors to identify) and "tooMany" past
 * the read limit.
 */
export const list = query({
  args: { domain: v.string(), range: rangeArg, search: v.string(), offset: v.number() },
  returns: v.union(
    v.object({
      status: v.literal("ok"),
      totals: signupTotals,
      chart: v.array(v.object({ date: v.string(), free: v.number(), paying: v.number() })),
      lists: v.object({ source: signupList, country: signupList, landing: signupList }),
      rows: v.array(signupRow),
      offset: v.number(),
      matched: v.number(),
    }),
    v.object({ status: v.union(v.literal("cookieless"), v.literal("tooMany")) }),
  ),
  handler: async (ctx, args) => {
    const site = await requireReadableSite(ctx, args.domain);
    if (site.cookieless === true) return { status: "cookieless" as const };

    let window: ViewWindow;
    if ("period" in args.range) {
      const { start, end } = hourBounds(args.range.period, args.range.now, site.timezone);
      window = hourWindow(site, start, end);
    } else {
      const range = { from: args.range.from, to: args.range.to };
      if (!isValidRange(range)) throw new ConvexError("Invalid date range");
      window = dayWindow(site, range);
    }

    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_site_identifiedAt", (q) =>
        q.eq("siteId", site._id).gte("identifiedAt", window.start).lt("identifiedAt", window.end),
      )
      .take(MAX_SIGNUP_READS + 1);
    if (visitors.length > MAX_SIGNUP_READS) return { status: "tooMany" as const };

    const current: Doc<"visitors">[] = [];
    const previous: Doc<"visitors">[] = [];
    const points = new Map(window.points.map((p) => [p, { free: 0, paying: 0 }]));
    for (const visitor of visitors) {
      const ts = visitor.identifiedAt!;
      const date = localDate(ts, site.timezone);
      if (window.current(ts, date)) {
        current.push(visitor);
        const point = points.get(window.point(ts, date) ?? "");
        if (point !== undefined) {
          if (visitor.firstPaidAt !== undefined) point.paying++;
          else point.free++;
        }
      } else if (window.previous(ts, date)) {
        previous.push(visitor);
      }
    }

    const now = countSignups(current);
    const before = countSignups(previous);
    const all = current.map(toSignupRow);
    const table = signupTable(all, args);
    const rows: SignupRow[] = [];
    for (const row of table.rows) {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_site_visitor_started", (q) =>
          q.eq("siteId", site._id).eq("visitorId", row.visitorId).lte("startedAt", row.identifiedAt),
        )
        .take(JOURNEY_CAP + 1);
      rows.push({ ...row, journey: sessions.length });
    }

    return {
      status: "ok" as const,
      totals: {
        signups: now.signups,
        paying: now.paying,
        tookSumMs: now.tookSumMs,
        previousSignups: before.signups,
        previousPaying: before.paying,
        previousTookSumMs: before.tookSumMs,
      },
      chart: window.points.map((date) => ({ date, ...points.get(date)! })),
      lists: {
        source: rankSignups(all, (r) => r.source ?? "Unknown"),
        country: rankSignups(all, (r) => r.country ?? "Unknown"),
        landing: rankSignups(all, (r) => r.landingPath ?? "Unknown"),
      },
      rows,
      offset: table.offset,
      matched: table.matched,
    };
  },
});

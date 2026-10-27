import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { countCookielessVisit, countSession, sessionSource } from "./lib/attribution";
import { localDate } from "./lib/dates";
import { bumpSessionDim } from "./lib/rollups";
import { classify } from "./lib/sources";

// Phase 5b backfill: source and channel for everything recorded before the site's
// first classified pageview (`sourcesStartedAt`). Run once after deploying 5b:
//
//   npx convex run migrations:backfillSources          (dev)
//   npx convex run migrations:backfillSources --prod   (production)
//
// Each site runs in three steps, each a batch that reschedules itself:
// 1. "dims": days before visitor tracking started have no sessions, so their
//    `referrer` dim rows (visitors per referrer and day) become source and channel rows.
// 2. "sessions": sessions from 5a get source and channel, and are counted on their
//    source, entry and exit dims, the same way ingest counts new sessions.
// 3. "pageviews": unique visits without ids (cookieless or old scripts) from the day
//    visitor tracking started up to `sourcesStartedAt`, counted as ingest now does.
// A site is marked `sourcesBackfilled` at the start, so running this twice is safe.

const DIMS_BATCH = 500;
const SESSIONS_BATCH = 200;
const PAGEVIEWS_BATCH = 500;
const HOUR_MS = 60 * 60 * 1000;

export const backfillSources = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    for await (const site of ctx.db.query("sites")) {
      if (site.sourcesBackfilled) continue;
      await ctx.db.patch("sites", site._id, {
        sourcesBackfilled: true,
        sourcesStartedAt: site.sourcesStartedAt ?? now,
      });
      await ctx.scheduler.runAfter(0, internal.migrations.backfillSite, {
        siteId: site._id,
        step: "dims",
        cursor: null,
      });
    }
    return null;
  },
});

export const backfillSite = internalMutation({
  args: {
    siteId: v.id("sites"),
    step: v.union(v.literal("dims"), v.literal("sessions"), v.literal("pageviews")),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { siteId, step, cursor }) => {
    const site = await ctx.db.get("sites", siteId);
    if (site === null || site.sourcesStartedAt === undefined) return null;
    const cutoff = site.sourcesStartedAt;
    // Days before this have only referrer rollups; from it on, raw rows are read
    const split = localDate(Math.min(site.trackingStartedAt ?? cutoff, cutoff), site.timezone);

    let next: { step: typeof step; cursor: string | null } | null = null;

    if (step === "dims") {
      const page = await ctx.db
        .query("dailyDims")
        .withIndex("by_site_dim_date", (q) =>
          q.eq("siteId", siteId).eq("dim", "referrer").lt("date", split),
        )
        .paginate({ numItems: DIMS_BATCH, cursor });
      for (const row of page.page) {
        if (row.visitors === 0) continue;
        const { source, channel } = classify({ referrer: row.key });
        const delta = { visitors: row.visitors };
        await bumpSessionDim(ctx, siteId, row.date, "source", source, delta);
        await bumpSessionDim(ctx, siteId, row.date, "channel", channel, delta);
      }
      next = page.isDone
        ? { step: "sessions", cursor: null }
        : { step, cursor: page.continueCursor };
    } else if (step === "sessions") {
      const page = await ctx.db
        .query("sessions")
        .withIndex("by_site_started", (q) => q.eq("siteId", siteId))
        .paginate({ numItems: SESSIONS_BATCH, cursor });
      for (const session of page.page) {
        if (session.source !== undefined) continue;
        const attribution = sessionSource(session);
        await ctx.db.patch("sessions", session._id, attribution);
        await countSession(ctx, { ...session, ...attribution });

        const visitor = await ctx.db
          .query("visitors")
          .withIndex("by_site_visitor", (q) =>
            q.eq("siteId", siteId).eq("visitorId", session.visitorId),
          )
          .unique();
        // Sessions run oldest first, so the first one seen is the visitor's first
        if (visitor !== null && visitor.firstSource === undefined) {
          await ctx.db.patch("visitors", visitor._id, {
            firstSource: attribution.source,
            firstChannel: attribution.channel,
          });
        }
      }
      next = page.isDone
        ? { step: "pageviews", cursor: null }
        : { step, cursor: page.continueCursor };
    } else {
      const start = Date.parse(`${split}T00:00:00Z`) - 14 * HOUR_MS;
      const page = await ctx.db
        .query("pageviews")
        .withIndex("by_site_ts", (q) =>
          q.eq("siteId", siteId).gte("ts", start).lt("ts", cutoff),
        )
        .paginate({ numItems: PAGEVIEWS_BATCH, cursor });
      for (const pv of page.page) {
        if (pv.visitorId !== undefined || !pv.unique) continue;
        const date = localDate(pv.ts, site.timezone);
        if (date < split) continue;
        await countCookielessVisit(ctx, siteId, date, classify({ referrer: pv.referrer }));
      }
      next = page.isDone ? null : { step, cursor: page.continueCursor };
    }

    if (next !== null) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillSite, { siteId, ...next });
    }
    return null;
  },
});

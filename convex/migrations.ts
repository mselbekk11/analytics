import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { countCookielessVisit, countSession, sessionSource } from "./lib/attribution";
import { localDate } from "./lib/dates";
import { bumpPageDim, bumpSessionDim, type PageDelta } from "./lib/rollups";
import { classify } from "./lib/sources";
import { addUsage, monthStart, utcDate, utcMonth } from "./lib/usage";

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

// Design v4 Phase 6 backfill: sessions, entries, bounces and time on the page rows for
// everything before the site's first pageview that counted them at ingest
// (`pageStatsStartedAt`, the cutoff). Run once after deploying Phase 6:
//
//   npx convex run migrations:backfillPageStats          (dev)
//   npx convex run migrations:backfillPageStats --prod   (production)
//
// Each site runs in two steps, each a batch that reschedules itself:
// 1. "pageviews": each pageview before the cutoff adds its engaged time to its page and
//    day, and the session's first pageview of a path adds a session there.
// 2. "sessions": each session started before the cutoff adds an entry to its entry page
//    on the day it started, and a bounce if it had one pageview and no goal by the
//    cutoff. Ingest takes the bounce back if the session goes on after it.
// Cookieless pageviews have no session, so they only add time. A site is marked
// `pageStatsBackfilled` at the start, so running this twice is safe. Pings that arrive
// for a pageview from before the cutoff after its batch ran are not counted on its page.

const PAGE_STATS_BATCH = 200;
// Pageviews and goals read per session to tell what happened before the cutoff
const SESSION_READS = 1_000;

export const backfillPageStats = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    for await (const site of ctx.db.query("sites")) {
      if (site.pageStatsBackfilled) continue;
      await ctx.db.patch("sites", site._id, {
        pageStatsBackfilled: true,
        pageStatsStartedAt: site.pageStatsStartedAt ?? now,
      });
      await ctx.scheduler.runAfter(0, internal.migrations.backfillPageStatsSite, {
        siteId: site._id,
        step: "pageviews",
        cursor: null,
      });
    }
    return null;
  },
});

export const backfillPageStatsSite = internalMutation({
  args: {
    siteId: v.id("sites"),
    step: v.union(v.literal("pageviews"), v.literal("sessions")),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { siteId, step, cursor }) => {
    const site = await ctx.db.get("sites", siteId);
    if (site === null || site.pageStatsStartedAt === undefined) return null;
    const cutoff = site.pageStatsStartedAt;

    let next: { step: typeof step; cursor: string | null } | null = null;
    if (step === "pageviews") {
      const page = await ctx.db
        .query("pageviews")
        .withIndex("by_site_ts", (q) => q.eq("siteId", siteId).lt("ts", cutoff))
        .paginate({ numItems: PAGE_STATS_BATCH, cursor });
      for (const pv of page.page) {
        const delta: PageDelta = {};
        if (pv.durationMs !== undefined) {
          delta.engagedMs = pv.durationMs;
          delta.durationCount = 1;
        }
        const sessionId = pv.sessionId;
        if (sessionId !== undefined) {
          const earlier = await ctx.db
            .query("pageviews")
            .withIndex("by_site_session", (q) =>
              q.eq("siteId", siteId).eq("sessionId", sessionId).lte("ts", pv.ts),
            )
            .take(SESSION_READS);
          const seen = earlier.some(
            (p) => p.path === pv.path && p._id !== pv._id && (p.ts < pv.ts || p._creationTime < pv._creationTime),
          );
          if (!seen) delta.sessions = 1;
        }
        if (Object.keys(delta).length > 0) {
          await bumpPageDim(ctx, siteId, localDate(pv.ts, site.timezone), pv.path, delta);
        }
      }
      next = page.isDone ? { step: "sessions", cursor: null } : { step, cursor: page.continueCursor };
    } else {
      const page = await ctx.db
        .query("sessions")
        .withIndex("by_site_started", (q) => q.eq("siteId", siteId).lt("startedAt", cutoff))
        .paginate({ numItems: PAGE_STATS_BATCH, cursor });
      for (const session of page.page) {
        const bounced = await bouncedBy(ctx, session, cutoff);
        await bumpPageDim(ctx, siteId, session.date, session.entryPath, {
          entries: 1,
          bounces: bounced ? 1 : 0,
        });
      }
      next = page.isDone ? null : { step, cursor: page.continueCursor };
    }

    if (next !== null) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillPageStatsSite, { siteId, ...next });
    }
    return null;
  },
});

/** Whether the session had one pageview and no goal before `cutoff`, as ingest counted it then. */
async function bouncedBy(ctx: MutationCtx, session: Doc<"sessions">, cutoff: number): Promise<boolean> {
  if (session.pageviews > 1) {
    const before = await ctx.db
      .query("pageviews")
      .withIndex("by_site_session", (q) =>
        q.eq("siteId", session.siteId).eq("sessionId", session.sessionId).lt("ts", cutoff),
      )
      .take(2);
    if (before.length > 1) return false;
  }
  if (session.goals === 0) return true;
  const goals = await ctx.db
    .query("events")
    .withIndex("by_site_visitor_ts", (q) =>
      q
        .eq("siteId", session.siteId)
        .eq("visitorId", session.visitorId)
        .gte("ts", session.startedAt)
        .lt("ts", cutoff),
    )
    .take(SESSION_READS);
  return !goals.some((e) => e.type === "goal" && e.sessionId === session.sessionId);
}

// Design v4 Phase 9 backfill: each visitor's totals for the Users table (pageviews and
// engaged time over their sessions) and the latest session's location, device, browser,
// entry and exit. Run once after deploying Phase 9:
//
//   npx convex run migrations:backfillVisitorTotals          (dev)
//   npx convex run migrations:backfillVisitorTotals --prod   (production)
//
// Each site's visitors go in batches that reschedule themselves. Every visitor is
// recounted from its sessions, which ingest keeps current in the same transactions, so
// running this twice (or while hits come in) is safe and leaves the same totals.

const VISITOR_TOTALS_BATCH = 20;
// Sessions read per visitor; a visitor past it keeps the totals of its latest sessions
const VISITOR_SESSION_READS = 500;

export const backfillVisitorTotals = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for await (const site of ctx.db.query("sites")) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillVisitorTotalsSite, {
        siteId: site._id,
        cursor: null,
      });
    }
    return null;
  },
});

export const backfillVisitorTotalsSite = internalMutation({
  args: { siteId: v.id("sites"), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, { siteId, cursor }) => {
    const page = await ctx.db
      .query("visitors")
      .withIndex("by_site_visitor", (q) => q.eq("siteId", siteId))
      .paginate({ numItems: VISITOR_TOTALS_BATCH, cursor });
    for (const visitor of page.page) {
      await ctx.db.patch("visitors", visitor._id, await visitorTotals(ctx, visitor));
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillVisitorTotalsSite, {
        siteId,
        cursor: page.continueCursor,
      });
    }
    return null;
  },
});

/** The visitor's totals and latest details, recounted from its sessions (newest first). */
async function visitorTotals(ctx: MutationCtx, visitor: Doc<"visitors">) {
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_site_visitor_started", (q) =>
      q.eq("siteId", visitor.siteId).eq("visitorId", visitor.visitorId),
    )
    .order("desc")
    .take(VISITOR_SESSION_READS);
  const latest = sessions[0];
  return {
    pageviews: sessions.reduce((sum, s) => sum + s.pageviews, 0),
    engagedMs: sessions.reduce((sum, s) => sum + s.engagedMs, 0),
    // Undefined removes the field, so a visitor without sessions keeps no stale details
    country: latest?.country,
    region: latest?.region,
    city: latest?.city,
    device: latest?.device,
    browser: latest?.browser,
    entryPath: latest?.entryPath,
    exitPath: latest?.exitPath,
  };
}

// Launch v1 Phase 6 backfill: the usage meter's rows (usageDays) for this UTC month's
// pageviews, goals and outbound clicks recorded before ingest started counting them
// (each site's `usageStartedAt`). Earlier months aren't needed: the meter only shows the
// current one. Run once after deploying Phase 6:
//
//   npx convex run migrations:backfillUsage          (dev)
//   npx convex run migrations:backfillUsage --prod   (production)
//
// A site is marked `usageBackfilled` at the start, so running this twice is safe.

const USAGE_BATCH = 1_000;

export const backfillUsage = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const from = monthStart(utcMonth(now));
    for await (const site of ctx.db.query("sites")) {
      if (site.usageBackfilled) continue;
      await ctx.db.patch("sites", site._id, {
        usageBackfilled: true,
        usageStartedAt: site.usageStartedAt ?? now,
      });
      await ctx.scheduler.runAfter(0, internal.migrations.backfillUsageSite, {
        siteId: site._id,
        from,
        step: "pageviews",
        cursor: null,
      });
    }
    return null;
  },
});

export const backfillUsageSite = internalMutation({
  args: {
    siteId: v.id("sites"),
    from: v.number(), // the start of the month being backfilled
    step: v.union(v.literal("pageviews"), v.literal("events")),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, { siteId, from, step, cursor }) => {
    const site = await ctx.db.get("sites", siteId);
    if (site === null || site.usageStartedAt === undefined) return null;
    const cutoff = site.usageStartedAt;

    // Summed per day first, so a batch writes each day's row once
    const days = new Map<string, number>();
    let page;
    if (step === "pageviews") {
      page = await ctx.db
        .query("pageviews")
        .withIndex("by_site_ts", (q) => q.eq("siteId", siteId).gte("ts", from).lt("ts", cutoff))
        .paginate({ numItems: USAGE_BATCH, cursor });
      for (const pv of page.page) days.set(utcDate(pv.ts), (days.get(utcDate(pv.ts)) ?? 0) + 1);
    } else {
      page = await ctx.db
        .query("events")
        .withIndex("by_site_ts", (q) => q.eq("siteId", siteId).gte("ts", from).lt("ts", cutoff))
        .paginate({ numItems: USAGE_BATCH, cursor });
      for (const e of page.page) {
        if (e.type === "goal" || e.type === "outbound") days.set(utcDate(e.ts), (days.get(utcDate(e.ts)) ?? 0) + 1);
      }
    }
    for (const [date, n] of days) {
      await addUsage(ctx, siteId, date, step === "pageviews" ? { pageviews: n } : { events: n });
    }

    const next = !page.isDone
      ? { step, cursor: page.continueCursor }
      : step === "pageviews"
        ? { step: "events" as const, cursor: null }
        : null;
    if (next !== null) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillUsageSite, { siteId, from, ...next });
    }
    return null;
  },
});

// Launch v1 Phase 2: moving to the Clerk production instance gives the owner a new
// tokenIdentifier (new issuer and new user id). This hands every site and MCP key from
// the old id to the new one. Run once on production after the owner's first sign-in:
//
//   npx convex run --prod migrations:moveOwner \
//     '{"from":"https://settling-starling-6439.clerk.accounts.dev|user_…","to":"https://clerk.simplestats.ai|user_…"}'
//
// Running it again finds nothing left under `from` and changes nothing.
export const moveOwner = internalMutation({
  args: { from: v.string(), to: v.string() },
  returns: v.object({ sites: v.number(), apiKeys: v.number() }),
  handler: async (ctx, { from, to }) => {
    if (from === to || !from.includes("|") || !to.includes("|")) {
      throw new Error("from and to must be two different tokenIdentifiers (issuer|user id)");
    }
    let sites = 0;
    for await (const site of ctx.db.query("sites").withIndex("by_owner", (q) => q.eq("ownerId", from))) {
      await ctx.db.patch("sites", site._id, { ownerId: to });
      sites++;
    }
    let apiKeys = 0;
    for await (const key of ctx.db.query("apiKeys").withIndex("by_owner", (q) => q.eq("ownerId", from))) {
      await ctx.db.patch("apiKeys", key._id, { ownerId: to });
      apiKeys++;
    }
    return { sites, apiKeys };
  },
});

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { findOwnedSite, requireOwnerId, requireSite } from "./lib/auth";
import { isValidTimeZone, localDate } from "./lib/dates";
import { normalizeDomain } from "./lib/domain";
import { eachDate, presetRange } from "./lib/ranges";

const MAX_SITES = 500;

export const create = mutation({
  args: { domain: v.string(), timezone: v.string() },
  returns: v.object({ siteId: v.id("sites"), domain: v.string() }),
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);

    const domain = normalizeDomain(args.domain);
    if (domain === null) {
      throw new ConvexError("Enter a domain like example.com");
    }
    if (!isValidTimeZone(args.timezone)) {
      throw new ConvexError("Unknown timezone");
    }

    const existing = await ctx.db
      .query("sites")
      .withIndex("by_domain", (q) => q.eq("domain", domain))
      .unique();
    if (existing !== null) {
      throw new ConvexError(`${domain} has already been added`);
    }

    const siteId = await ctx.db.insert("sites", {
      ownerId,
      domain,
      timezone: args.timezone,
      createdAt: Date.now(),
    });
    return { siteId, domain };
  },
});

const siteSummary = v.object({ domain: v.string(), timezone: v.string() });

/**
 * The signed-in user's site with this domain, or null if it is missing or not theirs.
 * `trackingStartedAt` is when the first hit with a visitor id arrived (null until then,
 * and for cookieless sites).
 */
export const get = query({
  args: { domain: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      domain: v.string(),
      timezone: v.string(),
      trackingStartedAt: v.union(v.null(), v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const site = await findOwnedSite(ctx, args.domain);
    if (site === null) return null;
    return {
      domain: site.domain,
      timezone: site.timezone,
      trackingStartedAt: site.trackingStartedAt ?? null,
    };
  },
});

/** The signed-in user's sites, sorted by domain. Feeds the site switcher. */
export const list = query({
  args: {},
  returns: v.array(siteSummary),
  handler: async (ctx) => {
    const ownerId = await requireOwnerId(ctx);
    const sites = await ctx.db
      .query("sites")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .take(MAX_SITES);
    return sites
      .map((s) => ({ domain: s.domain, timezone: s.timezone }))
      .sort((a, b) => a.domain.localeCompare(b.domain));
  },
});

const LIST_DAYS = "30d";

/**
 * Every site of the signed-in user with its last 30 days of daily pageviews and
 * visitors (today included, missing days as zero) and the 30-day totals. Feeds the
 * /websites cards. `now` comes from the page, because queries must not read the
 * clock; each site's "today" is taken in its own timezone.
 */
export const listWithStats = query({
  args: { now: v.number() },
  returns: v.array(
    v.object({
      domain: v.string(),
      pageviews: v.number(),
      visitors: v.number(),
      days: v.array(
        v.object({ date: v.string(), pageviews: v.number(), visitors: v.number() }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const ownerId = await requireOwnerId(ctx);
    const sites = await ctx.db
      .query("sites")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .take(MAX_SITES);

    const out = await Promise.all(
      sites.map(async (site) => {
        const range = presetRange(LIST_DAYS, localDate(args.now, site.timezone));
        const rows = await ctx.db
          .query("dailyStats")
          .withIndex("by_site_date", (q) =>
            q.eq("siteId", site._id).gte("date", range.from).lte("date", range.to),
          )
          .take(100);
        const byDate = new Map<string, Doc<"dailyStats">>();
        for (const r of rows) byDate.set(r.date, r);
        const days = eachDate(range).map((date) => {
          const r = byDate.get(date);
          return { date, pageviews: r?.pageviews ?? 0, visitors: r?.visitors ?? 0 };
        });
        return {
          domain: site.domain,
          pageviews: days.reduce((n, d) => n + d.pageviews, 0),
          visitors: days.reduce((n, d) => n + d.visitors, 0),
          days,
        };
      }),
    );
    return out.sort((a, b) => a.domain.localeCompare(b.domain));
  },
});

/** Changes a site's timezone. Only new hits use it; stored days keep their dates. */
export const update = mutation({
  args: { domain: v.string(), timezone: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    if (!isValidTimeZone(args.timezone)) {
      throw new ConvexError("Unknown timezone");
    }
    await ctx.db.patch("sites", site._id, { timezone: args.timezone });
    return null;
  },
});

/**
 * Deletes a site. The site row goes at once, so the dashboard and ingest stop seeing
 * it; its hits and rollups are deleted in scheduled batches by deleteSiteData,
 * because one mutation can only write so many documents.
 */
export const remove = mutation({
  args: { domain: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    await ctx.db.delete("sites", site._id);
    await ctx.scheduler.runAfter(0, internal.sites.deleteSiteData, { siteId: site._id });
    return null;
  },
});

// Five tables per run, well inside the per-mutation write limit
const DELETE_BATCH = 1000;

export const deleteSiteData = internalMutation({
  args: { siteId: v.id("sites") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { siteId } = args;
    const pageviews = await ctx.db
      .query("pageviews")
      .withIndex("by_site_ts", (q) => q.eq("siteId", siteId))
      .take(DELETE_BATCH);
    for (const row of pageviews) await ctx.db.delete("pageviews", row._id);

    const dims = await ctx.db
      .query("dailyDims")
      .withIndex("by_site_dim_date", (q) => q.eq("siteId", siteId))
      .take(DELETE_BATCH);
    for (const row of dims) await ctx.db.delete("dailyDims", row._id);

    const stats = await ctx.db
      .query("dailyStats")
      .withIndex("by_site_date", (q) => q.eq("siteId", siteId))
      .take(DELETE_BATCH);
    for (const row of stats) await ctx.db.delete("dailyStats", row._id);

    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_site_started", (q) => q.eq("siteId", siteId))
      .take(DELETE_BATCH);
    for (const row of sessions) await ctx.db.delete("sessions", row._id);

    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_site_lastSeen", (q) => q.eq("siteId", siteId))
      .take(DELETE_BATCH);
    for (const row of visitors) await ctx.db.delete("visitors", row._id);

    const batches = [pageviews, dims, stats, sessions, visitors];
    if (batches.some((rows) => rows.length === DELETE_BATCH)) {
      await ctx.scheduler.runAfter(0, internal.sites.deleteSiteData, { siteId });
    }
    return null;
  },
});

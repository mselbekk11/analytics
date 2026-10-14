import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { localDate } from "./lib/dates";
import { hostMatchesDomain, normalizeDomain } from "./lib/domain";
import { bumpDailyDim, bumpDailyStats } from "./lib/rollups";

// These are public because /api/collect calls them over HTTP, so every call must
// carry INGEST_SECRET. Hits for unknown sites or foreign hostnames are dropped
// silently: the route always answers 204, so there is no one to report to.

const MAX_DURATION_MS = 30 * 60 * 1000;

function checkSecret(secret: string): void {
  const expected = process.env.INGEST_SECRET;
  if (!expected || secret !== expected) {
    throw new Error("Invalid ingest secret");
  }
}

async function findSite(
  ctx: MutationCtx,
  site: string,
  hostname: string,
): Promise<Doc<"sites"> | null> {
  const domain = normalizeDomain(site);
  if (domain === null) return null;
  const doc = await ctx.db
    .query("sites")
    .withIndex("by_domain", (q) => q.eq("domain", domain))
    .unique();
  if (doc === null || !hostMatchesDomain(hostname, doc.domain)) return null;
  return doc;
}

export const pageview = mutation({
  args: {
    secret: v.string(),
    site: v.string(), // data-site from the embed snippet
    hostname: v.string(), // from the request's Origin/Referer, checked against the site
    path: v.string(),
    referrer: v.string(),
    unique: v.boolean(),
    device: v.union(v.literal("mobile"), v.literal("tablet"), v.literal("desktop")),
    browser: v.string(),
    country: v.string(),
    pvId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    checkSecret(args.secret);
    const site = await findSite(ctx, args.site, args.hostname);
    if (site === null) return null;

    // A retried beacon must not count twice
    const seen = await ctx.db
      .query("pageviews")
      .withIndex("by_pvId", (q) => q.eq("pvId", args.pvId))
      .first();
    if (seen !== null) return null;

    const ts = Date.now();
    await ctx.db.insert("pageviews", {
      siteId: site._id,
      ts,
      path: args.path,
      referrer: args.referrer,
      unique: args.unique,
      device: args.device,
      browser: args.browser,
      country: args.country,
      pvId: args.pvId,
    });

    const date = localDate(ts, site.timezone);
    await bumpDailyStats(ctx, site._id, date, {
      pageviews: 1,
      visitors: args.unique ? 1 : 0,
    });
    await bumpDailyDim(ctx, site._id, date, "page", args.path, args.unique);
    await bumpDailyDim(ctx, site._id, date, "referrer", args.referrer, args.unique);
    await bumpDailyDim(ctx, site._id, date, "device", args.device, args.unique);
    await bumpDailyDim(ctx, site._id, date, "browser", args.browser, args.unique);
    await bumpDailyDim(ctx, site._id, date, "country", args.country, args.unique);
    return null;
  },
});

export const duration = mutation({
  args: {
    secret: v.string(),
    site: v.string(),
    hostname: v.string(),
    pvId: v.string(),
    ms: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    checkSecret(args.secret);
    if (!Number.isInteger(args.ms) || args.ms < 0 || args.ms > MAX_DURATION_MS) {
      return null;
    }
    const site = await findSite(ctx, args.site, args.hostname);
    if (site === null) return null;

    const pv = await ctx.db
      .query("pageviews")
      .withIndex("by_pvId", (q) => q.eq("pvId", args.pvId))
      .first();
    if (pv === null || pv.siteId !== site._id || pv.durationMs !== undefined) {
      return null;
    }

    await ctx.db.patch("pageviews", pv._id, { durationMs: args.ms });
    // Count it on the pageview's day, so a tab left open past midnight lands correctly
    await bumpDailyStats(ctx, site._id, localDate(pv.ts, site.timezone), {
      durationSumMs: args.ms,
      durationCount: 1,
    });
    return null;
  },
});

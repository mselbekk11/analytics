import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action, internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { findOwnedSite, requireOwnerId, requireSite } from "./lib/auth";
import { isValidTimeZone, localDate } from "./lib/dates";
import { normalizeDomain } from "./lib/domain";
import { eachDate, presetRange } from "./lib/ranges";
import { siteCurrency } from "./lib/revenue";
import { STRIPE_EVENTS } from "./lib/stripe";

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

const revenueSourceValidator = v.union(v.literal("none"), v.literal("stripe"), v.literal("api"));

const siteSummary = v.object({ domain: v.string(), timezone: v.string() });

/**
 * The signed-in user's site with this domain, or null if it is missing or not theirs.
 * `trackingStartedAt` is when the first hit with a visitor id arrived (null until then,
 * and for cookieless sites). `keyGoal` is the goal the site converts on, if one is set.
 * `revenueSource` is "none" unless the site takes payments from Stripe or the API.
 */
export const get = query({
  args: { domain: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      domain: v.string(),
      timezone: v.string(),
      trackingStartedAt: v.union(v.null(), v.number()),
      keyGoal: v.union(v.null(), v.string()),
      revenueSource: revenueSourceValidator,
      currency: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const site = await findOwnedSite(ctx, args.domain);
    if (site === null) return null;
    return {
      domain: site.domain,
      timezone: site.timezone,
      trackingStartedAt: site.trackingStartedAt ?? null,
      keyGoal: site.keyGoal ?? null,
      revenueSource: site.revenueSource ?? "none",
      currency: siteCurrency(site),
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

// Goal names for the key-goal picker come from the goal rollups; a site has a handful
const MAX_GOAL_ROWS = 5_000;

/** Every goal name the site has recorded, sorted, for the key-goal picker in Settings. */
export const goalNames = query({
  args: { domain: v.string() },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    const rows = await ctx.db
      .query("dailyDims")
      .withIndex("by_site_dim_date", (q) => q.eq("siteId", site._id).eq("dim", "goal"))
      .order("desc")
      .take(MAX_GOAL_ROWS);
    return [...new Set(rows.map((r) => r.key))].sort((a, b) => a.localeCompare(b));
  },
});

/** Sets the goal a site converts on (null clears it). Any name is accepted, recorded or not. */
export const setKeyGoal = mutation({
  args: { domain: v.string(), keyGoal: v.union(v.null(), v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    const keyGoal = args.keyGoal?.trim() || undefined;
    if (keyGoal !== undefined && keyGoal.length > 100) {
      throw new ConvexError("Goal names are at most 100 characters");
    }
    await ctx.db.patch("sites", site._id, { keyGoal });
    return null;
  },
});

/**
 * The Revenue section of Settings. Secrets never leave the server: only whether each
 * one is set. The webhook URL is this deployment's HTTP actions URL plus the site id.
 */
export const revenueSettings = query({
  args: { domain: v.string() },
  returns: v.object({
    revenueSource: revenueSourceValidator,
    currency: v.string(),
    webhookUrl: v.string(),
    webhookEvents: v.array(v.string()),
    hasWebhookSecret: v.boolean(),
    hasApiKey: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    const secrets = await ctx.db
      .query("siteSecrets")
      .withIndex("by_site", (q) => q.eq("siteId", site._id))
      .unique();
    return {
      revenueSource: site.revenueSource ?? "none",
      currency: siteCurrency(site),
      webhookUrl: `${process.env.CONVEX_SITE_URL}/stripe/${site._id}`,
      webhookEvents: [...STRIPE_EVENTS],
      hasWebhookSecret: secrets?.stripeWebhookSecret !== undefined,
      hasApiKey: secrets?.apiKeyHash !== undefined,
    };
  },
});

/**
 * Where a site's payments come from, and the one currency its totals use. A change of
 * currency applies to new payments; ones already counted stay in the totals.
 */
export const setRevenue = mutation({
  args: { domain: v.string(), revenueSource: revenueSourceValidator, currency: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    const currency = args.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new ConvexError("Currency must be a three-letter code such as USD");
    }
    await ctx.db.patch("sites", site._id, { revenueSource: args.revenueSource, currency });
    return null;
  },
});

async function upsertSecrets(
  ctx: MutationCtx,
  site: Doc<"sites">,
  fields: { stripeWebhookSecret?: string; apiKeyHash?: string },
): Promise<void> {
  const secrets = await ctx.db
    .query("siteSecrets")
    .withIndex("by_site", (q) => q.eq("siteId", site._id))
    .unique();
  if (secrets === null) {
    await ctx.db.insert("siteSecrets", { siteId: site._id, ...fields });
  } else {
    await ctx.db.patch("siteSecrets", secrets._id, fields);
  }
}

/** Stores the Stripe webhook signing secret (whsec_...), replacing any earlier one. */
export const setStripeSecret = mutation({
  args: { domain: v.string(), secret: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    const secret = args.secret.trim();
    if (!/^whsec_[A-Za-z0-9+/=_-]{16,200}$/.test(secret)) {
      throw new ConvexError("The signing secret starts with whsec_ (Stripe → Webhooks → your endpoint → Signing secret)");
    }
    await upsertSecrets(ctx, site, { stripeWebhookSecret: secret });
    return null;
  },
});

/**
 * Creates the site's payments API key and returns it, once. Only its SHA-256 is kept,
 * so a new key replaces the old one. An action, because mutations have no real
 * randomness.
 */
export const createApiKey = action({
  args: { domain: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const key = `va_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
    await ctx.runMutation(internal.sites.storeApiKeyHash, { domain: args.domain, apiKeyHash: await sha256Hex(key) });
    return key;
  },
});

export const storeApiKeyHash = internalMutation({
  args: { domain: v.string(), apiKeyHash: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    // The action's caller is the signed-in user, so this checks their ownership
    const site = await requireSite(ctx, args.domain);
    await upsertSecrets(ctx, site, { apiKeyHash: args.apiKeyHash });
    return null;
  },
});

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

// Nine tables per run, well inside the per-mutation write limit (16,000 writes)
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

    const events = await ctx.db
      .query("events")
      .withIndex("by_site_ts", (q) => q.eq("siteId", siteId))
      .take(DELETE_BATCH);
    for (const row of events) await ctx.db.delete("events", row._id);

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_site_ts", (q) => q.eq("siteId", siteId))
      .take(DELETE_BATCH);
    for (const row of payments) await ctx.db.delete("payments", row._id);

    const checkouts = await ctx.db
      .query("checkouts")
      .withIndex("by_site_checkout", (q) => q.eq("siteId", siteId))
      .take(DELETE_BATCH);
    for (const row of checkouts) await ctx.db.delete("checkouts", row._id);

    const secrets = await ctx.db
      .query("siteSecrets")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .take(DELETE_BATCH);
    for (const row of secrets) await ctx.db.delete("siteSecrets", row._id);

    const batches = [pageviews, dims, stats, sessions, visitors, events, payments, checkouts];
    if (batches.some((rows) => rows.length === DELETE_BATCH)) {
      await ctx.scheduler.runAfter(0, internal.sites.deleteSiteData, { siteId });
    }
    return null;
  },
});

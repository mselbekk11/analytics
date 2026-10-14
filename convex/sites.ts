import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { findOwnedSite, requireOwnerId } from "./lib/auth";
import { isValidTimeZone } from "./lib/dates";
import { normalizeDomain } from "./lib/domain";

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

/** The signed-in user's site with this domain, or null if it is missing or not theirs. */
export const get = query({
  args: { domain: v.string() },
  returns: v.union(v.null(), siteSummary),
  handler: async (ctx, args) => {
    const site = await findOwnedSite(ctx, args.domain);
    if (site === null) return null;
    return { domain: site.domain, timezone: site.timezone };
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
      .take(500);
    return sites
      .map((s) => ({ domain: s.domain, timezone: s.timezone }))
      .sort((a, b) => a.domain.localeCompare(b.domain));
  },
});

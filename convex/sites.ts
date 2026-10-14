import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireOwnerId } from "./lib/auth";
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

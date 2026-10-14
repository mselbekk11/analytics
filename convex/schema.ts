import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sites: defineTable({
    ownerId: v.string(), // identity.tokenIdentifier (Clerk issuer + user id)
    domain: v.string(), // "picai.so", no protocol or www
    timezone: v.string(), // "America/Los_Angeles", sets day boundaries
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_domain", ["domain"]),

  // Raw hits: feeds live pageviews and lets you rebuild rollups later
  pageviews: defineTable({
    siteId: v.id("sites"),
    ts: v.number(),
    path: v.string(),
    referrer: v.string(), // hostname or "(direct)"
    unique: v.boolean(),
    device: v.string(), // mobile | tablet | desktop
    browser: v.string(),
    country: v.string(), // ISO code or "Unknown"
    pvId: v.string(),
    durationMs: v.optional(v.number()),
  })
    .index("by_site_ts", ["siteId", "ts"])
    .index("by_pvId", ["pvId"]),

  // One row per site per day: chart, totals, sparklines, deltas
  dailyStats: defineTable({
    siteId: v.id("sites"),
    date: v.string(), // "2026-10-13" in the site's timezone
    pageviews: v.number(),
    visitors: v.number(),
    durationSumMs: v.number(),
    durationCount: v.number(),
  }).index("by_site_date", ["siteId", "date"]),

  // One row per site, day, dimension and value: the five lists
  dailyDims: defineTable({
    siteId: v.id("sites"),
    date: v.string(),
    dim: v.union(
      v.literal("page"),
      v.literal("referrer"),
      v.literal("device"),
      v.literal("browser"),
      v.literal("country"),
    ),
    key: v.string(),
    pageviews: v.number(),
    visitors: v.number(),
  })
    .index("by_site_dim_date", ["siteId", "dim", "date"])
    .index("by_site_date_dim_key", ["siteId", "date", "dim", "key"]),
});

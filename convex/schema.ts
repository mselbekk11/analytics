import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { dimValidator } from "./lib/dims";

export default defineSchema({
  sites: defineTable({
    ownerId: v.string(), // identity.tokenIdentifier (Clerk issuer + user id)
    domain: v.string(), // "picai.so", no protocol or www
    timezone: v.string(), // "America/Los_Angeles", sets day boundaries
    createdAt: v.number(),
    // First hit with a visitor id (Phase 5a); before its day, visitors are SA-style unique visits
    trackingStartedAt: v.optional(v.number()),
    // First pageview classified by source and channel (Phase 5b); the backfill covers hits before it
    sourcesStartedAt: v.optional(v.number()),
    sourcesBackfilled: v.optional(v.boolean()),
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
    durationMs: v.optional(v.number()), // engaged time, summed from pings
    visitorId: v.optional(v.string()), // _va_vid; missing before 5a and in cookieless mode
    sessionId: v.optional(v.string()), // _va_sid
  })
    .index("by_site_ts", ["siteId", "ts"])
    .index("by_pvId", ["pvId"])
    .index("by_site_session", ["siteId", "sessionId", "ts"]),

  // One row per site per day: chart, totals, sparklines, deltas
  dailyStats: defineTable({
    siteId: v.id("sites"),
    date: v.string(), // "2026-10-13" in the site's timezone
    pageviews: v.number(),
    visitors: v.number(),
    durationSumMs: v.number(),
    durationCount: v.number(),
    // From 5a: counted on the day each session started
    sessions: v.optional(v.number()),
    bounces: v.optional(v.number()), // sessions with one pageview and no goal
    sessionEngagedMs: v.optional(v.number()),
  }).index("by_site_date", ["siteId", "date"]),

  // One row per site, day, dimension and value: the lists (see lib/dims.ts)
  dailyDims: defineTable({
    siteId: v.id("sites"),
    date: v.string(),
    dim: dimValidator,
    key: v.string(),
    pageviews: v.number(),
    visitors: v.number(),
    sessions: v.optional(v.number()), // session dims only, from 5b
  })
    .index("by_site_dim_date", ["siteId", "dim", "date"])
    .index("by_site_date_dim_key", ["siteId", "date", "dim", "key"]),

  // One row per cookie visitor id (_va_vid) per site
  visitors: defineTable({
    siteId: v.id("sites"),
    visitorId: v.string(),
    firstSeen: v.number(),
    lastSeen: v.number(), // last pageview
    lastSeenDate: v.string(), // site-local day of the last pageview, for daily visitor counts
    sessions: v.number(),
    firstSource: v.optional(v.string()),
    firstChannel: v.optional(v.string()),
    userId: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    revenueMinor: v.number(),
    firstPaidAt: v.optional(v.number()),
  })
    .index("by_site_visitor", ["siteId", "visitorId"])
    .index("by_site_lastSeen", ["siteId", "lastSeen"])
    .index("by_site_email", ["siteId", "email"])
    .index("by_site_firstPaid", ["siteId", "firstPaidAt"]),

  // One row per session id (_va_sid): how the visit arrived and what it did
  sessions: defineTable({
    siteId: v.id("sites"),
    sessionId: v.string(),
    visitorId: v.string(),
    date: v.string(), // site-local day the session started
    startedAt: v.number(),
    lastSeenAt: v.number(),
    engagedMs: v.number(),
    pageviews: v.number(),
    goals: v.number(),
    entryPath: v.string(),
    exitPath: v.string(),
    referrer: v.string(), // hostname or "(direct)", from the first pageview
    // Filled by the source classifier from 5b; 5a sessions are backfilled from `referrer`
    source: v.optional(v.string()),
    channel: v.optional(v.string()),
    utmSource: v.optional(v.string()),
    utmMedium: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
    utmTerm: v.optional(v.string()),
    utmContent: v.optional(v.string()),
    refTag: v.optional(v.string()),
    country: v.string(),
    region: v.optional(v.string()),
    city: v.optional(v.string()),
    lat: v.optional(v.number()),
    lon: v.optional(v.number()),
    device: v.string(),
    browser: v.string(),
    os: v.optional(v.string()),
    revenueMinor: v.number(),
  })
    .index("by_site_session", ["siteId", "sessionId"])
    .index("by_site_started", ["siteId", "startedAt"])
    .index("by_site_visitor_started", ["siteId", "visitorId", "startedAt"])
    // "Online now": pings move lastSeenAt here, so visitor rows stay stable
    .index("by_site_lastSeenAt", ["siteId", "lastSeenAt"]),
});

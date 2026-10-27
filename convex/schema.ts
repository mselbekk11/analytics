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
    // The goal a site without revenue converts on, e.g. "signup" (5d)
    keyGoal: v.optional(v.string()),
    // Revenue (5e): where payments come from (missing means "none") and the one currency totals use
    revenueSource: v.optional(v.union(v.literal("none"), v.literal("stripe"), v.literal("api"))),
    currency: v.optional(v.string()), // ISO 4217, "USD" when missing
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
    // From 5e, on each payment's own day, in the site's currency only
    revenueMinor: v.optional(v.number()), // net of refunds
    payments: v.optional(v.number()), // count, refunds not included
    refundsMinor: v.optional(v.number()), // refunded amount, positive
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
    events: v.optional(v.number()), // goal completions and outbound clicks, from 5d
    revenueMinor: v.optional(v.number()), // net revenue credited to this key, from 5e
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

  // Goals, outbound clicks and identify calls, each tied to the pageview it came from
  events: defineTable({
    siteId: v.id("sites"),
    ts: v.number(),
    date: v.string(), // site-local day of the event
    type: v.union(
      v.literal("goal"),
      v.literal("outbound"),
      v.literal("identify"),
      v.literal("claim"), // a Stripe Checkout return page (5e)
    ),
    name: v.string(), // goal name, outbound origin + path, "identify", or the Checkout Session id
    path: v.string(), // the page it happened on
    pvId: v.string(),
    // From the pageview; both missing for cookieless pageviews
    sessionId: v.optional(v.string()),
    visitorId: v.optional(v.string()),
    props: v.optional(v.record(v.string(), v.string())), // goals only, up to 10 keys
  })
    .index("by_site_ts", ["siteId", "ts"])
    .index("by_site_visitor_ts", ["siteId", "visitorId", "ts"])
    .index("by_pvId_name", ["pvId", "name"])
    .index("by_site_type_name", ["siteId", "type", "name"]),

  // Payments and refunds from Stripe or the payments API (5e), each linked to a visitor
  // and credited to one of their sessions when a matching rule finds one
  payments: defineTable({
    siteId: v.id("sites"),
    provider: v.union(v.literal("stripe"), v.literal("api")),
    providerId: v.string(), // Checkout Session or invoice id, "<charge id>#<total refunded>", or the API's id
    ts: v.number(),
    date: v.string(), // site-local day of the payment
    kind: v.union(v.literal("payment"), v.literal("refund")),
    amountMinor: v.number(), // smallest currency unit; refunds are negative
    currency: v.string(), // upper case; other than the site's means left out of totals
    renewal: v.boolean(),
    customerId: v.optional(v.string()),
    email: v.optional(v.string()),
    visitorId: v.optional(v.string()),
    sessionId: v.optional(v.string()), // the credited session
    matchedBy: v.optional(
      v.union(
        v.literal("metadata"),
        v.literal("return_page"),
        v.literal("customer"),
        v.literal("email"),
      ),
    ),
    // Stripe ids used to link a payment later (return page, subscription) and refunds to payments
    checkoutSessionId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    paymentIntentId: v.optional(v.string()),
    invoiceId: v.optional(v.string()),
  })
    .index("by_site_ts", ["siteId", "ts"])
    .index("by_site_provider_id", ["siteId", "provider", "providerId"])
    .index("by_site_customer", ["siteId", "customerId"])
    .index("by_site_visitor", ["siteId", "visitorId"])
    .index("by_site_checkout", ["siteId", "checkoutSessionId"])
    .index("by_site_subscription", ["siteId", "subscriptionId"])
    .index("by_site_paymentIntent", ["siteId", "paymentIntentId"])
    .index("by_site_invoice", ["siteId", "invoiceId"]),

  // Completed Stripe Checkout Sessions. A subscription's invoices don't carry the
  // Checkout Session, so this links them to its metadata and return-page claim.
  checkouts: defineTable({
    siteId: v.id("sites"),
    checkoutSessionId: v.string(),
    ts: v.number(),
    customerId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    visitorId: v.optional(v.string()), // va_vid from metadata or client_reference_id
  })
    .index("by_site_checkout", ["siteId", "checkoutSessionId"])
    .index("by_site_subscription", ["siteId", "subscriptionId"]),

  // Never returned by a public query
  siteSecrets: defineTable({
    siteId: v.id("sites"),
    stripeWebhookSecret: v.optional(v.string()),
    apiKeyHash: v.optional(v.string()), // SHA-256 of the payments API key, hex
  })
    .index("by_site", ["siteId"])
    .index("by_apiKeyHash", ["apiKeyHash"]),
});

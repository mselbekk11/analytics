import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { sessionSource } from "./lib/attribution";
import { requireSite } from "./lib/auth";
import { siteCurrency } from "./lib/revenue";

// Customers and visitor profiles (5f). These read raw rows (visitors, sessions,
// pageviews, events, payments) through their indexes, always bounded.

// Newest customers listed; the page says when there are more
const MAX_CUSTOMERS = 500;
// Key-goal completions read to find the visitors who converted
const MAX_GOAL_EVENTS = 5_000;
// A profile shows the visitor's latest sessions, each with up to this many pageviews
const MAX_PROFILE_SESSIONS = 50;
const MAX_SESSION_PAGEVIEWS = 100;
const MAX_PROFILE_EVENTS = 2_000;
const MAX_PROFILE_PAYMENTS = 200;

const kindValidator = v.union(v.literal("revenue"), v.literal("goal"));
type Kind = "revenue" | "goal";

const customer = v.object({
  visitorId: v.string(),
  name: v.union(v.null(), v.string()),
  email: v.union(v.null(), v.string()),
  firstSeen: v.number(),
  firstSource: v.union(v.null(), v.string()),
  firstChannel: v.union(v.null(), v.string()),
  // The session the first payment was credited to, or the one the key goal was first completed in
  creditedSource: v.union(v.null(), v.string()),
  creditedChannel: v.union(v.null(), v.string()),
  country: v.union(v.null(), v.string()),
  revenueMinor: v.number(), // lifetime, in the site's currency
  convertedAt: v.number(), // first payment, or first completion of the key goal
});

/** Which conversion a site's customers are built on, if it has one. */
function availableKinds(site: Doc<"sites">): Kind[] {
  const kinds: Kind[] = [];
  if ((site.revenueSource ?? "none") !== "none") kinds.push("revenue");
  if (site.keyGoal !== undefined) kinds.push("goal");
  return kinds;
}

async function sessionById(ctx: QueryCtx, siteId: Id<"sites">, sessionId: string | undefined) {
  if (sessionId === undefined) return null;
  return await ctx.db
    .query("sessions")
    .withIndex("by_site_session", (q) => q.eq("siteId", siteId).eq("sessionId", sessionId))
    .unique();
}

async function visitorById(ctx: QueryCtx, siteId: Id<"sites">, visitorId: string) {
  return await ctx.db
    .query("visitors")
    .withIndex("by_site_visitor", (q) => q.eq("siteId", siteId).eq("visitorId", visitorId))
    .unique();
}

function customerRow(
  visitor: Doc<"visitors">,
  credited: Doc<"sessions"> | null,
  convertedAt: number,
) {
  const source = credited === null ? null : sessionSource(credited);
  return {
    visitorId: visitor.visitorId,
    name: visitor.name ?? null,
    email: visitor.email ?? null,
    firstSeen: visitor.firstSeen,
    firstSource: visitor.firstSource ?? null,
    firstChannel: visitor.firstChannel ?? null,
    creditedSource: source?.source ?? null,
    creditedChannel: source?.channel ?? null,
    country: credited?.country ?? null,
    revenueMinor: visitor.revenueMinor,
    convertedAt,
  };
}

/**
 * The site's customers, newest conversion first: every visitor who paid (in the site's
 * currency) on a site with revenue, or who completed the key goal. `kind` picks one when
 * a site has both; by default revenue wins. `kinds` lists what the site has, empty when
 * it has neither. `more` is true when the list was cut at MAX_CUSTOMERS (or, for goals,
 * when there were too many completions to read them all).
 */
export const customers = query({
  args: { domain: v.string(), kind: v.optional(kindValidator) },
  returns: v.object({
    kinds: v.array(kindValidator),
    kind: v.union(v.null(), kindValidator),
    keyGoal: v.union(v.null(), v.string()),
    currency: v.string(),
    rows: v.array(customer),
    more: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    const kinds = availableKinds(site);
    const kind = args.kind !== undefined && kinds.includes(args.kind) ? args.kind : (kinds[0] ?? null);
    const base = { kinds, kind, keyGoal: site.keyGoal ?? null, currency: siteCurrency(site) };
    if (kind === null) return { ...base, rows: [], more: false };

    if (kind === "revenue") {
      const paying = await ctx.db
        .query("visitors")
        .withIndex("by_site_firstPaid", (q) => q.eq("siteId", site._id).gte("firstPaidAt", 0))
        .order("desc")
        .take(MAX_CUSTOMERS + 1);
      const currency = siteCurrency(site);
      const rows = [];
      for (const visitor of paying.slice(0, MAX_CUSTOMERS)) {
        const firstPaidAt = visitor.firstPaidAt!;
        const payments = await ctx.db
          .query("payments")
          .withIndex("by_site_visitor", (q) => q.eq("siteId", site._id).eq("visitorId", visitor.visitorId))
          .take(MAX_PROFILE_PAYMENTS);
        const first = payments
          .filter((p) => p.kind === "payment" && p.currency === currency)
          .sort((a, b) => a.ts - b.ts)[0];
        const credited = await sessionById(ctx, site._id, first?.sessionId);
        rows.push(customerRow(visitor, credited, firstPaidAt));
      }
      return { ...base, rows, more: paying.length > MAX_CUSTOMERS };
    }

    // Each visitor's first completion of the key goal among the newest completions
    const keyGoal = site.keyGoal!;
    const events = await ctx.db
      .query("events")
      .withIndex("by_site_type_name", (q) => q.eq("siteId", site._id).eq("type", "goal").eq("name", keyGoal))
      .order("desc")
      .take(MAX_GOAL_EVENTS + 1);
    const firsts = new Map<string, Doc<"events">>();
    for (const e of events.slice(0, MAX_GOAL_EVENTS)) {
      if (e.visitorId === undefined) continue;
      const seen = firsts.get(e.visitorId);
      if (seen === undefined || e.ts < seen.ts) firsts.set(e.visitorId, e);
    }
    const newest = [...firsts.values()].sort((a, b) => b.ts - a.ts);
    const rows = [];
    for (const e of newest.slice(0, MAX_CUSTOMERS)) {
      const visitor = await visitorById(ctx, site._id, e.visitorId!);
      if (visitor === null) continue;
      rows.push(customerRow(visitor, await sessionById(ctx, site._id, e.sessionId), e.ts));
    }
    return {
      ...base,
      rows,
      more: newest.length > MAX_CUSTOMERS || events.length > MAX_GOAL_EVENTS,
    };
  },
});

const timelineItem = v.union(
  v.object({
    type: v.literal("pageview"),
    ts: v.number(),
    path: v.string(),
    durationMs: v.union(v.null(), v.number()),
  }),
  v.object({
    type: v.union(v.literal("goal"), v.literal("outbound"), v.literal("identify"), v.literal("claim")),
    ts: v.number(),
    name: v.string(),
    path: v.string(),
  }),
  v.object({
    type: v.union(v.literal("payment"), v.literal("refund")),
    ts: v.number(),
    amountMinor: v.number(),
    currency: v.string(),
    renewal: v.boolean(),
    matchedBy: v.union(v.null(), v.string()),
    // The session this payment's revenue was credited to (it may be older than the listed ones)
    creditedSessionId: v.union(v.null(), v.string()),
  }),
);

const sessionValidator = v.object({
  sessionId: v.string(),
  startedAt: v.number(),
  lastSeenAt: v.number(),
  engagedMs: v.number(),
  pageviews: v.number(),
  source: v.string(),
  channel: v.string(),
  referrer: v.string(),
  utmSource: v.union(v.null(), v.string()),
  utmMedium: v.union(v.null(), v.string()),
  utmCampaign: v.union(v.null(), v.string()),
  refTag: v.union(v.null(), v.string()),
  country: v.string(),
  region: v.union(v.null(), v.string()),
  city: v.union(v.null(), v.string()),
  device: v.string(),
  browser: v.string(),
  os: v.union(v.null(), v.string()),
  revenueMinor: v.number(),
  credited: v.boolean(), // a payment's revenue was credited to this session
  items: v.array(timelineItem),
});

type TimelineItem = typeof timelineItem.type;

/**
 * One visitor's profile: who they are (identify() or a payment), where and on what
 * they visit from, and a timeline of their latest sessions, oldest first, each with its
 * pages, goals, outbound clicks and payments. Null for an unknown visitor id.
 * `moreSessions` is true when older sessions were left out.
 */
export const profile = query({
  args: { domain: v.string(), visitorId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      visitorId: v.string(),
      name: v.union(v.null(), v.string()),
      email: v.union(v.null(), v.string()),
      userId: v.union(v.null(), v.string()),
      firstSeen: v.number(),
      lastSeen: v.number(),
      sessionCount: v.number(),
      firstSource: v.union(v.null(), v.string()),
      firstChannel: v.union(v.null(), v.string()),
      revenueMinor: v.number(),
      firstPaidAt: v.union(v.null(), v.number()),
      currency: v.string(),
      sessions: v.array(sessionValidator),
      moreSessions: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const site = await requireSite(ctx, args.domain);
    if (args.visitorId.length > 100) throw new ConvexError("Invalid visitor id");
    const visitor = await visitorById(ctx, site._id, args.visitorId);
    if (visitor === null) return null;
    const visitorId = visitor.visitorId;

    const latest = await ctx.db
      .query("sessions")
      .withIndex("by_site_visitor_started", (q) => q.eq("siteId", site._id).eq("visitorId", visitorId))
      .order("desc")
      .take(MAX_PROFILE_SESSIONS + 1);
    const sessions = latest.slice(0, MAX_PROFILE_SESSIONS).reverse();
    const moreSessions = latest.length > MAX_PROFILE_SESSIONS;

    const items = new Map<string, TimelineItem[]>(sessions.map((s) => [s.sessionId, []]));
    for (const s of sessions) {
      const pageviews = await ctx.db
        .query("pageviews")
        .withIndex("by_site_session", (q) => q.eq("siteId", site._id).eq("sessionId", s.sessionId))
        .take(MAX_SESSION_PAGEVIEWS);
      for (const pv of pageviews) {
        items.get(s.sessionId)!.push({
          type: "pageview",
          ts: pv.ts,
          path: pv.path,
          durationMs: pv.durationMs ?? null,
        });
      }
    }

    const events = await ctx.db
      .query("events")
      .withIndex("by_site_visitor_ts", (q) => q.eq("siteId", site._id).eq("visitorId", visitorId))
      .order("desc")
      .take(MAX_PROFILE_EVENTS);
    for (const e of events) {
      const list = e.sessionId === undefined ? undefined : items.get(e.sessionId);
      list?.push({ type: e.type, ts: e.ts, name: e.name, path: e.path });
    }

    // A payment shows in the session that was open when it was made (the last one that
    // started before it), and marks the session its revenue was credited to
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_site_visitor", (q) => q.eq("siteId", site._id).eq("visitorId", visitorId))
      .take(MAX_PROFILE_PAYMENTS);
    const credited = new Set<string>();
    for (const p of payments) {
      if (p.sessionId !== undefined) credited.add(p.sessionId);
      const open = sessions.findLast((s) => s.startedAt <= p.ts) ?? (moreSessions ? undefined : sessions[0]);
      items.get(open?.sessionId ?? "")?.push({
        type: p.kind,
        ts: p.ts,
        amountMinor: p.amountMinor,
        currency: p.currency,
        renewal: p.renewal,
        matchedBy: p.matchedBy ?? null,
        creditedSessionId: p.sessionId ?? null,
      });
    }

    return {
      visitorId,
      name: visitor.name ?? null,
      email: visitor.email ?? null,
      userId: visitor.userId ?? null,
      firstSeen: visitor.firstSeen,
      lastSeen: visitor.lastSeen,
      sessionCount: visitor.sessions,
      firstSource: visitor.firstSource ?? null,
      firstChannel: visitor.firstChannel ?? null,
      revenueMinor: visitor.revenueMinor,
      firstPaidAt: visitor.firstPaidAt ?? null,
      currency: siteCurrency(site),
      moreSessions,
      sessions: sessions.map((s) => ({
        sessionId: s.sessionId,
        startedAt: s.startedAt,
        lastSeenAt: s.lastSeenAt,
        engagedMs: s.engagedMs,
        pageviews: s.pageviews,
        ...sessionSource(s),
        referrer: s.referrer,
        utmSource: s.utmSource ?? null,
        utmMedium: s.utmMedium ?? null,
        utmCampaign: s.utmCampaign ?? null,
        refTag: s.refTag ?? null,
        country: s.country,
        region: s.region ?? null,
        city: s.city ?? null,
        device: s.device,
        browser: s.browser,
        os: s.os ?? null,
        revenueMinor: s.revenueMinor,
        credited: credited.has(s.sessionId),
        items: items.get(s.sessionId)!.sort((a, b) => a.ts - b.ts),
      })),
    };
  },
});

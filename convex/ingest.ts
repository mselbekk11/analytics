import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import {
  attribute,
  campaignValidator,
  countCookielessVisit,
  countSession,
  type Campaign,
} from "./lib/attribution";
import { localDate } from "./lib/dates";
import { hostMatchesDomain, normalizeDomain } from "./lib/domain";
import { cityKey, regionKey } from "./lib/geo";
import { groupPath, isExcludedPath } from "./lib/paths";
import { claimCheckout } from "./lib/revenue";
import {
  bumpDailyDim,
  bumpDailyStats,
  bumpEventDim,
  bumpPageDim,
  bumpSessionDim,
  type PageDelta,
} from "./lib/rollups";
import { checkSecret } from "./lib/secret";

// These are public because /api/collect calls them over HTTP, so every call must
// carry INGEST_SECRET. Hits for unknown sites or foreign hostnames are dropped
// silently: the route answers 204 (or, for a pageview, the site's identity mode), so
// there is no one to report to.

const MAX_DURATION_MS = 30 * 60 * 1000;
const MAX_PING_MS = 70 * 1000;
const LEGACY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
// Goals, outbound clicks and identify calls kept per pageview; the rest are dropped
const MAX_EVENTS_PER_PAGEVIEW = 50;
const HOUR_MS = 60 * 60 * 1000;
const EVENT_RETRY_MS = 5_000;
const MAX_TITLE_LENGTH = 200;

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
    // From 5c. Region is the ISO 3166-2 subdivision code ("CA"); lat/lon are rounded by the route
    os: v.optional(v.string()),
    region: v.optional(v.string()),
    city: v.optional(v.string()),
    lat: v.optional(v.number()),
    lon: v.optional(v.number()),
    pvId: v.string(),
    // From the _va_vid and _va_sid cookies; both missing for cookieless and old scripts
    visitorId: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    cookieless: v.optional(v.boolean()), // the snippet has data-cookieless
    // Tags from the landing page's URL; sent with the first pageview of a page load only
    campaign: v.optional(campaignValidator),
    title: v.optional(v.string()), // document.title (design v4)
  },
  // The site's Visitor identity setting, for the route to pass back to the script (null
  // for an unknown site or foreign hostname). Every hit of a known site gets it, stored or not
  returns: v.union(v.null(), v.object({ cookieless: v.boolean() })),
  handler: async (ctx, args) => {
    checkSecret(args.secret);
    const site = await findSite(ctx, args.site, args.hostname);
    if (site === null) return null;
    const mode = { cookieless: site.cookieless === true };
    // Excluded paths store nothing, so their pings and events find no pageview either
    if (isExcludedPath(args.path, site.excludedPaths)) return mode;
    // From here on the path is the grouped one: stored, rolled up, titled and used for
    // the session's entry and exit
    const path = groupPath(args.path, site.pathGrouping);

    // A retried beacon must not count twice
    const seen = await ctx.db
      .query("pageviews")
      .withIndex("by_pvId", (q) => q.eq("pvId", args.pvId))
      .first();
    if (seen !== null) return mode;

    const ts = Date.now();
    const date = localDate(ts, site.timezone);
    // A cookieless site stores no ids, even from a snippet (or a cached script) that
    // still sends them. Its pings and events take their ids from this pageview, so they
    // are stripped too
    const visitorId = mode.cookieless ? undefined : args.visitorId;
    const sessionId = mode.cookieless ? undefined : args.sessionId;
    const ids =
      visitorId !== undefined && sessionId !== undefined ? { visitorId, sessionId } : null;
    const cookieless = args.cookieless || mode.cookieless;
    if (ids === null && !cookieless && legacyWindowOver(site, ts)) return mode;
    if (site.sourcesStartedAt === undefined || site.pageStatsStartedAt === undefined) {
      await ctx.db.patch("sites", site._id, {
        sourcesStartedAt: site.sourcesStartedAt ?? ts,
        pageStatsStartedAt: site.pageStatsStartedAt ?? ts,
      });
    }
    const campaign = cleanCampaign(args.campaign);

    await ctx.db.insert("pageviews", {
      siteId: site._id,
      ts,
      path,
      referrer: args.referrer,
      unique: args.unique,
      device: args.device,
      browser: args.browser,
      country: args.country,
      pvId: args.pvId,
      ...ids,
    });

    // With ids, a visitor counts once per local day; without, SA's unique-visit rule applies
    let countsVisitor = args.unique;
    let newSession = false;
    let page: PageDelta = {};
    if (ids !== null) {
      const visit = await trackVisit(ctx, site, { ...args, ...ids, path, ts, date, campaign });
      countsVisitor = visit.firstToday;
      newSession = visit.newSession;
      page = visit.page;
    } else if (args.unique) {
      await countCookielessVisit(ctx, site._id, date, attribute(args.referrer, campaign));
    }

    await bumpDailyStats(ctx, site._id, date, {
      pageviews: 1,
      visitors: countsVisitor ? 1 : 0,
      ...(newSession ? { sessions: 1, bounces: 1 } : {}),
    });
    await bumpDailyDim(ctx, site._id, date, "page", path, countsVisitor, page);
    await savePageTitle(ctx, site._id, path, args.title, ts);
    await bumpDailyDim(ctx, site._id, date, "referrer", args.referrer, countsVisitor);
    await bumpDailyDim(ctx, site._id, date, "device", args.device, countsVisitor);
    await bumpDailyDim(ctx, site._id, date, "browser", args.browser, countsVisitor);
    await bumpDailyDim(ctx, site._id, date, "country", args.country, countsVisitor);
    await bumpDailyDim(ctx, site._id, date, "os", args.os ?? "Unknown", countsVisitor);
    await bumpDailyDim(ctx, site._id, date, "region", regionKey(args.country, args.region), countsVisitor);
    await bumpDailyDim(ctx, site._id, date, "city", cityKey(args.country, args.region, args.city), countsVisitor);
    return mode;
  },
});

/**
 * Keeps the latest non-empty title for the path. Most pageviews repeat the stored title,
 * so the row is only written when it changes.
 */
async function savePageTitle(
  ctx: MutationCtx,
  siteId: Id<"sites">,
  path: string,
  raw: string | undefined,
  ts: number,
): Promise<void> {
  const title = raw?.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH).trim();
  if (!title) return;
  const row = await ctx.db
    .query("pageTitles")
    .withIndex("by_site_path", (q) => q.eq("siteId", siteId).eq("path", path))
    .unique();
  if (row === null) {
    await ctx.db.insert("pageTitles", { siteId, path, title, updatedAt: ts });
  } else if (row.title !== title) {
    await ctx.db.patch("pageTitles", row._id, { title, updatedAt: ts });
  }
}

/** Trims each tag to 100 characters and drops empty ones. */
function cleanCampaign(campaign: Campaign | undefined): Campaign | undefined {
  if (campaign === undefined) return undefined;
  const clean: Campaign = {};
  for (const [field, value] of Object.entries(campaign) as [keyof Campaign, string | undefined][]) {
    const trimmed = value?.trim().slice(0, 100);
    if (trimmed) clean[field] = trimmed;
  }
  return clean;
}

/**
 * Whether ingest counts time and goals at `ts` on the page rows. Before the site's first
 * pageview with page stats, the backfill (migrations.backfillPageStats) counts them.
 */
function pageStatsOn(site: Doc<"sites">, ts: number): boolean {
  return site.pageStatsStartedAt !== undefined && ts >= site.pageStatsStartedAt;
}

/** Hits without ids after this come from a script cached for over a week; drop them. */
function legacyWindowOver(site: Doc<"sites">, ts: number): boolean {
  return site.trackingStartedAt !== undefined && ts > site.trackingStartedAt + LEGACY_WINDOW_MS;
}

type Visit = {
  pvId: string;
  visitorId: string;
  sessionId: string;
  ts: number;
  date: string;
  path: string;
  referrer: string;
  country: string;
  region?: string;
  city?: string;
  lat?: number;
  lon?: number;
  device: string;
  browser: string;
  os?: string;
  campaign: Campaign | undefined;
};

/**
 * Starts or extends the session and upserts the visitor. The caller adds the session
 * and its bounce to the day; a second pageview takes the bounce back off the day the
 * session started. A new session is classified by source and counted on its source,
 * entry and exit dims; each later pageview moves its exit page. `page` is what the
 * pageview adds to its page row: a session the first time the session views the page,
 * and an entry and a bounce when it starts one.
 */
async function trackVisit(
  ctx: MutationCtx,
  site: Doc<"sites">,
  hit: Visit,
): Promise<{ firstToday: boolean; newSession: boolean; page: PageDelta }> {
  if (site.trackingStartedAt === undefined) {
    await ctx.db.patch("sites", site._id, { trackingStartedAt: hit.ts });
  }

  const session = await ctx.db
    .query("sessions")
    .withIndex("by_site_session", (q) =>
      q.eq("siteId", site._id).eq("sessionId", hit.sessionId),
    )
    .unique();
  const attribution = attribute(hit.referrer, hit.campaign);
  let page: PageDelta = {};
  if (session === null) {
    const id = await ctx.db.insert("sessions", {
      siteId: site._id,
      sessionId: hit.sessionId,
      visitorId: hit.visitorId,
      date: hit.date,
      startedAt: hit.ts,
      lastSeenAt: hit.ts,
      engagedMs: 0,
      pageviews: 1,
      goals: 0,
      entryPath: hit.path,
      exitPath: hit.path,
      referrer: hit.referrer,
      ...attribution,
      country: hit.country,
      region: hit.region,
      city: hit.city,
      lat: hit.lat,
      lon: hit.lon,
      device: hit.device,
      browser: hit.browser,
      os: hit.os,
      revenueMinor: 0,
    });
    await countSession(ctx, (await ctx.db.get("sessions", id))!);
    page = { sessions: 1, entries: 1, bounces: 1 };
  } else {
    await ctx.db.patch("sessions", session._id, {
      pageviews: session.pageviews + 1,
      lastSeenAt: hit.ts,
      exitPath: hit.path,
    });
    if (session.pageviews === 1 && session.goals === 0) {
      await bumpDailyStats(ctx, site._id, session.date, { bounces: -1 });
      await bumpPageDim(ctx, site._id, session.date, session.entryPath, { bounces: -1 });
    }
    if (!(await sessionViewed(ctx, site, hit))) page = { sessions: 1 };
    // Sessions from before 5b get their exit dim from the backfill instead
    if (session.source !== undefined && session.exitPath !== hit.path) {
      await bumpSessionDim(ctx, site._id, session.date, "exit", session.exitPath, { sessions: -1 });
      await bumpSessionDim(ctx, site._id, session.date, "exit", hit.path, { sessions: 1 });
    }
  }
  const newSession = session === null;

  const visitor = await ctx.db
    .query("visitors")
    .withIndex("by_site_visitor", (q) =>
      q.eq("siteId", site._id).eq("visitorId", hit.visitorId),
    )
    .unique();
  // The Users table's latest details are the latest session's: where and on what it
  // started, its entry page and (moved by every pageview) its exit page
  const latest = {
    country: hit.country,
    region: hit.region,
    city: hit.city,
    device: hit.device,
    browser: hit.browser,
    entryPath: hit.path,
  };
  if (visitor === null) {
    await ctx.db.insert("visitors", {
      siteId: site._id,
      visitorId: hit.visitorId,
      firstSeen: hit.ts,
      lastSeen: hit.ts,
      lastSeenDate: hit.date,
      sessions: 1,
      firstSource: attribution.source,
      firstChannel: attribution.channel,
      revenueMinor: 0,
      pageviews: 1,
      engagedMs: 0,
      ...latest,
      exitPath: hit.path,
    });
    return { firstToday: true, newSession, page };
  }
  // Visitors from before the totals start from 0 here; the backfill recounts them
  await ctx.db.patch("visitors", visitor._id, {
    lastSeen: hit.ts,
    lastSeenDate: hit.date,
    sessions: visitor.sessions + (newSession ? 1 : 0),
    pageviews: (visitor.pageviews ?? 0) + 1,
    ...(newSession ? latest : {}),
    exitPath: hit.path,
  });
  return { firstToday: visitor.lastSeenDate !== hit.date, newSession, page };
}

/** Whether another pageview of the hit's session was on the same path. */
async function sessionViewed(ctx: MutationCtx, site: Doc<"sites">, hit: Visit): Promise<boolean> {
  const pageviews = ctx.db
    .query("pageviews")
    .withIndex("by_site_session", (q) => q.eq("siteId", site._id).eq("sessionId", hit.sessionId));
  for await (const p of pageviews) {
    if (p.path === hit.path && p.pvId !== hit.pvId) return true;
  }
  return false;
}

/**
 * Engaged (visible-tab) time since the script's last ping for this pageview. Adds it
 * to the pageview and its day, and to the session and the day the session started.
 * Each ping counts at most 70 s and each pageview at most 30 minutes in total.
 */
export const ping = mutation({
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
    if (!Number.isInteger(args.ms) || args.ms <= 0) return null;
    const site = await findSite(ctx, args.site, args.hostname);
    if (site === null) return null;

    const pv = await ctx.db
      .query("pageviews")
      .withIndex("by_pvId", (q) => q.eq("pvId", args.pvId))
      .first();
    if (pv === null || pv.siteId !== site._id) return null;

    const used = pv.durationMs ?? 0;
    const ms = Math.min(args.ms, MAX_PING_MS, MAX_DURATION_MS - used);
    if (ms <= 0) return null;

    await ctx.db.patch("pageviews", pv._id, { durationMs: used + ms });
    const pvDate = localDate(pv.ts, site.timezone);
    // Time on page averages over pageviews that sent any time, so count each one once
    const pvDelta = { durationSumMs: ms, durationCount: pv.durationMs === undefined ? 1 : 0 };
    if (pageStatsOn(site, pv.ts)) {
      await bumpPageDim(ctx, site._id, pvDate, pv.path, { engagedMs: ms, durationCount: pvDelta.durationCount });
    }

    const sessionId = pv.sessionId;
    const session =
      sessionId === undefined
        ? null
        : await ctx.db
            .query("sessions")
            .withIndex("by_site_session", (q) =>
              q.eq("siteId", site._id).eq("sessionId", sessionId),
            )
            .unique();
    if (session === null) {
      await bumpDailyStats(ctx, site._id, pvDate, pvDelta);
      return null;
    }

    await ctx.db.patch("sessions", session._id, {
      engagedMs: session.engagedMs + ms,
      lastSeenAt: Date.now(),
    });
    // The visitor's time on site. Online now stays on sessions; this only feeds the Users table.
    const visitor = await ctx.db
      .query("visitors")
      .withIndex("by_site_visitor", (q) => q.eq("siteId", site._id).eq("visitorId", session.visitorId))
      .unique();
    if (visitor !== null) {
      await ctx.db.patch("visitors", visitor._id, { engagedMs: (visitor.engagedMs ?? 0) + ms });
    }
    if (session.date === pvDate) {
      await bumpDailyStats(ctx, site._id, pvDate, { ...pvDelta, sessionEngagedMs: ms });
    } else {
      await bumpDailyStats(ctx, site._id, pvDate, pvDelta);
      await bumpDailyStats(ctx, site._id, session.date, { sessionEngagedMs: ms });
    }
    return null;
  },
});

const eventValidator = v.union(
  v.object({
    type: v.literal("goal"),
    name: v.string(),
    props: v.optional(v.record(v.string(), v.string())),
  }),
  v.object({ type: v.literal("outbound"), url: v.string() }), // origin + path
  v.object({
    type: v.literal("identify"),
    userId: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
  }),
  // A Stripe Checkout success page (?session_id=cs_...), 5e
  v.object({ type: v.literal("claim"), checkoutSessionId: v.string() }),
);

const eventArgs = {
  site: v.string(),
  hostname: v.string(),
  pvId: v.string(),
  event: eventValidator,
};
type EventArgs = Infer<ReturnType<typeof v.object<typeof eventArgs>>>;

/**
 * A goal, outbound click or identify call from the page with this `pvId`. The visitor,
 * session and path come from that pageview, so an event for an unknown pageview or
 * another site's is dropped. A repeat of the same goal (or link) on one pageview is
 * dropped too. A goal takes the bounce off its session; identify writes the user id,
 * email and name onto the visitor (cookieless pageviews have none, so it is dropped).
 * A claim links the Checkout Session's payments to the visitor (see lib/revenue.ts).
 */
export const event = mutation({
  args: {
    secret: v.string(),
    ...eventArgs,
  },
  returns: v.null(),
  handler: async (ctx, { secret, ...args }) => {
    checkSecret(secret);
    await recordEvent(ctx, { ...args, ts: Date.now() }, false);
    return null;
  },
});

/** The same event a few seconds later, when its pageview had not been written yet. */
export const retryEvent = internalMutation({
  args: { ...eventArgs, ts: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await recordEvent(ctx, args, true);
    return null;
  },
});

async function recordEvent(
  ctx: MutationCtx,
  args: EventArgs & { ts: number },
  retried: boolean,
): Promise<void> {
  const site = await findSite(ctx, args.site, args.hostname);
  if (site === null) return;

  const pv = await ctx.db
    .query("pageviews")
    .withIndex("by_pvId", (q) => q.eq("pvId", args.pvId))
    .first();
  // Beacons sent together can arrive out of order: a goal right after page load (a
  // queued call, say) may come before its pageview, so give it one more try
  if (pv === null && !retried) {
    await ctx.scheduler.runAfter(EVENT_RETRY_MS, internal.ingest.retryEvent, args);
    return;
  }
  if (pv === null || pv.siteId !== site._id) return;
  const e = args.event;
  // A goal or link on a pageview stored before its path was excluded is dropped too
  if ((e.type === "goal" || e.type === "outbound") && isExcludedPath(pv.path, site.excludedPaths)) return;
  const type = e.type;
  const name = (
    e.type === "goal" ? e.name : e.type === "outbound" ? e.url : e.type === "claim" ? e.checkoutSessionId : "identify"
  ).trim();
  if (!name) return;

  const { visitorId, sessionId } = pv;
  if (type === "identify" || type === "claim") {
    if (visitorId === undefined) return;
    if (e.type === "identify") await identify(ctx, site, visitorId, e);
  }

  const earlier = await ctx.db
    .query("events")
    .withIndex("by_pvId_name", (q) => q.eq("pvId", args.pvId))
    .take(MAX_EVENTS_PER_PAGEVIEW);
  if (earlier.length >= MAX_EVENTS_PER_PAGEVIEW) return;
  if (earlier.some((r) => r.type === type && r.name === name)) return;

  const { ts } = args;
  const date = localDate(ts, site.timezone);
  // A visitor counts once per goal (or link) and day; without ids each completion counts
  const firstToday =
    type === "identify" ||
    type === "claim" ||
    visitorId === undefined ||
    !(
      await ctx.db
        .query("events")
        .withIndex("by_site_visitor_ts", (q) =>
          q
            .eq("siteId", site._id)
            .eq("visitorId", visitorId)
            .gte("ts", ts - 48 * HOUR_MS),
        )
        .take(500)
    ).some((r) => r.date === date && r.type === type && r.name === name);

  await ctx.db.insert("events", {
    siteId: site._id,
    ts,
    date,
    type,
    name,
    path: pv.path,
    pvId: args.pvId,
    sessionId,
    visitorId,
    ...(e.type === "goal" && e.props && Object.keys(e.props).length > 0 ? { props: e.props } : {}),
  });
  if (type === "identify") return;
  if (type === "claim") {
    await claimCheckout(ctx, site, name, visitorId!);
    return;
  }

  await bumpEventDim(ctx, site._id, date, type, name, firstToday);
  const session =
    sessionId === undefined
      ? null
      : await ctx.db
          .query("sessions")
          .withIndex("by_site_session", (q) =>
            q.eq("siteId", site._id).eq("sessionId", sessionId),
          )
          .unique();
  if (session === null) return;
  if (type === "goal") {
    await ctx.db.patch("sessions", session._id, { goals: session.goals + 1, lastSeenAt: ts });
    // A goal means the session did not bounce, as a second pageview does
    if (session.pageviews === 1 && session.goals === 0) {
      await bumpDailyStats(ctx, site._id, session.date, { bounces: -1 });
      if (pageStatsOn(site, ts)) {
        await bumpPageDim(ctx, site._id, session.date, session.entryPath, { bounces: -1 });
      }
    }
  } else {
    await ctx.db.patch("sessions", session._id, { lastSeenAt: ts });
  }
}

/** Writes the fields identify() sent onto the visitor; the email is lower-cased for matching. */
async function identify(
  ctx: MutationCtx,
  site: Doc<"sites">,
  visitorId: string,
  user: { userId?: string; email?: string; name?: string },
): Promise<void> {
  const visitor = await ctx.db
    .query("visitors")
    .withIndex("by_site_visitor", (q) => q.eq("siteId", site._id).eq("visitorId", visitorId))
    .unique();
  if (visitor === null) return;
  const userId = user.userId?.trim().slice(0, 100);
  const email = user.email?.trim().toLowerCase().slice(0, 254);
  const name = user.name?.trim().slice(0, 100);
  await ctx.db.patch("visitors", visitor._id, {
    ...(userId ? { userId } : {}),
    ...(email && email.includes("@") ? { email } : {}),
    ...(name ? { name } : {}),
  });
}

/** Old scripts (cached before 5a) send one duration beacon per pageview instead of pings. */
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
    const date = localDate(pv.ts, site.timezone);
    await bumpDailyStats(ctx, site._id, date, { durationSumMs: args.ms, durationCount: 1 });
    if (pageStatsOn(site, pv.ts)) {
      await bumpPageDim(ctx, site._id, date, pv.path, { engagedMs: args.ms, durationCount: 1 });
    }
    return null;
  },
});

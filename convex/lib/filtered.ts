import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { sessionSource, sourceDims } from "./attribution";
import { dimValidator, rankEntries, type Dim, type DimEntry } from "./dims";
import type { Filter } from "./filters";
import { localDate } from "./dates";
import { cityKey, regionKey } from "./geo";
import { eachDate, previousRange, type DateRange } from "./ranges";
import { siteCurrency } from "./revenue";
import type {
  BreakdownResult,
  ConversionsResult,
  GoalsResult,
  Series,
  Summary,
  Totals,
} from "./statsShapes";

// The dashboard with filters (5g). A filter picks sessions: their source, landing page,
// location or device, a page they viewed, or a goal or outbound click in them. Every
// number is then worked out from those sessions, on the day each started, plus the
// payments credited to them, on each payment's own day (as the rollups do). Rows are
// read from the raw tables through their time indexes and joined in memory.

// Documents read per query, across all tables. Busiest site: ~4,400 pageviews and
// ~3,000 sessions over the 180 days a 90-day view and its previous period cover.
const MAX_READS = 12_000;
const MAX_BREAKDOWN_KEYS = 500;
const HOUR_MS = 60 * 60 * 1000;
// Pageviews and events of the last sessions can land after the last day ends
const TAIL_MS = 24 * HOUR_MS;

class TooManyRows extends Error {}

/** Counts documents read and stops the query before Convex's read limits would. */
class Budget {
  left = MAX_READS;
  async take<T>(query: { take(n: number): Promise<T[]> }): Promise<T[]> {
    const rows = await query.take(this.left + 1);
    if (rows.length > this.left) throw new TooManyRows();
    this.left -= rows.length;
    return rows;
  }
}

// Keys a session counts under on the lists that describe the session itself
const SESSION_DIMS = new Set<Dim>([
  "source", "channel", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref",
  "referrer", "entry", "exit", "device", "browser", "country", "os", "region", "city",
]);
const ALL_DIMS: Dim[] = dimValidator.members.map((m) => m.value);

/** The key a session has on each session-level list (the same keys the rollups use). */
function sessionKeys(s: Doc<"sessions">): Map<Dim, string> {
  const keys = new Map<Dim, string>(sourceDims({ ...s, ...sessionSource(s) }));
  keys.set("referrer", s.referrer);
  keys.set("entry", s.entryPath);
  keys.set("exit", s.exitPath);
  keys.set("device", s.device);
  keys.set("browser", s.browser);
  keys.set("country", s.country);
  keys.set("os", s.os ?? "Unknown");
  keys.set("region", regionKey(s.country, s.region));
  keys.set("city", cityKey(s.country, s.region, s.city));
  return keys;
}

type SessionInfo = {
  session: Doc<"sessions">;
  keys: Map<Dim, string>;
  pageviews: Doc<"pageviews">[];
  events: Doc<"events">[]; // goals and outbound clicks
};

function matches(info: SessionInfo, filters: Filter[]): boolean {
  return filters.every((f) => {
    if (SESSION_DIMS.has(f.dim)) return info.keys.get(f.dim) === f.value;
    if (f.dim === "page") return info.pageviews.some((p) => p.path === f.value);
    const type = f.dim === "goal" ? "goal" : "outbound";
    return info.events.some((e) => e.type === type && e.name === f.value);
  });
}

export type FilteredView =
  | {
      status: "ok";
      summary: Summary;
      timeseries: Series;
      breakdowns: Record<string, BreakdownResult>;
      goals: GoalsResult;
      conversions: ConversionsResult;
    }
  | { status: "tooMany" };

export async function filteredView(
  ctx: QueryCtx,
  site: Doc<"sites">,
  range: DateRange,
  filters: Filter[],
): Promise<FilteredView> {
  try {
    return { status: "ok", ...(await compute(ctx, site, range, filters)) };
  } catch (e) {
    if (e instanceof TooManyRows) return { status: "tooMany" };
    throw e;
  }
}

async function compute(ctx: QueryCtx, site: Doc<"sites">, range: DateRange, filters: Filter[]) {
  const budget = new Budget();
  const siteId = site._id;
  const prev = previousRange(range);
  const window: DateRange = { from: prev.from, to: range.to };
  // Local days run from UTC-12 to UTC+14; the stored `date` decides
  const start = Date.parse(`${window.from}T00:00:00Z`) - 14 * HOUR_MS;
  const end = Date.parse(`${window.to}T00:00:00Z`) + 36 * HOUR_MS;
  const inRange = (date: string, r: DateRange) => date >= r.from && date <= r.to;

  const infos = new Map<string, SessionInfo>();
  const sessionRows = await budget.take(
    ctx.db
      .query("sessions")
      .withIndex("by_site_started", (q) => q.eq("siteId", siteId).gte("startedAt", start).lt("startedAt", end)),
  );
  for (const s of sessionRows) {
    if (inRange(s.date, window)) infos.set(s.sessionId, { session: s, keys: sessionKeys(s), pageviews: [], events: [] });
  }
  const pageviewRows = await budget.take(
    ctx.db
      .query("pageviews")
      .withIndex("by_site_ts", (q) => q.eq("siteId", siteId).gte("ts", start).lt("ts", end + TAIL_MS)),
  );
  for (const p of pageviewRows) if (p.sessionId) infos.get(p.sessionId)?.pageviews.push(p);
  const eventRows = await budget.take(
    ctx.db
      .query("events")
      .withIndex("by_site_ts", (q) => q.eq("siteId", siteId).gte("ts", start).lt("ts", end + TAIL_MS)),
  );
  for (const e of eventRows) {
    if (e.sessionId && (e.type === "goal" || e.type === "outbound")) infos.get(e.sessionId)?.events.push(e);
  }

  // Payments in the window, each kept when the session it was credited to matches
  const revenue = (site.revenueSource ?? "none") !== "none";
  const currency = siteCurrency(site);
  const payments: { payment: Doc<"payments">; info: SessionInfo }[] = [];
  if (revenue) {
    const rows = await budget.take(
      ctx.db
        .query("payments")
        .withIndex("by_site_ts", (q) => q.eq("siteId", siteId).gte("ts", start).lt("ts", end)),
    );
    for (const p of rows) {
      if (!inRange(p.date, window) || p.sessionId === undefined) continue;
      const info = infos.get(p.sessionId) ?? (await creditedSession(ctx, budget, siteId, p.sessionId, infos));
      if (info && matches(info, filters)) payments.push({ payment: p, info });
    }
  }

  const matched = [...infos.values()].filter((i) => inRange(i.session.date, window) && matches(i, filters));
  const sessionsIn = (r: DateRange) => matched.filter((i) => inRange(i.session.date, r));
  const paymentsIn = (r: DateRange) => payments.filter((p) => inRange(p.payment.date, r));
  const current = sessionsIn(range);
  const currentPayments = paymentsIn(range);

  const launch = site.trackingStartedAt === undefined ? null : localDate(site.trackingStartedAt, site.timezone);
  const summary: Summary = {
    current: sumTotals(current, currentPayments, currency),
    previous: sumTotals(sessionsIn(prev), paymentsIn(prev), currency),
    comparable: launch === null || launch <= prev.from || launch > range.to,
    visitorsApprox: false,
  };

  // Chart: sessions on their start day, revenue on the payment's day
  const days = new Map(eachDate(range).map((date) => [date, { pageviews: 0, visitors: new Set<string>(), revenueMinor: 0 }]));
  for (const { session: s } of current) {
    const day = days.get(s.date);
    if (!day) continue;
    day.pageviews += s.pageviews;
    day.visitors.add(s.visitorId);
  }
  for (const { payment: p } of currentPayments) {
    const day = days.get(p.date);
    if (day && p.currency === currency) day.revenueMinor += p.amountMinor;
  }
  const timeseries: Series = [...days].map(([date, d]) => ({
    date,
    pageviews: d.pageviews,
    visitors: d.visitors.size,
    revenueMinor: d.revenueMinor,
  }));

  const breakdowns: Record<string, BreakdownResult> = {};
  for (const dim of ALL_DIMS) breakdowns[dim] = breakdown(dim, current, currentPayments, currency);

  const goalRows = breakdowns.goal.rows.map((r) => ({ name: r.key, completions: r.events, visitors: r.visitors }));
  const keyGoal = site.keyGoal ?? null;
  if (keyGoal !== null && !goalRows.some((r) => r.name === keyGoal)) {
    goalRows.push({ name: keyGoal, completions: 0, visitors: 0 });
  }
  const goals: GoalsResult = { rows: goalRows, visitors: summary.current.visitors, keyGoal };

  // Converted visitors: a payment credited to a matching session, or the key goal in one
  const converted = (r: DateRange): number => {
    if (revenue) {
      return new Set(
        paymentsIn(r)
          .filter(({ payment: p }) => p.kind === "payment" && p.currency === currency && p.visitorId)
          .map(({ payment: p }) => p.visitorId),
      ).size;
    }
    return new Set(
      sessionsIn(r)
        .filter((i) => i.events.some((e) => e.type === "goal" && e.name === keyGoal))
        .map((i) => i.session.visitorId),
    ).size;
  };
  const kind = revenue ? "revenue" : keyGoal !== null ? "goal" : null;
  const conversions: ConversionsResult = {
    kind,
    current: kind === null ? null : converted(range),
    previous: kind === null ? null : converted(prev),
    otherCurrencyPayments: currentPayments.filter(({ payment: p }) => p.currency !== currency).length,
  };

  return { summary, timeseries, breakdowns, goals, conversions };
}

/**
 * A credited session that started before the window (the visitor came in then and paid
 * later): read it, with its pageviews and events for page, goal and outbound filters.
 */
async function creditedSession(
  ctx: QueryCtx,
  budget: Budget,
  siteId: Id<"sites">,
  sessionId: string,
  infos: Map<string, SessionInfo>,
): Promise<SessionInfo | undefined> {
  const [session] = await budget.take(
    ctx.db.query("sessions").withIndex("by_site_session", (q) => q.eq("siteId", siteId).eq("sessionId", sessionId)),
  );
  if (session === undefined) return undefined;
  const pageviews = await budget.take(
    ctx.db.query("pageviews").withIndex("by_site_session", (q) => q.eq("siteId", siteId).eq("sessionId", sessionId)),
  );
  const events = (
    await budget.take(
      ctx.db
        .query("events")
        .withIndex("by_site_visitor_ts", (q) =>
          q
            .eq("siteId", siteId)
            .eq("visitorId", session.visitorId)
            .gte("ts", session.startedAt)
            .lte("ts", session.lastSeenAt + HOUR_MS),
        ),
    )
  ).filter((e) => e.sessionId === sessionId && (e.type === "goal" || e.type === "outbound"));
  // Kept out of the window's sessions (it started earlier) but cached for its other payments
  const info = { session, keys: sessionKeys(session), pageviews, events };
  infos.set(sessionId, info);
  return info;
}

type CreditedPayment = { payment: Doc<"payments">; info: SessionInfo };

function sumTotals(sessions: SessionInfo[], payments: CreditedPayment[], currency: string): Totals {
  const visitors = new Set<string>();
  let pageviews = 0;
  let bounces = 0;
  let engagedMs = 0;
  let durationSumMs = 0;
  let durationCount = 0;
  for (const { session: s, pageviews: pvs } of sessions) {
    visitors.add(s.visitorId);
    pageviews += s.pageviews;
    if (s.pageviews <= 1 && s.goals === 0) bounces++;
    engagedMs += s.engagedMs;
    for (const p of pvs) {
      if (p.durationMs === undefined) continue;
      durationSumMs += p.durationMs;
      durationCount++;
    }
  }
  let revenueMinor = 0;
  let paymentCount = 0;
  let refundsMinor = 0;
  for (const { payment: p } of payments) {
    if (p.currency !== currency) continue;
    revenueMinor += p.amountMinor;
    if (p.kind === "payment") paymentCount++;
    else refundsMinor -= p.amountMinor;
  }
  const n = sessions.length;
  return {
    visitors: visitors.size,
    pageviews,
    timeOnPageMs: durationCount === 0 ? null : Math.round(durationSumMs / durationCount),
    sessions: n,
    bounceRate: n === 0 ? null : bounces / n,
    sessionTimeMs: n === 0 ? null : Math.round(engagedMs / n),
    revenueMinor,
    payments: paymentCount,
    refundsMinor,
  };
}

/**
 * One list over the matching sessions. Visitors are distinct over the range (the rollups
 * sum them per day). Session lists count sessions and their pageviews, plus the revenue
 * of payments credited to them; Pages counts pageviews; Goals and Outbound count events.
 */
function breakdown(dim: Dim, sessions: SessionInfo[], payments: CreditedPayment[], currency: string): BreakdownResult {
  const byKey = new Map<string, DimEntry & { ids: Set<string> }>();
  const allIds = new Set<string>();
  const entry = (key: string) => {
    let e = byKey.get(key);
    if (!e) {
      e = { key, pageviews: 0, visitors: 0, sessions: 0, events: 0, revenueMinor: 0, ids: new Set() };
      byKey.set(key, e);
    }
    return e;
  };
  const seen = (e: { ids: Set<string> }, visitorId: string) => {
    e.ids.add(visitorId);
    allIds.add(visitorId);
  };

  for (const { session: s, keys, pageviews, events } of sessions) {
    if (SESSION_DIMS.has(dim)) {
      const key = keys.get(dim);
      if (key === undefined) continue;
      const e = entry(key);
      e.sessions++;
      e.pageviews += s.pageviews;
      seen(e, s.visitorId);
    } else if (dim === "page") {
      for (const p of pageviews) {
        const e = entry(p.path);
        e.pageviews++;
        seen(e, s.visitorId);
      }
    } else {
      const type = dim === "goal" ? "goal" : "outbound";
      for (const ev of events) {
        if (ev.type !== type) continue;
        const e = entry(ev.name);
        e.events++;
        seen(e, s.visitorId);
      }
    }
  }
  if (SESSION_DIMS.has(dim)) {
    for (const { payment: p, info } of payments) {
      const key = info.keys.get(dim);
      if (key !== undefined && p.currency === currency) entry(key).revenueMinor += p.amountMinor;
    }
  }

  const entries = [...byKey.values()].map(({ ids, ...e }) => ({ ...e, visitors: ids.size }));
  const total = { pageviews: 0, sessions: 0, events: 0, revenueMinor: 0 };
  for (const e of entries) {
    total.pageviews += e.pageviews;
    total.sessions += e.sessions;
    total.events += e.events;
    total.revenueMinor += e.revenueMinor;
  }
  return {
    rows: rankEntries(dim, entries).slice(0, MAX_BREAKDOWN_KEYS),
    totalPageviews: total.pageviews,
    totalVisitors: allIds.size,
    totalSessions: total.sessions,
    totalEvents: total.events,
    totalRevenueMinor: total.revenueMinor,
  };
}

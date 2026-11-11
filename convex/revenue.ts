import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { sessionSource } from "./lib/attribution";
import { requireReadableSite } from "./lib/auth";
import { hourWindow as hourBounds } from "./lib/dates";
import { dayWindow, filteredRevenue, hourWindow, type ViewWindow } from "./lib/filtered";
import { filterValidator, MAX_FILTER_DAYS, MAX_FILTERS, type Filter } from "./lib/filters";
import {
  JOURNEY_CAP,
  paymentRow,
  paymentSortValidator,
  paymentTable,
  revenueTotals,
  timeToConvert,
  toRow,
  type PaymentEntry,
  type RevenueTotals,
} from "./lib/payments";
import { isValidRange, previousRange, rangeDays, type DateRange } from "./lib/ranges";
import { siteCurrency } from "./lib/revenue";
import { breakdownResult, type BreakdownResult, type Totals } from "./lib/statsShapes";
import { rangeArg } from "./pages";
import { readDailyStats, sumTotals } from "./stats";

// The Revenue tab (launch v1 Phase 10). Its totals are the Analytics tab's: on day ranges
// the daily rollups (the Revenue tile's dailyStats), and with filters or an hour range the
// filtered view (lib/filtered.ts), so the tiles agree with the Revenue tile for the same
// range. The payments behind them are read from the raw table, joined to their visitor
// and credited session, for the Payments table and the time to convert.

// Payments read over the range and the period before; past it the tab says "too many"
const MAX_PAYMENT_ROWS = 2_000;
const HOUR_MS = 60 * 60 * 1000;

type Paid = { payment: Doc<"payments">; session: Doc<"sessions"> | null };

type Counted =
  | {
      status: "ok";
      current: Totals;
      previous: Totals;
      chart: { date: string; revenueMinor: number }[];
      /** The filtered view's lists; null on the rollups, where the page reads stats.breakdown */
      lists: { source: BreakdownResult; country: BreakdownResult } | null;
      payments: Paid[];
      previousPayments: Paid[];
    }
  | { status: "range" | "tooMany" };

/**
 * The Revenue tab: `totals` for the Revenue, Conversions, Avg. order value and Avg. time
 * to convert tiles (lib/payments.ts revenueTiles), revenue at each point of the range for
 * the chart, and one page of the Payments table (50 from `offset`, sorted by `sort`, kept
 * to what `search` matches; `matched` counts those). Payments and refunds in the site's
 * currency are listed; `otherCurrency` counts the range's payments left out for theirs.
 * `lists` holds Sources and Countries with filters or an hour range (null otherwise, when
 * the page reads stats.breakdown as the Analytics cards do). `status` is "none" on a site
 * without payments, "range" when a filtered range is too long, and "tooMany" past the
 * read limits.
 */
export const list = query({
  args: {
    domain: v.string(),
    range: rangeArg,
    filters: v.array(filterValidator),
    sort: paymentSortValidator,
    desc: v.boolean(),
    search: v.string(),
    offset: v.number(),
  },
  returns: v.union(
    v.object({
      status: v.literal("ok"),
      totals: revenueTotals,
      chart: v.array(v.object({ date: v.string(), revenueMinor: v.number() })),
      lists: v.union(v.null(), v.object({ source: breakdownResult, country: breakdownResult })),
      rows: v.array(paymentRow),
      offset: v.number(),
      matched: v.number(),
      otherCurrency: v.number(),
      currency: v.string(),
    }),
    v.object({ status: v.union(v.literal("none"), v.literal("range"), v.literal("tooMany")) }),
  ),
  handler: async (ctx, args) => {
    const site = await requireReadableSite(ctx, args.domain);
    if (args.filters.length > MAX_FILTERS) throw new ConvexError(`At most ${MAX_FILTERS} filters`);
    if ((site.revenueSource ?? "none") === "none") return { status: "none" as const };

    let counted: Counted;
    if ("period" in args.range) {
      const { start, end } = hourBounds(args.range.period, args.range.now, site.timezone);
      counted = await rawPayments(ctx, site, hourWindow(site, start, end), args.filters);
    } else {
      const range = { from: args.range.from, to: args.range.to };
      if (!isValidRange(range)) throw new ConvexError("Invalid date range");
      if (args.filters.length === 0) {
        counted = await rollupPayments(ctx, site, range);
      } else if (rangeDays(range) > MAX_FILTER_DAYS) {
        counted = { status: "range" };
      } else {
        counted = await rawPayments(ctx, site, dayWindow(site, range), args.filters);
      }
    }
    if (counted.status !== "ok") return { status: counted.status };

    const currency = siteCurrency(site);
    const visitors = new VisitorCache(ctx, site);
    const listed = counted.payments.filter((p) => p.payment.currency === currency);
    const entries: PaymentEntry[] = [];
    let tookSumMs = 0;
    let tookCount = 0;
    for (const paid of listed) {
      const entry = await paymentEntry(paid, visitors);
      entries.push(entry);
      if (entry.tookMs !== null) {
        tookSumMs += entry.tookMs;
        tookCount++;
      }
    }
    let previousTookSumMs = 0;
    let previousTookCount = 0;
    for (const { payment: p } of counted.previousPayments) {
      if (p.currency !== currency) continue;
      const visitor = p.visitorId === undefined ? null : await visitors.get(p.visitorId);
      const took = timeToConvert(p, visitor?.firstSeen);
      if (took === null) continue;
      previousTookSumMs += took;
      previousTookCount++;
    }

    const totals: RevenueTotals = {
      revenueMinor: counted.current.revenueMinor,
      previousRevenueMinor: counted.previous.revenueMinor,
      payments: counted.current.payments,
      previousPayments: counted.previous.payments,
      refundsMinor: counted.current.refundsMinor,
      previousRefundsMinor: counted.previous.refundsMinor,
      tookSumMs,
      tookCount,
      previousTookSumMs,
      previousTookCount,
    };

    const table = paymentTable(entries, args);
    const rows = [];
    for (const entry of table.rows) rows.push(toRow(entry, await journey(ctx, site, entry)));
    return {
      status: "ok" as const,
      totals,
      chart: counted.chart,
      lists: counted.lists,
      rows,
      offset: table.offset,
      matched: table.matched,
      otherCurrency: counted.payments.filter((p) => p.payment.currency !== currency && p.payment.kind === "payment")
        .length,
      currency,
    };
  },
});

/**
 * Day ranges without filters: the totals and chart from dailyStats (what the Analytics
 * Revenue tile sums), and the payments of the range and the period before, each with
 * the session it was credited to.
 */
async function rollupPayments(ctx: QueryCtx, site: Doc<"sites">, range: DateRange): Promise<Counted> {
  const prev = previousRange(range);
  const [stats, before] = [await readDailyStats(ctx, site._id, range), await readDailyStats(ctx, site._id, prev)];
  const byDate = new Map(stats.map((r) => [r.date, r.revenueMinor ?? 0]));
  const chart = dayWindow(site, range).points.map((date) => ({ date, revenueMinor: byDate.get(date) ?? 0 }));

  // Local days run from UTC-12 to UTC+14; the stored `date` decides
  const start = Date.parse(`${prev.from}T00:00:00Z`) - 14 * HOUR_MS;
  const end = Date.parse(`${range.to}T00:00:00Z`) + 36 * HOUR_MS;
  const rows = await ctx.db
    .query("payments")
    .withIndex("by_site_ts", (q) => q.eq("siteId", site._id).gte("ts", start).lt("ts", end))
    .take(MAX_PAYMENT_ROWS + 1);
  if (rows.length > MAX_PAYMENT_ROWS) return { status: "tooMany" };
  const inRange = (r: DateRange) => (p: Doc<"payments">) => p.date >= r.from && p.date <= r.to;

  const sessions = new Map<string, Doc<"sessions"> | null>();
  const payments: Paid[] = [];
  for (const payment of rows.filter(inRange(range))) {
    const id = payment.sessionId;
    let session: Doc<"sessions"> | null = null;
    if (id !== undefined) {
      if (!sessions.has(id)) {
        sessions.set(
          id,
          await ctx.db
            .query("sessions")
            .withIndex("by_site_session", (q) => q.eq("siteId", site._id).eq("sessionId", id))
            .unique(),
        );
      }
      session = sessions.get(id) ?? null;
    }
    payments.push({ payment, session });
  }
  return {
    status: "ok",
    current: sumTotals(stats),
    previous: sumTotals(before),
    chart,
    lists: null,
    payments,
    previousPayments: rows.filter(inRange(prev)).map((payment) => ({ payment, session: null })),
  };
}

/** Filters or an hour range: everything from the filtered view (lib/filtered.ts). */
async function rawPayments(ctx: QueryCtx, site: Doc<"sites">, window: ViewWindow, filters: Filter[]): Promise<Counted> {
  const view = await filteredRevenue(ctx, site, window, filters);
  if (view.status !== "ok") return view;
  const paid = (list: typeof view.current): Paid[] =>
    list.map(({ payment, info }) => ({ payment, session: info.session }));
  return {
    status: "ok",
    current: view.summary.current,
    previous: view.summary.previous,
    chart: view.timeseries.map((p) => ({ date: p.date, revenueMinor: p.revenueMinor })),
    lists: { source: view.sources, country: view.countries },
    payments: paid(view.current),
    previousPayments: paid(view.previous),
  };
}

/** Visitor rows by id, each read once per query. */
class VisitorCache {
  private rows = new Map<string, Doc<"visitors"> | null>();
  constructor(
    private ctx: QueryCtx,
    private site: Doc<"sites">,
  ) {}
  async get(visitorId: string): Promise<Doc<"visitors"> | null> {
    if (!this.rows.has(visitorId)) {
      const row = await this.ctx.db
        .query("visitors")
        .withIndex("by_site_visitor", (q) => q.eq("siteId", this.site._id).eq("visitorId", visitorId))
        .unique();
      this.rows.set(visitorId, row);
    }
    return this.rows.get(visitorId) ?? null;
  }
}

/** A payment as the table lists it: who paid, from where, how they came, and how long it took. */
async function paymentEntry({ payment: p, session }: Paid, visitors: VisitorCache): Promise<PaymentEntry> {
  const visitor = p.visitorId === undefined ? null : await visitors.get(p.visitorId);
  const source = session === null ? null : sessionSource(session);
  return {
    id: p._id,
    kind: p.kind,
    renewal: p.renewal,
    visitorId: p.visitorId ?? null,
    name: visitor?.name ?? null,
    email: visitor?.email ?? null,
    payerEmail: p.email ?? null,
    country: session?.country ?? visitor?.country ?? null,
    city: session?.city ?? (session === null ? (visitor?.city ?? null) : null),
    device: session?.device ?? visitor?.device ?? null,
    source: source?.source ?? null,
    channel: source?.channel ?? null,
    entryPath: session?.entryPath ?? null,
    tookMs: timeToConvert(p, visitor?.firstSeen),
    amountMinor: p.amountMinor,
    ts: p.ts,
  };
}

/** The visitor's sessions that started up to the payment, at most JOURNEY_CAP + 1. */
async function journey(ctx: QueryCtx, site: Doc<"sites">, e: PaymentEntry): Promise<number | null> {
  const visitorId = e.visitorId;
  if (visitorId === null) return null;
  const sessions = await ctx.db
    .query("sessions")
    .withIndex("by_site_visitor_started", (q) =>
      q.eq("siteId", site._id).eq("visitorId", visitorId).lte("startedAt", e.ts),
    )
    .take(JOURNEY_CAP + 1);
  return sessions.length;
}

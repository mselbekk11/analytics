import { v, type Infer } from "convex/values";
import { displayName, persona } from "./names";
import { percentChange } from "./ranges";

// The Revenue tab (launch v1 Phase 10): the tiles, worked out from the same totals as the
// Analytics Revenue tile, and the Payments table, sorted, searched and cut into pages here
// (as the Pages and Outbound tabs do), so the browser only gets the rows it shows.

export const PAYMENT_SORTS = ["customer", "location", "source", "took", "amount", "paid"] as const;

export type PaymentSort = (typeof PAYMENT_SORTS)[number];

export const paymentSortValidator = v.union(...PAYMENT_SORTS.map((s) => v.literal(s)));

export const PAYMENT_ROWS = 50;

/** What the tiles are worked out from, for the range and the period of equal length before. */
export const revenueTotals = v.object({
  /** Net of refunds, in the site's currency: the Analytics Revenue tile */
  revenueMinor: v.number(),
  previousRevenueMinor: v.number(),
  /** Payments, refunds not counted */
  payments: v.number(),
  previousPayments: v.number(),
  /** Refunded, positive */
  refundsMinor: v.number(),
  previousRefundsMinor: v.number(),
  /** First visit to payment, summed over the payments that have one (see `took`) */
  tookSumMs: v.number(),
  tookCount: v.number(),
  previousTookSumMs: v.number(),
  previousTookCount: v.number(),
});

export type RevenueTotals = Infer<typeof revenueTotals>;

/**
 * Revenue, Conversions (payments), Avg. order value (what payments brought in before
 * refunds, per payment) and Avg. time to convert, each with its change against the
 * period before. Averages are null without payments.
 */
export function revenueTiles(t: RevenueTotals) {
  const order = (revenue: number, refunds: number, n: number) => (n === 0 ? null : (revenue + refunds) / n);
  const aov = order(t.revenueMinor, t.refundsMinor, t.payments);
  const previousAov = order(t.previousRevenueMinor, t.previousRefundsMinor, t.previousPayments);
  const took = t.tookCount === 0 ? null : t.tookSumMs / t.tookCount;
  const previousTook = t.previousTookCount === 0 ? null : t.previousTookSumMs / t.previousTookCount;
  const change = (a: number | null, b: number | null) => (a === null || b === null ? null : percentChange(a, b));
  return {
    revenue: { value: t.revenueMinor, change: percentChange(t.revenueMinor, t.previousRevenueMinor) },
    conversions: { value: t.payments, change: percentChange(t.payments, t.previousPayments) },
    aov: { value: aov, change: change(aov, previousAov) },
    took: { value: took, change: change(took, previousTook) },
  };
}

/**
 * Time to convert: from the visitor's first visit to this payment. Only first purchases
 * and one-off payments count, not renewals or refunds, and only payments linked to a
 * visitor. Null otherwise.
 */
export function timeToConvert(
  p: { kind: "payment" | "refund"; renewal: boolean; ts: number },
  firstSeen: number | undefined,
): number | null {
  if (p.kind !== "payment" || p.renewal || firstSeen === undefined) return null;
  return Math.max(0, p.ts - firstSeen);
}

export const paymentRow = v.object({
  id: v.string(),
  kind: v.union(v.literal("payment"), v.literal("refund")),
  renewal: v.boolean(),
  /** Null for a payment no visitor was matched to */
  visitorId: v.union(v.null(), v.string()),
  /** What the Users table shows: identify() name, email (or the payment's), animal name */
  customer: v.union(v.null(), v.string()),
  /** The credited session's, else the visitor's latest */
  country: v.union(v.null(), v.string()),
  city: v.union(v.null(), v.string()),
  device: v.union(v.null(), v.string()),
  /** The credited session's source; null for an unattributed payment */
  source: v.union(v.null(), v.string()),
  channel: v.union(v.null(), v.string()),
  entryPath: v.union(v.null(), v.string()),
  /** The visitor's sessions that started by the payment, at most JOURNEY_CAP + 1 (more than
   * JOURNEY_CAP reads "N+"); null without a visitor */
  journey: v.union(v.null(), v.number()),
  tookMs: v.union(v.null(), v.number()),
  amountMinor: v.number(),
  ts: v.number(),
});

export type PaymentRow = Infer<typeof paymentRow>;

/** Sessions counted for a row's journey dots; past it the row shows "N+" */
export const JOURNEY_CAP = 10;

/** A payment row before its journey is counted (only the rows of a page are). */
export type PaymentEntry = Omit<PaymentRow, "journey" | "customer"> & {
  name: string | null;
  email: string | null;
  /** Searched as well: the payer's email from the provider */
  payerEmail: string | null;
};

let regionNames: Intl.DisplayNames | null = null;

/** A country code's English name (as the Users search uses). */
export function countryLabel(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** The name a row's Customer cell shows; null for an unattributed payment without an email. */
export function customerName(e: Pick<PaymentEntry, "visitorId" | "name" | "email" | "payerEmail">): string | null {
  if (e.visitorId !== null) return displayName(e.visitorId, e.name, e.email ?? e.payerEmail);
  return e.payerEmail;
}

/** The row the table gets for an entry, with its journey counted. */
export function toRow(e: PaymentEntry, journey: number | null): PaymentRow {
  return {
    id: e.id,
    kind: e.kind,
    renewal: e.renewal,
    visitorId: e.visitorId,
    customer: customerName(e),
    country: e.country,
    city: e.city,
    device: e.device,
    source: e.source,
    channel: e.channel,
    entryPath: e.entryPath,
    journey,
    tookMs: e.tookMs,
    amountMinor: e.amountMinor,
    ts: e.ts,
  };
}

/**
 * Whether a payment matches the search: part of its customer's name, email or animal name,
 * its source or channel, its country's English name or city, the landing page of its
 * session, or "refund" / "renewal"; or its country's code exactly ("de").
 */
export function paymentMatches(e: PaymentEntry, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (needle === "") return true;
  if (e.country !== null && e.country.toLowerCase() === needle) return true;
  const fields = [
    e.name,
    e.email,
    e.payerEmail,
    e.visitorId === null ? null : persona(e.visitorId).name,
    e.source,
    e.channel,
    e.country === null ? null : countryLabel(e.country),
    e.city,
    e.entryPath,
    e.kind === "refund" ? "refund" : null,
    e.renewal ? "renewal" : null,
  ];
  return fields.some((f) => f !== null && f.toLowerCase().includes(needle));
}

// The value each column sorts by; rows without one (null) go last either way
const VALUE: Record<PaymentSort, (e: PaymentEntry) => string | number | null> = {
  customer: (e) => customerName(e),
  location: (e) => (e.country === null ? null : countryLabel(e.country)),
  source: (e) => e.source,
  took: (e) => e.tookMs,
  amount: (e) => e.amountMinor,
  paid: (e) => e.ts,
};

/**
 * The payments the search keeps, sorted by `sort`, and the `limit` rows from `offset`,
 * moved back to the last page if it is past the end. `matched` counts what the search kept.
 */
export function paymentTable(
  entries: PaymentEntry[],
  opts: { sort: PaymentSort; desc: boolean; search: string; offset: number; limit?: number },
): { rows: PaymentEntry[]; offset: number; matched: number } {
  const newest = [...entries].sort((a, b) => b.ts - a.ts || a.id.localeCompare(b.id));
  const kept = newest.filter((e) => paymentMatches(e, opts.search));
  const dir = opts.desc ? -1 : 1;
  const value = VALUE[opts.sort];
  // Sorting is stable, so equal values keep the newest-first order
  const sorted = [...kept].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    return dir * (typeof x === "string" ? x.localeCompare(String(y)) : x - Number(y));
  });
  const limit = opts.limit ?? PAYMENT_ROWS;
  const last = Math.max(0, Math.ceil(sorted.length / limit) - 1) * limit;
  const offset = Math.min(Math.max(0, Math.floor(opts.offset / limit) * limit), last);
  return { rows: sorted.slice(offset, offset + limit), offset, matched: sorted.length };
}

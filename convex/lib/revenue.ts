import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { sessionSource, sourceDims } from "./attribution";
import { localDate } from "./dates";
import type { Dim } from "./dims";
import { cityKey, regionKey } from "./geo";
import { bumpDailyStats, bumpRevenueDim } from "./rollups";

// Payments from Stripe and the payments API. Each is linked to a visitor by the first
// rule that finds one (metadata, return page, customer, email) and credited to one of
// that visitor's sessions, whose source, campaign and location then get the revenue.
// A payment nothing matches still counts in the totals, under "Unattributed". Payments
// in a currency other than the site's are stored but left out of every total.

export const UNATTRIBUTED = "Unattributed";
export const DEFAULT_CURRENCY = "USD";

export type MatchedBy = "metadata" | "return_page" | "customer" | "email";

export type NewPayment = {
  provider: "stripe" | "api";
  providerId: string;
  ts: number;
  kind: "payment" | "refund";
  amountMinor: number; // negative for refunds
  currency: string;
  renewal: boolean;
  customerId?: string;
  email?: string;
  visitorId?: string; // va_vid from Checkout metadata, or the API's visitorId
  checkoutSessionId?: string;
  subscriptionId?: string;
  paymentIntentId?: string;
  invoiceId?: string;
};

type Link = { visitorId: string; matchedBy: MatchedBy; sessionId?: string };

// Lookups that only need the latest few rows
const MAX_MATCH_ROWS = 50;

export function siteCurrency(site: Doc<"sites">): string {
  return site.currency ?? DEFAULT_CURRENCY;
}

/**
 * Stores a payment or refund once per provider id (Stripe retries webhooks) and adds
 * it to the day's totals and the credited session's dims. Returns null for a repeat.
 */
export async function recordPayment(
  ctx: MutationCtx,
  site: Doc<"sites">,
  p: NewPayment,
): Promise<{ matchedBy: MatchedBy | null } | null> {
  const seen = await ctx.db
    .query("payments")
    .withIndex("by_site_provider_id", (q) =>
      q.eq("siteId", site._id).eq("provider", p.provider).eq("providerId", p.providerId),
    )
    .unique();
  if (seen !== null) return null;

  // A subscription's invoices take its Checkout Session id, so a return-page claim finds them
  const checkout =
    p.subscriptionId === undefined ? null : await checkoutBySubscription(ctx, site, p.subscriptionId);
  const payment = { ...p, checkoutSessionId: p.checkoutSessionId ?? checkout?.checkoutSessionId };

  const link =
    p.kind === "refund"
      ? ((await refundLink(ctx, site, payment)) ?? (await matchVisitor(ctx, site, payment, checkout)))
      : await matchVisitor(ctx, site, payment, checkout);
  const session =
    link === null
      ? null
      : link.sessionId !== undefined
        ? await sessionById(ctx, site, link.sessionId)
        : await creditedSession(ctx, site, link.visitorId, p.ts);

  const date = localDate(p.ts, site.timezone);
  const id = await ctx.db.insert("payments", {
    siteId: site._id,
    ...payment,
    date,
    visitorId: link?.visitorId,
    matchedBy: link?.matchedBy,
    sessionId: session?.sessionId,
  });

  if (p.currency === siteCurrency(site)) {
    await bumpDailyStats(ctx, site._id, date, {
      revenueMinor: p.amountMinor,
      ...(p.kind === "payment" ? { payments: 1 } : { refundsMinor: -p.amountMinor }),
    });
    await creditDims(ctx, site, date, session, p.amountMinor);
    await creditVisitor(ctx, site, (await ctx.db.get("payments", id))!, session);
  }
  return { matchedBy: link?.matchedBy ?? null };
}

/**
 * Links an unattributed payment found later (its return-page claim or subscription
 * Checkout came after it): moves its revenue from "Unattributed" to the session.
 */
async function linkLater(ctx: MutationCtx, site: Doc<"sites">, payment: Doc<"payments">, link: Link) {
  if (payment.visitorId !== undefined) return;
  const session = await creditedSession(ctx, site, link.visitorId, payment.ts);
  await ctx.db.patch("payments", payment._id, {
    visitorId: link.visitorId,
    matchedBy: link.matchedBy,
    sessionId: session?.sessionId,
  });
  if (payment.currency !== siteCurrency(site) || session === null) return;
  await creditDims(ctx, site, payment.date, null, -payment.amountMinor);
  await creditDims(ctx, site, payment.date, session, payment.amountMinor);
  await creditVisitor(ctx, site, { ...payment, visitorId: link.visitorId }, session);
}

/** Tries the four rules in order and returns the first visitor found. */
async function matchVisitor(
  ctx: MutationCtx,
  site: Doc<"sites">,
  p: Pick<NewPayment, "visitorId" | "checkoutSessionId" | "customerId" | "email">,
  checkout: Doc<"checkouts"> | null,
): Promise<Link | null> {
  // 1. va_vid in the Checkout Session's metadata (or the subscription's), or from the API
  for (const visitorId of [p.visitorId, checkout?.visitorId]) {
    if (visitorId !== undefined && (await visitorByVid(ctx, site, visitorId)) !== null) {
      return { visitorId, matchedBy: "metadata" };
    }
  }
  // 2. The success page sent this Checkout Session's id back
  if (p.checkoutSessionId !== undefined) {
    const cs = p.checkoutSessionId;
    const claim = await ctx.db
      .query("events")
      .withIndex("by_site_type_name", (q) => q.eq("siteId", site._id).eq("type", "claim").eq("name", cs))
      .first();
    if (claim?.visitorId !== undefined) return { visitorId: claim.visitorId, matchedBy: "return_page" };
  }
  // 3. An earlier payment from the same customer was linked
  if (p.customerId !== undefined) {
    const customerId = p.customerId;
    const earlier = await ctx.db
      .query("payments")
      .withIndex("by_site_customer", (q) => q.eq("siteId", site._id).eq("customerId", customerId))
      .order("desc")
      .take(MAX_MATCH_ROWS);
    const linked = earlier.find((r) => r.visitorId !== undefined);
    if (linked?.visitorId !== undefined) return { visitorId: linked.visitorId, matchedBy: "customer" };
  }
  // 4. A visitor identify()'d with the same email; the most recently seen one wins
  if (p.email !== undefined) {
    const email = p.email;
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_site_email", (q) => q.eq("siteId", site._id).eq("email", email))
      .take(MAX_MATCH_ROWS);
    const latest = visitors.sort((a, b) => b.lastSeen - a.lastSeen)[0];
    if (latest !== undefined) return { visitorId: latest.visitorId, matchedBy: "email" };
  }
  return null;
}

/** A Stripe refund goes to the session its payment was credited to. */
async function refundLink(ctx: MutationCtx, site: Doc<"sites">, p: NewPayment): Promise<Link | null> {
  let original: Doc<"payments"> | null = null;
  if (p.paymentIntentId !== undefined) {
    const pi = p.paymentIntentId;
    original = await ctx.db
      .query("payments")
      .withIndex("by_site_paymentIntent", (q) => q.eq("siteId", site._id).eq("paymentIntentId", pi))
      .first();
  }
  if (original === null && p.invoiceId !== undefined) {
    const invoiceId = p.invoiceId;
    original = await ctx.db
      .query("payments")
      .withIndex("by_site_invoice", (q) => q.eq("siteId", site._id).eq("invoiceId", invoiceId))
      .first();
  }
  if (original?.visitorId === undefined || original.matchedBy === undefined) return null;
  return { visitorId: original.visitorId, matchedBy: original.matchedBy, sessionId: original.sessionId };
}

/**
 * The session a payment is credited to: the visitor's last session before it that did
 * not come in Direct, or their last session if all did.
 */
async function creditedSession(
  ctx: MutationCtx,
  site: Doc<"sites">,
  visitorId: string,
  ts: number,
): Promise<Doc<"sessions"> | null> {
  const before = await ctx.db
    .query("sessions")
    .withIndex("by_site_visitor_started", (q) =>
      q.eq("siteId", site._id).eq("visitorId", visitorId).lte("startedAt", ts),
    )
    .order("desc")
    .take(100);
  const credited = before.find((s) => sessionSource(s).channel !== "Direct") ?? before[0];
  if (credited !== undefined) return credited;
  // A payment timed before the visitor's first session (an API `ts`, say)
  return await ctx.db
    .query("sessions")
    .withIndex("by_site_visitor_started", (q) => q.eq("siteId", site._id).eq("visitorId", visitorId))
    .first();
}

/** Adds revenue to the session's source, campaign and location keys, or to "Unattributed". */
async function creditDims(
  ctx: MutationCtx,
  site: Doc<"sites">,
  date: string,
  session: Doc<"sessions"> | null,
  amountMinor: number,
): Promise<void> {
  const keys: [Dim, string][] =
    session === null
      ? [
          ["source", UNATTRIBUTED],
          ["channel", UNATTRIBUTED],
        ]
      : [
          ...sourceDims({ ...session, ...sessionSource(session) }),
          ["referrer", session.referrer],
          ["country", session.country],
          ["region", regionKey(session.country, session.region)],
          ["city", cityKey(session.country, session.region, session.city)],
        ];
  for (const [dim, key] of keys) {
    await bumpRevenueDim(ctx, site._id, date, dim, key, amountMinor);
  }
}

/** Lifetime revenue on the visitor and the credited session; the payment's email fills a missing one. */
async function creditVisitor(
  ctx: MutationCtx,
  site: Doc<"sites">,
  payment: Pick<Doc<"payments">, "visitorId" | "amountMinor" | "kind" | "ts" | "email">,
  session: Doc<"sessions"> | null,
): Promise<void> {
  if (session !== null) {
    const fresh = (await ctx.db.get("sessions", session._id))!;
    await ctx.db.patch("sessions", session._id, { revenueMinor: fresh.revenueMinor + payment.amountMinor });
  }
  if (payment.visitorId === undefined) return;
  const visitor = await visitorByVid(ctx, site, payment.visitorId);
  if (visitor === null) return;
  const paid = payment.kind === "payment";
  await ctx.db.patch("visitors", visitor._id, {
    revenueMinor: visitor.revenueMinor + payment.amountMinor,
    ...(paid && (visitor.firstPaidAt === undefined || payment.ts < visitor.firstPaidAt)
      ? { firstPaidAt: payment.ts }
      : {}),
    ...(visitor.email === undefined && payment.email !== undefined ? { email: payment.email } : {}),
  });
}

/**
 * A subscription Checkout completed. Keeps its metadata visitor and customer, gives
 * its invoices its id, and links those that were still unattributed.
 */
export async function recordCheckout(
  ctx: MutationCtx,
  site: Doc<"sites">,
  c: { checkoutSessionId: string; ts: number; customerId?: string; subscriptionId?: string; visitorId?: string },
): Promise<void> {
  const existing = await ctx.db
    .query("checkouts")
    .withIndex("by_site_checkout", (q) => q.eq("siteId", site._id).eq("checkoutSessionId", c.checkoutSessionId))
    .unique();
  if (existing !== null) return;
  const id = await ctx.db.insert("checkouts", { siteId: site._id, ...c });
  const checkout = (await ctx.db.get("checkouts", id))!;
  if (c.subscriptionId === undefined) return;

  const subscriptionId = c.subscriptionId;
  const invoices = await ctx.db
    .query("payments")
    .withIndex("by_site_subscription", (q) => q.eq("siteId", site._id).eq("subscriptionId", subscriptionId))
    .take(MAX_MATCH_ROWS);
  for (const invoice of invoices) {
    if (invoice.checkoutSessionId === undefined) {
      await ctx.db.patch("payments", invoice._id, { checkoutSessionId: c.checkoutSessionId });
    }
    if (invoice.visitorId !== undefined || invoice.kind !== "payment") continue;
    const link = await matchVisitor(ctx, site, { ...invoice, checkoutSessionId: c.checkoutSessionId }, checkout);
    if (link !== null) await linkLater(ctx, site, invoice, link);
  }
}

/** The return page claimed this Checkout Session: link its payments if they are unattributed. */
export async function claimCheckout(ctx: MutationCtx, site: Doc<"sites">, checkoutSessionId: string, visitorId: string) {
  const payments = await ctx.db
    .query("payments")
    .withIndex("by_site_checkout", (q) => q.eq("siteId", site._id).eq("checkoutSessionId", checkoutSessionId))
    .take(MAX_MATCH_ROWS);
  for (const payment of payments) {
    if (payment.kind === "payment") await linkLater(ctx, site, payment, { visitorId, matchedBy: "return_page" });
  }
}

async function checkoutBySubscription(ctx: MutationCtx, site: Doc<"sites">, subscriptionId: string) {
  return await ctx.db
    .query("checkouts")
    .withIndex("by_site_subscription", (q) => q.eq("siteId", site._id).eq("subscriptionId", subscriptionId))
    .first();
}

async function visitorByVid(ctx: MutationCtx, site: Doc<"sites">, visitorId: string) {
  return await ctx.db
    .query("visitors")
    .withIndex("by_site_visitor", (q) => q.eq("siteId", site._id).eq("visitorId", visitorId))
    .unique();
}

async function sessionById(ctx: MutationCtx, site: Doc<"sites">, sessionId: string) {
  return await ctx.db
    .query("sessions")
    .withIndex("by_site_session", (q) => q.eq("siteId", site._id).eq("sessionId", sessionId))
    .unique();
}

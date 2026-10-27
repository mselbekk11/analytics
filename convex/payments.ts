import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { recordCheckout, recordPayment, type MatchedBy } from "./lib/revenue";
import { checkSecret } from "./lib/secret";
import { stripeRecordValidator } from "./lib/stripe";

// Payments come in through the Stripe webhook (convex/http.ts) or POST /api/payments.
// The recording and matching rules live in lib/revenue.ts.

/** The site and its webhook signing secret, for /stripe/{siteId}; null if either is missing. */
export const stripeSecret = internalQuery({
  args: { siteId: v.string() },
  returns: v.union(v.null(), v.object({ siteId: v.id("sites"), secret: v.string() })),
  handler: async (ctx, args) => {
    const siteId = ctx.db.normalizeId("sites", args.siteId);
    if (siteId === null || (await ctx.db.get("sites", siteId)) === null) return null;
    const secrets = await ctx.db
      .query("siteSecrets")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .unique();
    if (!secrets?.stripeWebhookSecret) return null;
    return { siteId, secret: secrets.stripeWebhookSecret };
  },
});

/** A verified Stripe event, already reduced by parseStripeEvent. */
export const recordStripe = internalMutation({
  args: { siteId: v.id("sites"), record: stripeRecordValidator },
  returns: v.null(),
  handler: async (ctx, { siteId, record: r }) => {
    const site = await ctx.db.get("sites", siteId);
    if (site === null) return null;
    if (r.type === "checkout") {
      await recordCheckout(ctx, site, {
        checkoutSessionId: r.checkoutSessionId,
        ts: r.ts,
        customerId: r.customerId,
        subscriptionId: r.subscriptionId,
        visitorId: r.visitorId,
      });
    } else if (r.type === "payment") {
      const { type, ...payment } = r;
      await recordPayment(ctx, site, { ...payment, provider: "stripe", kind: type });
    } else {
      // charge.refunded carries the total refunded so far, so each partial refund is the
      // difference from the ones already recorded for this charge
      const prefix = `${r.chargeId}#`;
      const earlier = await ctx.db
        .query("payments")
        .withIndex("by_site_provider_id", (q) =>
          q.eq("siteId", site._id).eq("provider", "stripe").gte("providerId", prefix).lt("providerId", `${prefix}~`),
        )
        .take(100);
      const refunded = -earlier.reduce((n, p) => n + p.amountMinor, 0);
      if (r.refundedMinor <= refunded) return null;
      await recordPayment(ctx, site, {
        provider: "stripe",
        providerId: `${prefix}${r.refundedMinor}`,
        ts: r.ts,
        kind: "refund",
        amountMinor: -(r.refundedMinor - refunded),
        currency: r.currency,
        renewal: false,
        customerId: r.customerId,
        email: r.email,
        paymentIntentId: r.paymentIntentId,
        invoiceId: r.invoiceId,
      });
    }
    return null;
  },
});

/**
 * A payment or refund from POST /api/payments, for any provider without a webhook here.
 * The route hashes the Bearer key; the hash finds the site. `amountMinor` is positive,
 * `refund` makes it negative. A repeat of the same id is reported, not counted again.
 */
export const recordApi = mutation({
  args: {
    secret: v.string(),
    keyHash: v.string(),
    payment: v.object({
      id: v.string(),
      amountMinor: v.number(),
      currency: v.string(),
      email: v.optional(v.string()),
      customerId: v.optional(v.string()),
      visitorId: v.optional(v.string()),
      sessionId: v.optional(v.string()),
      ts: v.optional(v.number()),
      refund: v.optional(v.boolean()),
    }),
  },
  returns: v.union(
    v.object({ status: v.literal("unauthorized") }),
    v.object({
      status: v.union(v.literal("recorded"), v.literal("duplicate")),
      matchedBy: v.union(v.null(), v.string()),
    }),
  ),
  handler: async (ctx, { secret, keyHash, payment: p }) => {
    checkSecret(secret);
    const secrets = await ctx.db
      .query("siteSecrets")
      .withIndex("by_apiKeyHash", (q) => q.eq("apiKeyHash", keyHash))
      .unique();
    const site = secrets === null ? null : await ctx.db.get("sites", secrets.siteId);
    if (site === null) return { status: "unauthorized" as const };

    // A session id alone still names its visitor
    let visitorId = p.visitorId;
    if (visitorId === undefined && p.sessionId !== undefined) {
      const sessionId = p.sessionId;
      const session = await ctx.db
        .query("sessions")
        .withIndex("by_site_session", (q) => q.eq("siteId", site._id).eq("sessionId", sessionId))
        .unique();
      visitorId = session?.visitorId;
    }

    const result = await recordPayment(ctx, site, {
      provider: "api",
      providerId: p.id,
      ts: p.ts ?? Date.now(),
      kind: p.refund ? "refund" : "payment",
      amountMinor: p.refund ? -p.amountMinor : p.amountMinor,
      currency: p.currency,
      renewal: false,
      customerId: p.customerId,
      email: p.email,
      visitorId,
    });
    if (result === null) {
      const existing: Doc<"payments"> | null = await ctx.db
        .query("payments")
        .withIndex("by_site_provider_id", (q) =>
          q.eq("siteId", site._id).eq("provider", "api").eq("providerId", p.id),
        )
        .unique();
      return { status: "duplicate" as const, matchedBy: existing?.matchedBy ?? null };
    }
    return { status: "recorded" as const, matchedBy: result.matchedBy satisfies MatchedBy | null };
  },
});

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { accessState, accessValidator, ownerAccount } from "./lib/access";
import { requireOwnerId } from "./lib/auth";
import { shouldApply, subscriptionRecordValidator } from "./lib/billing";
import { stripeApi } from "./lib/stripeApi";
import { lookupKey, tierByEvents } from "./lib/tiers";

// Subscribing (launch v1 Phase 4). The checkout action sends the customer to Stripe
// Checkout; the billing webhook (http.ts, /billing/stripe) re-reads the subscription and
// applySubscription writes it onto the account, which unlocks the dashboard reactively.

const intervalValidator = v.union(v.literal("month"), v.literal("year"));

// Stripe Checkout needs a trial end at least 48 hours ahead; an hour of slack
const MIN_TRIAL_LEFT_MS = 49 * 60 * 60 * 1000;

/** What the checkout action needs from the signed-in user's account. */
export const checkoutAccount = internalQuery({
  args: { ownerId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      accountId: v.id("accounts"),
      access: accessValidator,
      customerId: v.union(v.null(), v.string()),
      trialEndsAt: v.number(),
      trialEnded: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const account = await ownerAccount(ctx, args.ownerId);
    if (account === null) return null;
    return {
      accountId: account._id,
      access: accessState(account),
      customerId: account.stripeCustomerId ?? null,
      trialEndsAt: account.trialEndsAt,
      trialEnded: account.trialEnded === true,
    };
  },
});

/** Stores the Stripe customer made for an account; returns the one kept if two raced. */
export const setCustomer = internalMutation({
  args: { ownerId: v.string(), customerId: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const account = await ownerAccount(ctx, args.ownerId);
    if (account === null) throw new ConvexError("No account");
    if (account.stripeCustomerId !== undefined) return account.stripeCustomerId;
    await ctx.db.patch("accounts", account._id, { stripeCustomerId: args.customerId });
    return args.customerId;
  },
});

/**
 * Starts a subscription-mode Stripe Checkout for a tier and interval and returns its URL.
 * The price is found by lookup key, so no price ids live in env vars. A trial with more
 * than two days left carries over: Stripe takes the card now and charges when it ends.
 */
export const checkout = action({
  args: { events: v.number(), interval: intervalValidator },
  returns: v.string(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new ConvexError("Not signed in");
    const ownerId = identity.tokenIdentifier;
    const tier = tierByEvents(args.events);
    if (tier === null) throw new ConvexError("Unknown tier");
    const appUrl = process.env.APP_URL;
    if (!appUrl) throw new Error("APP_URL is not set on this Convex deployment");

    const account = await ctx.runQuery(internal.billing.checkoutAccount, { ownerId });
    if (account === null) throw new ConvexError("No account yet, reload the page");
    if (account.access === "comped") throw new ConvexError("Your account is free, no subscription needed");
    if (account.access === "active" || account.access === "past_due") {
      throw new ConvexError("You already have a subscription");
    }

    const stripe = stripeApi();
    const key = lookupKey(tier, args.interval);
    const prices = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
    const price = prices.data[0];
    if (price === undefined) throw new Error(`No active Stripe price with lookup key ${key}: run scripts/stripe-setup.mjs`);

    let customerId = account.customerId;
    if (customerId === null) {
      const customer = await stripe.customers.create(
        { email: identity.email, name: identity.name, metadata: { ownerId } },
        { idempotencyKey: `customer-${account.accountId}` },
      );
      customerId = await ctx.runMutation(internal.billing.setCustomer, { ownerId, customerId: customer.id });
    }

    const keepTrial = !account.trialEnded && account.trialEndsAt - Date.now() > MIN_TRIAL_LEFT_MS;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: account.accountId,
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { ownerId },
      subscription_data: {
        metadata: { ownerId },
        ...(keepTrial ? { trial_end: Math.floor(account.trialEndsAt / 1000) } : {}),
      },
      success_url: `${appUrl}/billing?checkout=success`,
      cancel_url: `${appUrl}/billing`,
    });
    if (!session.url) throw new Error("Stripe returned no Checkout URL");
    return session.url;
  },
});

/** Tags the portal configuration scripts/stripe-setup.mjs makes (metadata.app). */
const PORTAL_APP = "simple-stats";

/**
 * Opens the Stripe customer portal for the signed-in user's customer and returns its URL
 * (Phase 5): switch tier or interval, update the card, see invoices, cancel at period
 * end. `flow: "payment_method_update"` goes straight to the card form (the past-due
 * banner). Changes come back through the billing webhook like any other.
 */
export const portal = action({
  args: { flow: v.optional(v.literal("payment_method_update")) },
  returns: v.string(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new ConvexError("Not signed in");
    const appUrl = process.env.APP_URL;
    if (!appUrl) throw new Error("APP_URL is not set on this Convex deployment");
    const account = await ctx.runQuery(internal.billing.checkoutAccount, { ownerId: identity.tokenIdentifier });
    if (account?.customerId == null) throw new ConvexError("No subscription yet");

    const stripe = stripeApi();
    // The setup script's configuration, found by tag so it needn't be the account default
    const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
    const configuration = configs.data.find((c) => c.metadata?.app === PORTAL_APP);
    if (configuration === undefined) throw new Error("No portal configuration: run scripts/stripe-setup.mjs");

    const returnUrl = `${appUrl}/billing`;
    const session = await stripe.billingPortal.sessions.create({
      customer: account.customerId,
      configuration: configuration.id,
      return_url: returnUrl,
      ...(args.flow === "payment_method_update"
        ? {
            flow_data: {
              type: "payment_method_update",
              after_completion: { type: "redirect", redirect: { return_url: returnUrl } },
            },
          }
        : {}),
    });
    return session.url;
  },
});

/**
 * Writes a subscription, as just re-read from Stripe, onto its account. Idempotent: it
 * sets the stored state from the subscription itself rather than applying the event, so
 * replayed and out-of-order events leave the same result. The account is found by the
 * ownerId the checkout put in metadata, else by the Stripe customer.
 */
export const applySubscription = internalMutation({
  args: { record: subscriptionRecordValidator },
  returns: v.union(v.literal("applied"), v.literal("ignored"), v.literal("no_account")),
  handler: async (ctx, { record: r }) => {
    const account =
      (r.ownerId !== undefined ? await ownerAccount(ctx, r.ownerId) : null) ??
      (await ctx.db
        .query("accounts")
        .withIndex("by_stripeCustomerId", (q) => q.eq("stripeCustomerId", r.customerId))
        .first());
    if (account === null) return "no_account";
    if (!shouldApply(account, r)) return "ignored";
    await ctx.db.patch("accounts", account._id, {
      stripeCustomerId: account.stripeCustomerId ?? r.customerId,
      stripeSubscriptionId: r.subscriptionId,
      status: r.status,
      events: r.events,
      interval: r.interval,
      currentPeriodEnd: r.currentPeriodEnd,
      cancelAtPeriodEnd: r.cancelAtPeriodEnd ? true : undefined,
      cancelAt: r.cancelAt,
    });
    return "applied";
  },
});

/**
 * Pageviews across the signed-in user's sites so far in `month` ("2026-11"), from the
 * daily rollups, to start /billing's slider on the tier that fits. Days are each site's
 * own. Not gated by the lock: /billing must work for a locked account. Custom events and
 * a UTC month come with the usage meter (Phase 6).
 */
export const monthPageviews = query({
  args: { month: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    if (!/^\d{4}-\d{2}$/.test(args.month)) throw new ConvexError("Bad month");
    const ownerId = await requireOwnerId(ctx);
    const sites = await ctx.db
      .query("sites")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .take(100);
    let total = 0;
    for (const site of sites) {
      const days = await ctx.db
        .query("dailyStats")
        .withIndex("by_site_date", (q) =>
          q.eq("siteId", site._id).gte("date", `${args.month}-01`).lte("date", `${args.month}-31`),
        )
        .take(31);
      for (const day of days) total += day.pageviews;
    }
    return total;
  },
});

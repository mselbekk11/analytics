import { httpRouter } from "convex/server";
import Stripe from "stripe";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { billingSubscriptionId, subscriptionRecord } from "./lib/billing";
import { parseStripeEvent } from "./lib/stripe";
import { stripeApi } from "./lib/stripeApi";

const http = httpRouter();
const cryptoProvider = Stripe.createSubtleCryptoProvider();

/**
 * Stripe webhook, one endpoint per site: /stripe/{siteId}. The signature is checked with
 * that site's signing secret before anything is written. Events this app does not use
 * are acknowledged with 200, so Stripe does not retry them.
 */
http.route({
  pathPrefix: "/stripe/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const siteId = new URL(request.url).pathname.slice("/stripe/".length);
    const site = await ctx.runQuery(internal.payments.stripeSecret, { siteId });
    if (site === null) return new Response("Unknown site or no signing secret", { status: 404 });

    const signature = request.headers.get("stripe-signature");
    if (signature === null) return new Response("Missing Stripe-Signature", { status: 400 });
    let event: Stripe.Event;
    try {
      event = await Stripe.webhooks.constructEventAsync(
        await request.text(),
        signature,
        site.secret,
        undefined,
        cryptoProvider,
      );
    } catch {
      return new Response("Invalid signature", { status: 400 });
    }

    const record = parseStripeEvent(event);
    if (record !== null) {
      await ctx.runMutation(internal.payments.recordStripe, { siteId: site.siteId, record });
    }
    return new Response(null, { status: 200 });
  }),
});

/**
 * Platform billing webhook (launch v1 Phase 4): our customers' subscriptions to Simple
 * Stats, on the platform's own Stripe account and signing secret, apart from the per-site
 * revenue webhooks above. Each event only names a subscription: it is re-read from
 * Stripe and written whole, so replays and out-of-order events end the same. A failed
 * read answers 500, so Stripe retries.
 */
http.route({
  path: "/billing/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
    if (!secret) return new Response("Billing webhook not configured", { status: 500 });
    const signature = request.headers.get("stripe-signature");
    if (signature === null) return new Response("Missing Stripe-Signature", { status: 400 });
    let event: Stripe.Event;
    try {
      event = await Stripe.webhooks.constructEventAsync(await request.text(), signature, secret, undefined, cryptoProvider);
    } catch {
      return new Response("Invalid signature", { status: 400 });
    }

    const subscriptionId = billingSubscriptionId(event);
    if (subscriptionId === null) return new Response(null, { status: 200 });
    let subscription: Stripe.Subscription;
    try {
      subscription = await stripeApi().subscriptions.retrieve(subscriptionId);
    } catch (error) {
      console.error(`billing webhook: could not read ${subscriptionId} for ${event.id}`, error);
      return new Response("Could not read the subscription", { status: 500 });
    }
    const record = subscriptionRecord(subscription);
    if (record === null) return new Response(null, { status: 200 });
    const result = await ctx.runMutation(internal.billing.applySubscription, { record });
    if (result !== "applied") console.warn(`billing webhook: ${result} for ${subscriptionId} (${event.type}, ${event.id})`);
    return new Response(null, { status: 200 });
  }),
});

export default http;

import { httpRouter } from "convex/server";
import Stripe from "stripe";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { billingSubscriptionId, subscriptionRecord } from "./lib/billing";
import { verifyUnsubscribe, type Cadence } from "./lib/insights";
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

/**
 * One-click unsubscribe from an insight email (launch v1 Phase 15): the link in the email
 * (GET) and the List-Unsubscribe-Post one-click (POST, RFC 8058) both turn off just the
 * cadence the token was signed for, then show a small page. A tampered, malformed or
 * unknown token changes nothing.
 */
const unsubscribeHandler = httpAction(async (ctx, request) => {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const secret = process.env.INSIGHT_UNSUBSCRIBE_SECRET;
  const verified = secret ? await verifyUnsubscribe(secret, token) : null;
  const done = verified !== null && (await ctx.runMutation(internal.insights.unsubscribe, verified));
  if (!done) {
    return unsubscribePage(400, "This link isn't valid", "Nothing was changed. You can turn insight emails on or off in Settings.");
  }
  const other = (["daily", "weekly", "monthly"] as Cadence[]).filter((c) => c !== verified.cadence).join(" and ");
  return unsubscribePage(
    200,
    `Unsubscribed from ${verified.cadence} emails`,
    `You won't get ${verified.cadence} insight emails any more. Your ${other} emails are unchanged.`,
  );
});

http.route({ path: "/email/unsubscribe", method: "GET", handler: unsubscribeHandler });
http.route({ path: "/email/unsubscribe", method: "POST", handler: unsubscribeHandler });

function unsubscribePage(status: number, title: string, text: string): Response {
  const settings = `${(process.env.APP_URL ?? "https://www.simplestats.ai").replace(/\/$/, "")}/settings`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title} · Simple Stats</title><style>body{margin:0;padding:64px 16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#f5f5f5;color:#171717}main{max-width:420px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:28px}p.b{font-size:13px;font-weight:600;color:#737373;margin:0 0 8px}h1{font-size:20px;margin:0 0 8px}p{font-size:14px;line-height:20px;color:#525252;margin:0 0 16px}a{color:#2563eb}@media (prefers-color-scheme:dark){body{background:#0a0a0a;color:#fafafa}main{background:#171717;border-color:#262626}p{color:#a3a3a3}a{color:#60a5fa}}</style></head><body><main><p class="b">Simple Stats</p><h1>${title}</h1><p>${text}</p><p><a href="${settings}">Email settings</a></p></main></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export default http;

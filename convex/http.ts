import { httpRouter } from "convex/server";
import Stripe from "stripe";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { parseStripeEvent } from "./lib/stripe";

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

export default http;

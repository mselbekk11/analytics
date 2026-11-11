import Stripe from "stripe";

/**
 * The platform's own Stripe account (launch v1 Phase 4): test mode on dev, live on prod.
 * Uses fetch, so it runs in Convex's default runtime and in HTTP actions.
 */
export function stripeApi(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set on this Convex deployment");
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}

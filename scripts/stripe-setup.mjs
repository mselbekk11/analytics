// Creates (or brings up to date) the Simple Stats products, prices and customer portal
// from convex/lib/tiers.ts (launch v1 Phases 4 and 5): one product per tier ("Simple
// Stats 1M"), each with a monthly and a yearly price, and a portal configuration that
// can switch between all 10. Safe to run again: a price whose lookup key already has the
// right amount and product is left alone; otherwise a new price takes over the lookup
// key and the old one is archived (existing subscribers keep it until they change tier).
// Phase 4's single "Simple Stats" product is archived once its prices have moved.
//
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
//   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup.mjs --live
//
// Needs Node 22.18+ (it imports the TypeScript tier list directly).
import Stripe from "stripe";
import { PRODUCT_NAME, TIERS, productName, stripePrices } from "../convex/lib/tiers.ts";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY");
  process.exit(1);
}
const live = key.startsWith("sk_live_") || key.startsWith("rk_live_");
if (live && !process.argv.includes("--live")) {
  console.error("That is a live key: pass --live to create live prices");
  process.exit(1);
}
const stripe = new Stripe(key);
const APP = "simple-stats";
// "Software as a service (SaaS) - business use". Checkout needs a tax code when Stripe's
// Managed Payments is on (the default for new accounts), and Stripe Tax uses it too
const TAX_CODE = "txcd_10103001";
console.log(live ? "LIVE mode" : "test mode");

// products.search can lag a few seconds behind a create, so list instead
const products = [];
for await (const p of stripe.products.list({ limit: 100 })) if (p.metadata.app === APP) products.push(p);

/** tier slug -> product id */
const productOf = {};
for (const tier of TIERS) {
  const want = {
    name: productName(tier),
    description: `Website analytics, up to ${tier.events.toLocaleString("en-US")} events a month`,
    tax_code: TAX_CODE,
    metadata: { app: APP, tier: tier.slug },
  };
  let product = products.find((p) => p.metadata.tier === tier.slug);
  if (product === undefined) {
    product = await stripe.products.create(want);
    console.log(`  created product ${product.id} (${product.name})`);
  } else {
    const taxCode = typeof product.tax_code === "string" ? product.tax_code : product.tax_code?.id;
    if (!product.active || product.name !== want.name || product.description !== want.description || taxCode !== TAX_CODE) {
      product = await stripe.products.update(product.id, { ...want, active: true });
      console.log(`  updated product ${product.id} (${product.name})`);
    } else {
      console.log(`  ok      product ${product.id} (${product.name})`);
    }
  }
  productOf[tier.slug] = product.id;
}

const wanted = stripePrices();
const found = await stripe.prices.list({ lookup_keys: wanted.map((p) => p.lookupKey), limit: 100 });
/** lookup key -> the active price id */
const priceOf = {};
for (const want of wanted) {
  const have = found.data.find((p) => p.lookup_key === want.lookupKey);
  const same =
    have !== undefined &&
    have.active &&
    have.product === productOf[want.slug] &&
    have.unit_amount === want.unitAmount &&
    have.currency === "usd" &&
    have.recurring?.interval === want.interval &&
    have.metadata.events === String(want.events);
  if (same) {
    console.log(`  ok      ${want.lookupKey}  ${have.id}`);
    priceOf[want.lookupKey] = have.id;
    continue;
  }
  const price = await stripe.prices.create({
    product: productOf[want.slug],
    currency: "usd",
    unit_amount: want.unitAmount,
    recurring: { interval: want.interval },
    lookup_key: want.lookupKey,
    transfer_lookup_key: have !== undefined,
    nickname: want.nickname,
    metadata: { events: String(want.events) },
  });
  if (have?.active) await stripe.prices.update(have.id, { active: false });
  priceOf[want.lookupKey] = price.id;
  console.log(`  ${have ? "moved" : "created"} ${want.lookupKey}  ${price.id}  $${want.unitAmount / 100}/${want.interval}`);
}

// Phase 4's single product: archive what's left on it, then the product (subscriptions
// on its prices carry on; the portal moves them to a tier product on their next change)
for (const old of products.filter((p) => p.metadata.tier === undefined && p.active)) {
  for await (const price of stripe.prices.list({ product: old.id, active: true, limit: 100 })) {
    await stripe.prices.update(price.id, { active: false });
  }
  await stripe.products.update(old.id, { active: false });
  console.log(`  archived the old single product ${old.id} (${old.name})`);
}

// The customer portal (Phase 5): switch between all 10 prices, update the card and
// billing details, see invoices, and cancel at the end of the period. billing.portal
// finds this configuration by metadata.app, so it needn't be the account's default.
const portal = {
  business_profile: {
    headline: `${PRODUCT_NAME}: manage your subscription`,
    privacy_policy_url: "https://www.simplestats.ai/privacy",
  },
  features: {
    customer_update: { enabled: true, allowed_updates: ["email", "name", "address", "tax_id"] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: {
      enabled: true,
      mode: "at_period_end",
      proration_behavior: "none",
      cancellation_reason: {
        enabled: true,
        options: ["too_expensive", "missing_features", "switched_service", "unused", "other"],
      },
    },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ["price"],
      // Upgrades are charged at once; downgrades leave a credit for the next invoice
      proration_behavior: "always_invoice",
      products: TIERS.map((tier) => ({
        product: productOf[tier.slug],
        prices: wanted.filter((w) => w.slug === tier.slug).map((w) => priceOf[w.lookupKey]),
      })),
    },
  },
  metadata: { app: APP },
};
const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
const mine = configs.data.find((c) => c.metadata?.app === APP);
const config = mine
  ? await stripe.billingPortal.configurations.update(mine.id, portal)
  : await stripe.billingPortal.configurations.create(portal);
console.log(`  portal  ${mine ? "updated" : "created"} ${config.id}`);

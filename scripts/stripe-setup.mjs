// Creates (or brings up to date) the "Simple Stats" product and its 10 prices, one per
// event tier and interval, from convex/lib/tiers.ts (launch v1 Phase 4). Safe to run
// again: a price whose lookup key already has the right amount is left alone; a changed
// amount gets a new price that takes over the lookup key (existing subscribers keep the
// old one until they change tier).
//
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
//   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup.mjs --live
//
// Needs Node 22.18+ (it imports the TypeScript tier list directly).
import Stripe from "stripe";
import { PRODUCT_NAME, stripePrices } from "../convex/lib/tiers.ts";

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

// products.search can lag a few seconds behind a create, so list instead
const products = await stripe.products.list({ limit: 100 });
let product =
  products.data.find((p) => p.metadata.app === APP) ??
  (await stripe.products.create({
    name: PRODUCT_NAME,
    description: "Website analytics, priced by monthly events",
    metadata: { app: APP },
    tax_code: TAX_CODE,
  }));
const taxCode = typeof product.tax_code === "string" ? product.tax_code : product.tax_code?.id;
if (taxCode !== TAX_CODE) product = await stripe.products.update(product.id, { tax_code: TAX_CODE });
console.log(`${live ? "LIVE" : "test"} product ${product.id} (${product.name})`);

const wanted = stripePrices();
const found = await stripe.prices.list({ lookup_keys: wanted.map((p) => p.lookupKey), limit: 100 });
for (const want of wanted) {
  const have = found.data.find((p) => p.lookup_key === want.lookupKey);
  const same =
    have !== undefined &&
    have.active &&
    have.product === product.id &&
    have.unit_amount === want.unitAmount &&
    have.currency === "usd" &&
    have.recurring?.interval === want.interval &&
    have.metadata.events === String(want.events);
  if (same) {
    console.log(`  ok      ${want.lookupKey}  ${have.id}`);
    continue;
  }
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: want.unitAmount,
    recurring: { interval: want.interval },
    lookup_key: want.lookupKey,
    transfer_lookup_key: have !== undefined,
    nickname: want.nickname,
    metadata: { events: String(want.events) },
  });
  console.log(`  ${have ? "moved" : "created"} ${want.lookupKey}  ${price.id}  $${want.unitAmount / 100}/${want.interval}`);
}

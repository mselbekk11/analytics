/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test-secret";
const WHSEC = "whsec_test_0123456789abcdef";
const OWNER = { subject: "user_1", tokenIdentifier: "clerk|user_1" };
const STRANGER = { subject: "user_2", tokenIdentifier: "clerk|user_2" };
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const VID = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f70";
const SID1 = "1b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f71";
const SID2 = "2b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f72";
const RANGE = { domain: "picai.so", from: "2026-10-01", to: "2026-10-13" };

type T = ReturnType<typeof convexTest>;

async function setup(revenueSource: "stripe" | "api" | "none" = "stripe") {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity(OWNER);
  const { siteId } = await owner.mutation(api.sites.create, { domain: "picai.so", timezone: "America/Los_Angeles" });
  await owner.mutation(api.sites.setRevenue, { domain: "picai.so", revenueSource, currency: "USD" });
  await owner.mutation(api.sites.setStripeSecret, { domain: "picai.so", secret: WHSEC });
  return { t, owner, siteId };
}

/** A pageview with visitor and session ids, through the real ingest mutation. */
async function visit(
  t: T,
  o: { sid: string; pvId: string; vid?: string; referrer?: string; utmSource?: string; country?: string },
) {
  await t.mutation(api.ingest.pageview, {
    secret: SECRET,
    site: "picai.so",
    hostname: "picai.so",
    path: "/",
    referrer: o.referrer ?? "(direct)",
    unique: true,
    device: "desktop",
    browser: "Chrome",
    country: o.country ?? "US",
    region: "CA",
    city: "San Francisco",
    pvId: o.pvId,
    visitorId: o.vid ?? VID,
    sessionId: o.sid,
    ...(o.utmSource ? { campaign: { utmSource: o.utmSource } } : {}),
  });
}

/** Posts a Stripe event, signed with the site's secret unless `secret` says otherwise. */
async function stripe(t: T, siteId: Id<"sites">, type: string, object: Record<string, unknown>, secret = WHSEC) {
  const payload = JSON.stringify({
    id: `evt_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type,
    created: Math.floor(Date.now() / 1000),
    data: { object },
  });
  const header = await Stripe.webhooks.generateTestHeaderStringAsync({ payload, secret, cryptoProvider });
  return await t.fetch(`/stripe/${siteId}`, {
    method: "POST",
    headers: { "stripe-signature": header, "content-type": "application/json" },
    body: payload,
  });
}

const checkout = (o: Record<string, unknown> = {}) => ({
  id: "cs_test_1",
  mode: "payment",
  payment_status: "paid",
  amount_total: 4900,
  currency: "usd",
  customer: "cus_1",
  customer_details: { email: "jo@example.com" },
  metadata: { va_vid: VID, va_sid: SID2 },
  payment_intent: "pi_1",
  ...o,
});

async function tables(t: T) {
  return t.run(async (ctx) => ({
    payments: await ctx.db.query("payments").collect(),
    dailyStats: await ctx.db.query("dailyStats").collect(),
    revenueDims: (await ctx.db.query("dailyDims").collect())
      .filter((d) => d.revenueMinor !== undefined)
      .map((d) => [d.dim, d.key, d.revenueMinor])
      .sort(),
    visitors: await ctx.db.query("visitors").collect(),
    sessions: await ctx.db.query("sessions").collect(),
  }));
}

beforeEach(() => {
  vi.stubEnv("INGEST_SECRET", SECRET);
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  vi.useFakeTimers();
  // 2026-10-13 10:00 in Los Angeles
  vi.setSystemTime(new Date("2026-10-13T17:00:00Z"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Stripe webhook", () => {
  test("Done when: a payment from a visit tagged utm_source=test shows under that source, matched by metadata", async () => {
    const { t, owner, siteId } = await setup();
    await visit(t, { sid: SID1, pvId: "pv-1", utmSource: "test" });
    vi.advanceTimersByTime(60_000);

    const res = await stripe(t, siteId, "checkout.session.completed", checkout());
    expect(res.status).toBe(200);

    const { payments, dailyStats, revenueDims, visitors, sessions } = await tables(t);
    expect(payments).toEqual([
      expect.objectContaining({
        provider: "stripe",
        providerId: "cs_test_1",
        kind: "payment",
        amountMinor: 4900,
        currency: "USD",
        date: "2026-10-13",
        visitorId: VID,
        sessionId: SID1,
        matchedBy: "metadata",
      }),
    ]);
    expect(dailyStats[0]).toMatchObject({ revenueMinor: 4900, payments: 1 });
    expect(revenueDims).toEqual([
      ["channel", "Referral", 4900],
      ["city", "US/CA/San Francisco", 4900],
      ["country", "US", 4900],
      ["referrer", "(direct)", 4900],
      ["region", "US/CA", 4900],
      ["source", "test", 4900],
      ["utm_source", "test", 4900],
    ]);
    expect(visitors[0]).toMatchObject({ revenueMinor: 4900, firstPaidAt: Date.now(), email: "jo@example.com" });
    expect(sessions[0]).toMatchObject({ revenueMinor: 4900 });

    const sources = await owner.query(api.stats.breakdown, { ...RANGE, dim: "source" });
    expect(sources.rows).toEqual([expect.objectContaining({ key: "test", visitors: 1, revenueMinor: 4900 })]);
    const summary = await owner.query(api.stats.summary, RANGE);
    expect(summary.current).toMatchObject({ revenueMinor: 4900, payments: 1, refundsMinor: 0 });
    const series = await owner.query(api.stats.timeseries, RANGE);
    expect(series.at(-1)).toMatchObject({ date: "2026-10-13", revenueMinor: 4900 });
    expect(await owner.query(api.stats.conversions, RANGE)).toEqual({
      kind: "revenue",
      current: 1,
      previous: 0,
      otherCurrencyPayments: 0,
    });
  });

  test("rejects a bad signature, an unknown site and a site without a secret, writing nothing", async () => {
    const { t, siteId } = await setup();
    expect((await stripe(t, siteId, "checkout.session.completed", checkout(), "whsec_wrong_0123456789")).status).toBe(400);
    const missing = await t.fetch(`/stripe/${siteId}`, { method: "POST", body: "{}" });
    expect(missing.status).toBe(400);
    expect((await t.fetch("/stripe/not-an-id", { method: "POST", body: "{}" })).status).toBe(404);

    const other = await t.withIdentity(OWNER).mutation(api.sites.create, { domain: "other.com", timezone: "UTC" });
    expect((await stripe(t, other.siteId, "checkout.session.completed", checkout())).status).toBe(404);
    expect((await tables(t)).payments).toEqual([]);
  });

  test("a retried event counts once", async () => {
    const { t, siteId } = await setup();
    await stripe(t, siteId, "checkout.session.completed", checkout());
    await stripe(t, siteId, "checkout.session.completed", checkout());
    await stripe(t, siteId, "checkout.session.async_payment_succeeded", checkout());
    const { payments, dailyStats } = await tables(t);
    expect(payments).toHaveLength(1);
    expect(dailyStats[0]).toMatchObject({ revenueMinor: 4900, payments: 1 });
  });

  test("credits the last session that did not come in Direct", async () => {
    const { t, siteId } = await setup();
    await visit(t, { sid: SID1, pvId: "pv-1", referrer: "google.com" });
    vi.advanceTimersByTime(60 * 60_000);
    await visit(t, { sid: SID2, pvId: "pv-2" }); // typed in: Direct
    await stripe(t, siteId, "checkout.session.completed", checkout());
    const { payments, revenueDims } = await tables(t);
    expect(payments[0]).toMatchObject({ sessionId: SID1 });
    expect(revenueDims).toContainEqual(["source", "Google", 4900]);
  });

  test("with no match the payment counts under Unattributed", async () => {
    const { t, owner, siteId } = await setup();
    await stripe(t, siteId, "checkout.session.completed", checkout({ metadata: {}, customer: null }));
    const { payments, dailyStats, revenueDims } = await tables(t);
    expect(payments[0].visitorId).toBeUndefined();
    expect(payments[0].matchedBy).toBeUndefined();
    expect(dailyStats[0]).toMatchObject({ revenueMinor: 4900 });
    expect(revenueDims).toEqual([
      ["channel", "Unattributed", 4900],
      ["source", "Unattributed", 4900],
    ]);
    const sources = await owner.query(api.stats.breakdown, { ...RANGE, dim: "source" });
    expect(sources.rows).toEqual([expect.objectContaining({ key: "Unattributed", visitors: 0, revenueMinor: 4900 })]);
  });

  test("return page: a claim before the webhook links the payment", async () => {
    const { t, siteId } = await setup();
    await visit(t, { sid: SID1, pvId: "pv-1", utmSource: "test" });
    await t.mutation(api.ingest.event, {
      secret: SECRET,
      site: "picai.so",
      hostname: "picai.so",
      pvId: "pv-1",
      event: { type: "claim", checkoutSessionId: "cs_test_1" },
    });
    await stripe(t, siteId, "checkout.session.completed", checkout({ metadata: {} }));
    expect((await tables(t)).payments[0]).toMatchObject({ visitorId: VID, sessionId: SID1, matchedBy: "return_page" });
  });

  test("return page: a claim after the webhook moves the revenue from Unattributed", async () => {
    const { t, siteId } = await setup();
    await visit(t, { sid: SID1, pvId: "pv-1", utmSource: "test" });
    await stripe(t, siteId, "checkout.session.completed", checkout({ metadata: {}, customer: null }));
    await t.mutation(api.ingest.event, {
      secret: SECRET,
      site: "picai.so",
      hostname: "picai.so",
      pvId: "pv-1",
      event: { type: "claim", checkoutSessionId: "cs_test_1" },
    });
    const { payments, revenueDims, visitors } = await tables(t);
    expect(payments[0]).toMatchObject({ visitorId: VID, sessionId: SID1, matchedBy: "return_page" });
    expect(revenueDims).toContainEqual(["source", "Unattributed", 0]);
    expect(revenueDims).toContainEqual(["source", "test", 4900]);
    expect(visitors[0]).toMatchObject({ revenueMinor: 4900 });
  });

  test("subscription: the invoice uses its Checkout's metadata, whichever event comes first", async () => {
    for (const order of ["checkout first", "invoice first"]) {
      const { t, siteId } = await setup();
      await visit(t, { sid: SID1, pvId: "pv-1", utmSource: "test" });
      const sendCheckout = () =>
        stripe(t, siteId, "checkout.session.completed", checkout({ id: "cs_sub", mode: "subscription", subscription: "sub_1" }));
      const sendInvoice = () =>
        stripe(t, siteId, "invoice.paid", {
          id: "in_1",
          amount_paid: 1500,
          currency: "usd",
          customer: "cus_1",
          billing_reason: "subscription_create",
          parent: { subscription_details: { subscription: "sub_1", metadata: {} } },
        });
      if (order === "checkout first") {
        await sendCheckout();
        await sendInvoice();
      } else {
        await sendInvoice();
        await sendCheckout();
      }
      const { payments, dailyStats, revenueDims } = await tables(t);
      expect(payments, order).toEqual([
        expect.objectContaining({
          providerId: "in_1",
          amountMinor: 1500,
          checkoutSessionId: "cs_sub",
          visitorId: VID,
          matchedBy: "metadata",
        }),
      ]);
      expect(dailyStats[0], order).toMatchObject({ revenueMinor: 1500, payments: 1 });
      expect(revenueDims, order).toContainEqual(["source", "test", 1500]);
    }
  });

  test("a renewal is linked through the customer's earlier payment", async () => {
    const { t, siteId } = await setup();
    await visit(t, { sid: SID1, pvId: "pv-1", utmSource: "test" });
    await stripe(t, siteId, "checkout.session.completed", checkout());
    vi.advanceTimersByTime(24 * 60 * 60_000);
    await stripe(t, siteId, "invoice.paid", {
      id: "in_2",
      amount_paid: 1500,
      currency: "usd",
      customer: "cus_1",
      billing_reason: "subscription_cycle",
      subscription: "sub_9",
    });
    const renewal = (await tables(t)).payments.find((p) => p.providerId === "in_2");
    expect(renewal).toMatchObject({ renewal: true, visitorId: VID, matchedBy: "customer", date: "2026-10-14" });
  });

  test("an identify() email links a payment with nothing else", async () => {
    const { t, siteId } = await setup();
    await visit(t, { sid: SID1, pvId: "pv-1" });
    await t.mutation(api.ingest.event, {
      secret: SECRET,
      site: "picai.so",
      hostname: "picai.so",
      pvId: "pv-1",
      event: { type: "identify", email: "jo@example.com" },
    });
    await stripe(t, siteId, "checkout.session.completed", checkout({ metadata: {}, customer: null }));
    expect((await tables(t)).payments[0]).toMatchObject({ visitorId: VID, matchedBy: "email" });
  });

  test("partial refunds are each the difference from the last, on the payment's session", async () => {
    const { t, owner, siteId } = await setup();
    await visit(t, { sid: SID1, pvId: "pv-1", utmSource: "test" });
    await stripe(t, siteId, "checkout.session.completed", checkout());
    const charge = { id: "ch_1", currency: "usd", payment_intent: "pi_1", customer: "cus_1" };
    await stripe(t, siteId, "charge.refunded", { ...charge, amount_refunded: 1000 });
    await stripe(t, siteId, "charge.refunded", { ...charge, amount_refunded: 1000 }); // retry
    await stripe(t, siteId, "charge.refunded", { ...charge, amount_refunded: 2500 });

    const { payments, dailyStats, revenueDims, visitors } = await tables(t);
    expect(payments.filter((p) => p.kind === "refund").map((p) => [p.providerId, p.amountMinor, p.matchedBy])).toEqual([
      ["ch_1#1000", -1000, "metadata"],
      ["ch_1#2500", -1500, "metadata"],
    ]);
    expect(dailyStats[0]).toMatchObject({ revenueMinor: 2400, payments: 1, refundsMinor: 2500 });
    expect(revenueDims).toContainEqual(["source", "test", 2400]);
    expect(visitors[0]).toMatchObject({ revenueMinor: 2400 });
    const summary = await owner.query(api.stats.summary, RANGE);
    expect(summary.current).toMatchObject({ revenueMinor: 2400, payments: 1, refundsMinor: 2500 });
  });

  test("a payment in another currency is stored but left out of the totals", async () => {
    const { t, owner, siteId } = await setup();
    await visit(t, { sid: SID1, pvId: "pv-1" });
    await stripe(t, siteId, "checkout.session.completed", checkout({ currency: "eur" }));
    const { payments, dailyStats, revenueDims, visitors } = await tables(t);
    expect(payments[0]).toMatchObject({ currency: "EUR", visitorId: VID, matchedBy: "metadata" });
    expect(dailyStats[0].revenueMinor).toBeUndefined();
    expect(revenueDims).toEqual([]);
    expect(visitors[0].revenueMinor).toBe(0);
    expect(await owner.query(api.stats.conversions, RANGE)).toMatchObject({ current: 0, otherCurrencyPayments: 1 });
  });
});

describe("payments API", () => {
  async function withKey() {
    const ctx = await setup("api");
    const key = await ctx.owner.action(api.sites.createApiKey, { domain: "picai.so" });
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
    const keyHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return { ...ctx, key, keyHash };
  }

  test("records a payment for the key's site, once per id, and a refund", async () => {
    const { t, key, keyHash } = await withKey();
    expect(key).toMatch(/^va_[0-9a-f]{48}$/);
    await visit(t, { sid: SID1, pvId: "pv-1", utmSource: "test" });
    const payment = { id: "order_1", amountMinor: 4900, currency: "USD", visitorId: VID };

    const call = (p: typeof payment & { refund?: boolean }, hash = keyHash) =>
      t.mutation(api.payments.recordApi, { secret: SECRET, keyHash: hash, payment: p });
    expect(await call(payment)).toEqual({ status: "recorded", matchedBy: "metadata" });
    expect(await call(payment)).toEqual({ status: "duplicate", matchedBy: "metadata" });
    expect(await call({ ...payment, id: "refund_1", amountMinor: 900, refund: true })).toEqual({
      status: "recorded",
      matchedBy: "metadata",
    });
    expect(await call(payment, "0".repeat(64))).toEqual({ status: "unauthorized" });

    const { payments, dailyStats, revenueDims } = await tables(t);
    expect(payments.map((p) => [p.provider, p.providerId, p.kind, p.amountMinor])).toEqual([
      ["api", "order_1", "payment", 4900],
      ["api", "refund_1", "refund", -900],
    ]);
    expect(dailyStats[0]).toMatchObject({ revenueMinor: 4000, payments: 1, refundsMinor: 900 });
    expect(revenueDims).toContainEqual(["source", "test", 4000]);
  });

  test("a session id alone finds its visitor; a new key replaces the old one", async () => {
    const { t, owner, keyHash } = await withKey();
    await visit(t, { sid: SID1, pvId: "pv-1" });
    const result = await t.mutation(api.payments.recordApi, {
      secret: SECRET,
      keyHash,
      payment: { id: "o", amountMinor: 100, currency: "USD", sessionId: SID1 },
    });
    expect(result).toEqual({ status: "recorded", matchedBy: "metadata" });

    await owner.action(api.sites.createApiKey, { domain: "picai.so" });
    const old = await t.mutation(api.payments.recordApi, {
      secret: SECRET,
      keyHash,
      payment: { id: "o2", amountMinor: 100, currency: "USD" },
    });
    expect(old).toEqual({ status: "unauthorized" });
  });

  test("needs the ingest secret", async () => {
    const { t, keyHash } = await withKey();
    await expect(
      t.mutation(api.payments.recordApi, {
        secret: "wrong",
        keyHash,
        payment: { id: "o", amountMinor: 100, currency: "USD" },
      }),
    ).rejects.toThrow("Invalid ingest secret");
  });
});

describe("revenue settings", () => {
  test("never return the secrets, only whether they are set", async () => {
    const { owner, siteId } = await setup();
    const settings = await owner.query(api.sites.revenueSettings, { domain: "picai.so" });
    expect(settings).toEqual({
      revenueSource: "stripe",
      currency: "USD",
      webhookUrl: `https://test.convex.site/stripe/${siteId}`,
      webhookEvents: [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "invoice.paid",
        "charge.refunded",
      ],
      hasWebhookSecret: true,
      hasApiKey: false,
    });
    expect(JSON.stringify(settings)).not.toContain("whsec_");
  });

  test("validate the currency and the signing secret", async () => {
    const { owner } = await setup();
    await expect(
      owner.mutation(api.sites.setRevenue, { domain: "picai.so", revenueSource: "stripe", currency: "dollars" }),
    ).rejects.toThrow("three-letter");
    await expect(owner.mutation(api.sites.setStripeSecret, { domain: "picai.so", secret: "sk_live_123" })).rejects.toThrow(
      "whsec_",
    );
    await owner.mutation(api.sites.setRevenue, { domain: "picai.so", revenueSource: "none", currency: "eur" });
    expect(await owner.query(api.sites.get, { domain: "picai.so" })).toMatchObject({ revenueSource: "none", currency: "EUR" });
  });

  test("belong to the owner only", async () => {
    const { t } = await setup();
    const stranger = t.withIdentity(STRANGER);
    await expect(stranger.query(api.sites.revenueSettings, { domain: "picai.so" })).rejects.toThrow("Site not found");
    await expect(
      stranger.mutation(api.sites.setStripeSecret, { domain: "picai.so", secret: "whsec_evil_0123456789abcdef" }),
    ).rejects.toThrow("Site not found");
    await expect(stranger.action(api.sites.createApiKey, { domain: "picai.so" })).rejects.toThrow("Site not found");
  });
});

describe("conversions", () => {
  test("a site without revenue converts on its key goal", async () => {
    const { t, owner } = await setup("none");
    await visit(t, { sid: SID1, pvId: "pv-1" });
    await owner.mutation(api.sites.setKeyGoal, { domain: "picai.so", keyGoal: "signup" });
    expect(await owner.query(api.stats.conversions, RANGE)).toMatchObject({ kind: "goal", current: 0 });
    await t.mutation(api.ingest.event, {
      secret: SECRET,
      site: "picai.so",
      hostname: "picai.so",
      pvId: "pv-1",
      event: { type: "goal", name: "signup" },
    });
    expect(await owner.query(api.stats.conversions, RANGE)).toEqual({
      kind: "goal",
      current: 1,
      previous: 0,
      otherCurrencyPayments: 0,
    });
    await owner.mutation(api.sites.setKeyGoal, { domain: "picai.so", keyGoal: null });
    expect(await owner.query(api.stats.conversions, RANGE)).toMatchObject({ kind: null, current: null });
  });
});

test("deleting a site deletes its payments, checkouts and secrets", async () => {
  const { t, owner, siteId } = await setup();
  await stripe(t, siteId, "checkout.session.completed", checkout());
  await stripe(t, siteId, "checkout.session.completed", checkout({ id: "cs_sub", mode: "subscription", subscription: "sub_1" }));
  await owner.mutation(api.sites.remove, { domain: "picai.so" });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const left = await t.run(async (ctx) => ({
    payments: await ctx.db.query("payments").collect(),
    checkouts: await ctx.db.query("checkouts").collect(),
    secrets: await ctx.db.query("siteSecrets").collect(),
  }));
  expect(left).toEqual({ payments: [], checkouts: [], secrets: [] });
  // The internal secret lookup now finds nothing either
  expect(await t.query(internal.payments.stripeSecret, { siteId })).toBeNull();
});

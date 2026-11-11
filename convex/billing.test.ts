/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { billingSubscriptionId, shouldApply, subscriptionRecord } from "./lib/billing";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const OWNER = { subject: "user_1", tokenIdentifier: "clerk|user_1", email: "jo@example.com" };
const STRANGER = { subject: "user_2", tokenIdentifier: "clerk|user_2" };
const WHSEC = "whsec_billing_test";
const NOW = Date.parse("2026-11-10T20:00:00Z");
const PERIOD_END = Math.floor(Date.parse("2026-12-10T20:00:00Z") / 1000);
const cryptoProvider = Stripe.createSubtleCryptoProvider();

type T = ReturnType<typeof convexTest>;

/** A subscription as Stripe's API returns it (API 2026-09-30: the period end is on the item). */
const sub = (o: Record<string, unknown> = {}, price: Record<string, unknown> = {}) => ({
  id: "sub_1",
  object: "subscription",
  customer: "cus_1",
  status: "active",
  cancel_at_period_end: false,
  cancel_at: null,
  metadata: { ownerId: OWNER.tokenIdentifier },
  items: {
    object: "list",
    data: [
      {
        id: "si_1",
        current_period_end: PERIOD_END,
        price: { id: "price_1m_month", recurring: { interval: "month" }, metadata: { events: "1000000" }, ...price },
      },
    ],
  },
  ...o,
});

/** Stripe's API, faked at fetch: GET /v1/subscriptions/:id answers from `subs`. */
function fakeStripe(subs: Record<string, unknown>, extra?: (url: URL, body: URLSearchParams) => unknown) {
  const calls: { method: string; url: URL; body: URLSearchParams }[] = [];
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const body = new URLSearchParams(typeof init?.body === "string" ? init.body : "");
    calls.push({ method: init?.method ?? "GET", url, body });
    const found = url.pathname.startsWith("/v1/subscriptions/")
      ? subs[url.pathname.slice("/v1/subscriptions/".length)]
      : extra?.(url, body);
    if (found === undefined) {
      return Response.json({ error: { type: "invalid_request_error", message: "No such object" } }, { status: 404 });
    }
    return Response.json(found, { headers: { "request-id": "req_test" } });
  });
  return calls;
}

async function post(t: T, type: string, object: Record<string, unknown>, secret = WHSEC) {
  const payload = JSON.stringify({
    id: `evt_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type,
    created: Math.floor(Date.now() / 1000),
    data: { object },
  });
  const header = await Stripe.webhooks.generateTestHeaderStringAsync({ payload, secret, cryptoProvider });
  return await t.fetch("/billing/stripe", {
    method: "POST",
    headers: { "stripe-signature": header, "content-type": "application/json" },
    body: payload,
  });
}

const completed = (o: Record<string, unknown> = {}) => ({
  id: "cs_test_1",
  object: "checkout.session",
  mode: "subscription",
  customer: "cus_1",
  subscription: "sub_1",
  metadata: { ownerId: OWNER.tokenIdentifier },
  ...o,
});

async function account(t: T, ownerId = OWNER.tokenIdentifier): Promise<Doc<"accounts">> {
  const rows: Doc<"accounts">[] = await t.run(async (ctx) => ctx.db.query("accounts").collect());
  return rows.find((r) => r.ownerId === ownerId)!;
}

/** The owner with an account whose trial has ended (locked). */
async function lockedOwner() {
  const t = convexTest(schema, modules);
  await t.withIdentity(OWNER).mutation(api.accounts.ensure, {});
  await t.mutation(internal.accounts.setTrialEnd, { ownerId: OWNER.tokenIdentifier, trialEndsAt: NOW - 1 });
  return t;
}

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
  vi.stubEnv("STRIPE_BILLING_WEBHOOK_SECRET", WHSEC);
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("reading billing events", () => {
  test("a subscription Checkout and the subscription events name the subscription", () => {
    expect(billingSubscriptionId({ type: "checkout.session.completed", data: { object: completed() } })).toBe("sub_1");
    expect(
      billingSubscriptionId({
        type: "checkout.session.completed",
        data: { object: completed({ subscription: { id: "sub_9" } }) },
      }),
    ).toBe("sub_9");
    for (const type of ["created", "updated", "deleted"]) {
      expect(billingSubscriptionId({ type: `customer.subscription.${type}`, data: { object: sub() } })).toBe("sub_1");
    }
  });

  test("one-off Checkouts and other events are ignored", () => {
    expect(
      billingSubscriptionId({ type: "checkout.session.completed", data: { object: completed({ mode: "payment" }) } }),
    ).toBeNull();
    expect(billingSubscriptionId({ type: "invoice.paid", data: { object: { id: "in_1" } } })).toBeNull();
  });

  test("a subscription becomes the tier, interval, status and period end", () => {
    expect(subscriptionRecord(sub())).toEqual({
      subscriptionId: "sub_1",
      customerId: "cus_1",
      ownerId: OWNER.tokenIdentifier,
      status: "active",
      events: 1_000_000,
      interval: "month",
      currentPeriodEnd: PERIOD_END * 1000,
      cancelAtPeriodEnd: false,
    });
  });

  test("reads the older shape (period end on the subscription) and cancel_at", () => {
    const old = sub({ current_period_end: 1_800_000_000, cancel_at: 1_800_000_000, customer: { id: "cus_2" } });
    (old.items.data[0] as Record<string, unknown>).current_period_end = undefined;
    const r = subscriptionRecord(old)!;
    expect(r.currentPeriodEnd).toBe(1_800_000_000_000);
    expect(r.cancelAtPeriodEnd).toBe(true);
    expect(r.customerId).toBe("cus_2");
  });

  test("a price without metadata.events leaves the tier unset; junk isn't a subscription", () => {
    expect(subscriptionRecord(sub({}, { metadata: {} }))!.events).toBeUndefined();
    expect(subscriptionRecord({ id: "sub_1" })).toBeNull();
    expect(subscriptionRecord(null)).toBeNull();
  });

  test("a dead subscription never replaces a live one", () => {
    const live = { stripeSubscriptionId: "sub_new", status: "active" };
    expect(shouldApply(live, { subscriptionId: "sub_old", status: "canceled" })).toBe(false);
    expect(shouldApply(live, { subscriptionId: "sub_new", status: "canceled" })).toBe(true);
    expect(shouldApply(live, { subscriptionId: "sub_other", status: "active" })).toBe(true);
    expect(shouldApply({ stripeSubscriptionId: "sub_a", status: "canceled" }, { subscriptionId: "sub_b", status: "incomplete" })).toBe(true);
    expect(shouldApply({}, { subscriptionId: "sub_a", status: "incomplete" })).toBe(true);
  });
});

describe("the billing webhook", () => {
  test("a completed Checkout unlocks a locked account with the tier from the price", async () => {
    const t = await lockedOwner();
    expect((await t.withIdentity(OWNER).query(api.accounts.me, {}))!.access).toBe("locked");
    fakeStripe({ sub_1: sub() });

    const res = await post(t, "checkout.session.completed", completed());

    expect(res.status).toBe(200);
    const a = await account(t);
    expect(a).toMatchObject({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "active",
      events: 1_000_000,
      interval: "month",
      currentPeriodEnd: PERIOD_END * 1000,
    });
    expect(a.cancelAtPeriodEnd).toBeUndefined();
    expect(await t.withIdentity(OWNER).query(api.accounts.me, {})).toMatchObject({
      access: "active",
      events: 1_000_000,
      interval: "month",
    });
  });

  test("a trialing account that subscribes early is active (the pill goes away)", async () => {
    const t = convexTest(schema, modules);
    await t.withIdentity(OWNER).mutation(api.accounts.ensure, {});
    expect((await t.withIdentity(OWNER).query(api.accounts.me, {}))!.access).toBe("trialing");
    // Checkout carried the trial over, so Stripe reports its own trialing status
    fakeStripe({ sub_1: sub({ status: "trialing" }, { recurring: { interval: "year" }, metadata: { events: "2500000" } }) });

    await post(t, "customer.subscription.created", sub());

    expect(await t.withIdentity(OWNER).query(api.accounts.me, {})).toMatchObject({
      access: "active",
      events: 2_500_000,
      interval: "year",
    });
  });

  test("refuses a bad or missing signature and writes nothing", async () => {
    const t = await lockedOwner();
    const calls = fakeStripe({ sub_1: sub() });

    expect((await post(t, "checkout.session.completed", completed(), "whsec_wrong")).status).toBe(400);
    const unsigned = await t.fetch("/billing/stripe", { method: "POST", body: "{}" });
    expect(unsigned.status).toBe(400);

    expect(calls).toHaveLength(0);
    expect((await account(t)).status).toBeUndefined();
  });

  test("answers 500 without a signing secret, so Stripe retries once it's set", async () => {
    const t = await lockedOwner();
    vi.stubEnv("STRIPE_BILLING_WEBHOOK_SECRET", "");
    expect((await post(t, "checkout.session.completed", completed())).status).toBe(500);
  });

  test("a replayed event leaves the account the same", async () => {
    const t = await lockedOwner();
    fakeStripe({ sub_1: sub() });
    await post(t, "checkout.session.completed", completed());
    const first = await account(t);
    await post(t, "checkout.session.completed", completed());
    await post(t, "customer.subscription.created", sub());
    expect(await account(t)).toEqual(first);
  });

  test("an old event arriving late can't undo a cancellation: the subscription is re-read", async () => {
    const t = await lockedOwner();
    fakeStripe({ sub_1: sub({ status: "canceled" }) });
    await post(t, "customer.subscription.deleted", sub({ status: "canceled" }));
    // Then the earlier "created" event, whose payload still says active
    await post(t, "customer.subscription.created", sub({ status: "active" }));
    expect((await account(t)).status).toBe("canceled");
    expect((await t.withIdentity(OWNER).query(api.accounts.me, {}))!.access).toBe("locked");
  });

  test("an older subscription ending doesn't lock an account with a newer live one", async () => {
    const t = await lockedOwner();
    fakeStripe({ sub_1: sub(), sub_old: sub({ id: "sub_old", status: "canceled" }) });
    await post(t, "checkout.session.completed", completed());
    await post(t, "customer.subscription.deleted", sub({ id: "sub_old" }));
    expect(await account(t)).toMatchObject({ stripeSubscriptionId: "sub_1", status: "active" });
  });

  test("finds the account by Stripe customer when metadata has no owner", async () => {
    const t = await lockedOwner();
    await t.mutation(internal.billing.setCustomer, { ownerId: OWNER.tokenIdentifier, customerId: "cus_1" });
    fakeStripe({ sub_1: sub({ metadata: {} }) });
    await post(t, "customer.subscription.updated", sub());
    expect((await account(t)).status).toBe("active");
  });

  test("a subscription for no known account is acknowledged and writes nothing", async () => {
    const t = await lockedOwner();
    fakeStripe({ sub_9: sub({ id: "sub_9", customer: "cus_9", metadata: {} }) });
    expect((await post(t, "customer.subscription.created", sub({ id: "sub_9" }))).status).toBe(200);
    expect((await account(t)).status).toBeUndefined();
  });

  test("a one-off payment Checkout is acknowledged without asking Stripe", async () => {
    const t = await lockedOwner();
    const calls = fakeStripe({});
    expect((await post(t, "checkout.session.completed", completed({ mode: "payment" }))).status).toBe(200);
    expect(calls).toHaveLength(0);
  });

  test("answers 500 when the subscription can't be read, so Stripe retries", async () => {
    const t = await lockedOwner();
    fakeStripe({});
    expect((await post(t, "checkout.session.completed", completed())).status).toBe(500);
    expect((await account(t)).status).toBeUndefined();
  });
});

describe("checkout", () => {
  /** Fakes prices.list, customers.create and checkout.sessions.create. */
  function fakeCheckout() {
    return fakeStripe({}, (url) => {
      if (url.pathname === "/v1/prices") {
        return { object: "list", data: [{ id: "price_1m_year", lookup_key: url.searchParams.get("lookup_keys[0]") }] };
      }
      if (url.pathname === "/v1/customers") return { id: "cus_new", object: "customer" };
      if (url.pathname === "/v1/checkout/sessions") return { id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" };
      return undefined;
    });
  }

  test("finds the price by lookup key, makes the customer once and carries the trial over", async () => {
    const t = convexTest(schema, modules);
    await t.withIdentity(OWNER).mutation(api.accounts.ensure, {});
    const calls = fakeCheckout();

    const url = await t.withIdentity(OWNER).action(api.billing.checkout, { events: 1_000_000, interval: "year" });

    expect(url).toBe("https://checkout.stripe.com/c/pay/cs_1");
    expect(calls.find((c) => c.url.pathname === "/v1/prices")!.url.searchParams.get("lookup_keys[0]")).toBe(
      "events_1m_year",
    );
    const customer = calls.find((c) => c.url.pathname === "/v1/customers")!;
    expect(customer.body.get("metadata[ownerId]")).toBe(OWNER.tokenIdentifier);
    expect(customer.body.get("email")).toBe(OWNER.email);
    const session = calls.find((c) => c.url.pathname === "/v1/checkout/sessions")!.body;
    expect(session.get("mode")).toBe("subscription");
    expect(session.get("customer")).toBe("cus_new");
    expect(session.get("line_items[0][price]")).toBe("price_1m_year");
    expect(session.get("subscription_data[metadata][ownerId]")).toBe(OWNER.tokenIdentifier);
    const a = await account(t);
    expect(session.get("subscription_data[trial_end]")).toBe(String(Math.floor(a.trialEndsAt / 1000)));
    expect(session.get("success_url")).toBe("http://localhost:3000/billing?checkout=success");
    expect(a.stripeCustomerId).toBe("cus_new");

    // A second try reuses the customer
    const again = fakeCheckout();
    await t.withIdentity(OWNER).action(api.billing.checkout, { events: 500_000, interval: "month" });
    expect(again.some((c) => c.url.pathname === "/v1/customers")).toBe(false);
    expect(again.find((c) => c.url.pathname === "/v1/checkout/sessions")!.body.get("customer")).toBe("cus_new");
  });

  test("a locked account is charged at once (no trial left to carry)", async () => {
    const t = await lockedOwner();
    const calls = fakeCheckout();
    await t.withIdentity(OWNER).action(api.billing.checkout, { events: 500_000, interval: "month" });
    expect(calls.find((c) => c.url.pathname === "/v1/checkout/sessions")!.body.has("subscription_data[trial_end]")).toBe(
      false,
    );
  });

  test("refuses an unknown tier, a subscribed or comped account, and a signed-out caller", async () => {
    const t = convexTest(schema, modules);
    await t.withIdentity(OWNER).mutation(api.accounts.ensure, {});
    fakeCheckout();
    await expect(t.withIdentity(OWNER).action(api.billing.checkout, { events: 123, interval: "month" })).rejects.toThrow(
      /Unknown tier/,
    );
    await expect(t.action(api.billing.checkout, { events: 500_000, interval: "month" })).rejects.toThrow(/Not signed in/);

    await t.mutation(internal.billing.applySubscription, { record: subscriptionRecord(sub())! });
    await expect(
      t.withIdentity(OWNER).action(api.billing.checkout, { events: 500_000, interval: "month" }),
    ).rejects.toThrow(/already have a subscription/);

    await t.withIdentity(STRANGER).mutation(api.accounts.ensure, {});
    await t.mutation(internal.accounts.setComped, { ownerId: STRANGER.tokenIdentifier, comped: true });
    await expect(
      t.withIdentity(STRANGER).action(api.billing.checkout, { events: 500_000, interval: "month" }),
    ).rejects.toThrow(/free/);
  });
});

describe("this month's pageviews", () => {
  test("sum the owner's sites for the month only, and nobody else's", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity(OWNER);
    await owner.mutation(api.sites.create, { domain: "a.dev", timezone: "UTC" });
    await owner.mutation(api.sites.create, { domain: "b.dev", timezone: "UTC" });
    await t.withIdentity(STRANGER).mutation(api.sites.create, { domain: "c.dev", timezone: "UTC" });
    expect(await owner.query(api.billing.monthPageviews, { month: "2026-11" })).toBe(0);

    await t.run(async (ctx) => {
      const sites = await ctx.db.query("sites").collect();
      const id = (d: string) => sites.find((s) => s.domain === d)!._id;
      const day = (domain: string, date: string, pageviews: number) =>
        ctx.db.insert("dailyStats", { siteId: id(domain), date, pageviews, visitors: 1, durationSumMs: 0, durationCount: 0 });
      await day("a.dev", "2026-10-31", 1000); // last month
      await day("a.dev", "2026-11-01", 300);
      await day("a.dev", "2026-11-30", 200);
      await day("b.dev", "2026-11-10", 50);
      await day("c.dev", "2026-11-10", 9999); // the stranger's
    });

    expect(await owner.query(api.billing.monthPageviews, { month: "2026-11" })).toBe(550);
    await expect(owner.query(api.billing.monthPageviews, { month: "Nov" })).rejects.toThrow(/Bad month/);
  });
});

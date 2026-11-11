/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Filter } from "./lib/filters";
import { revenueTiles, type PaymentSort } from "./lib/payments";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test-secret";
const OWNER = { subject: "user_1", tokenIdentifier: "clerk|user_1" };
const STRANGER = { subject: "user_2", tokenIdentifier: "clerk|user_2" };
const DOMAIN = "picai.so";
const HOUR = 60 * 60 * 1000;

const VID_A = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f7a";
const VID_B = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f7b";
const VID_C = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f7c";
const SID_A1 = "1b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f71";
const SID_A2 = "2b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f72";
const SID_B = "3b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f73";
const SID_C = "4b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f74";

const WEEK = { from: "2026-10-07", to: "2026-10-13" };
const TABLE: { sort: PaymentSort; desc: boolean; search: string; offset: number } = {
  sort: "paid",
  desc: true,
  search: "",
  offset: 0,
};

type T = ReturnType<typeof convexTest>;
type Owner = ReturnType<T["withIdentity"]>;

async function visit(
  t: T,
  iso: string,
  o: { vid: string; sid: string; pvId: string; referrer?: string; country?: string; device?: "mobile" | "desktop" },
) {
  vi.setSystemTime(new Date(iso));
  await t.mutation(api.ingest.pageview, {
    secret: SECRET,
    site: DOMAIN,
    hostname: DOMAIN,
    path: "/pricing",
    referrer: o.referrer ?? "(direct)",
    unique: true,
    device: o.device ?? "desktop",
    browser: "Chrome",
    country: o.country ?? "US",
    pvId: o.pvId,
    visitorId: o.vid,
    sessionId: o.sid,
  });
}

/**
 * A site in Los Angeles taking payments through the API, in USD.
 * Week before (30 Sep to 6 Oct): C lands on 2 Oct and pays $20 two hours later.
 * The week (7 to 13 Oct): A comes direct on 10 Oct, from Google on 12 Oct and pays $49
 * an hour later; an unattributed $5 on 11 Oct; B (Germany, mobile, Hacker News) pays $19
 * an hour after landing on 13 Oct; A gets $10 back on 13 Oct; and a €10 payment.
 */
async function seed() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity(OWNER);
  await owner.mutation(api.sites.create, { domain: DOMAIN, timezone: "America/Los_Angeles" });
  await owner.mutation(api.sites.setRevenue, { domain: DOMAIN, revenueSource: "api", currency: "USD" });
  const key = await owner.action(api.sites.createApiKey, { domain: DOMAIN });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const keyHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const pay = (
    iso: string,
    p: { id: string; amountMinor: number; currency?: string; visitorId?: string; email?: string; refund?: boolean },
  ) => {
    vi.setSystemTime(new Date(iso));
    return t.mutation(api.payments.recordApi, {
      secret: SECRET,
      keyHash,
      payment: { currency: "USD", ts: Date.parse(iso), ...p },
    });
  };

  await visit(t, "2026-10-02T16:00:00Z", { vid: VID_C, sid: SID_C, pvId: "c1" });
  await pay("2026-10-02T18:00:00Z", { id: "c-1", amountMinor: 2000, visitorId: VID_C });
  await visit(t, "2026-10-10T17:00:00Z", { vid: VID_A, sid: SID_A1, pvId: "a1" });
  await pay("2026-10-11T18:00:00Z", { id: "anon-1", amountMinor: 500, email: "walkin@example.com" });
  await visit(t, "2026-10-12T17:00:00Z", { vid: VID_A, sid: SID_A2, pvId: "a2", referrer: "www.google.com" });
  await pay("2026-10-12T18:00:00Z", { id: "a-1", amountMinor: 4900, visitorId: VID_A, email: "ann@example.com" });
  await pay("2026-10-12T18:30:00Z", { id: "eur-1", amountMinor: 1000, currency: "EUR", visitorId: VID_A });
  await visit(t, "2026-10-13T16:00:00Z", {
    vid: VID_B,
    sid: SID_B,
    pvId: "b1",
    referrer: "news.ycombinator.com",
    country: "DE",
    device: "mobile",
  });
  await pay("2026-10-13T17:00:00Z", { id: "b-1", amountMinor: 1900, visitorId: VID_B });
  await pay("2026-10-13T19:00:00Z", { id: "a-r1", amountMinor: 1000, visitorId: VID_A, refund: true });
  return { t, owner };
}

type Range = { from: string; to: string } | { period: "today" | "yesterday" | "24h"; now: number };

async function ok(owner: Owner, opts: { range?: Range; filters?: Filter[] } & Partial<typeof TABLE> = {}) {
  const { range = WEEK, filters = [], ...table } = opts;
  const result = await owner.query(api.revenue.list, { domain: DOMAIN, range, filters, ...TABLE, ...table });
  if (result.status !== "ok") throw new Error(`status ${result.status}`);
  return result;
}

beforeEach(() => {
  vi.stubEnv("INGEST_SECRET", SECRET);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

test("the Revenue tab belongs to the site's owner, and needs a payments provider", async () => {
  const { t, owner } = await seed();
  const args = { domain: DOMAIN, range: WEEK, filters: [], ...TABLE };
  await t.withIdentity(STRANGER).mutation(api.accounts.ensure, {});
  await expect(t.query(api.revenue.list, args)).rejects.toThrow(/Not signed in/);
  await expect(t.withIdentity(STRANGER).query(api.revenue.list, args)).rejects.toThrow(/Site not found/);

  await owner.mutation(api.sites.setRevenue, { domain: DOMAIN, revenueSource: "none", currency: "USD" });
  expect(await owner.query(api.revenue.list, args)).toEqual({ status: "none" });
});

test("totals agree with the Analytics Revenue tile and the Sources card on Revenue", async () => {
  const { owner } = await seed();
  const result = await ok(owner);
  // $49 + $5 + $19 − $10 refund; the € payment is left out
  expect(result.totals).toEqual({
    revenueMinor: 6300,
    previousRevenueMinor: 2000,
    payments: 3,
    previousPayments: 1,
    refundsMinor: 1000,
    previousRefundsMinor: 0,
    // A: 10 Oct 17:00 to 12 Oct 18:00 (49 h); B: 1 h; the unattributed payment has none
    tookSumMs: 50 * HOUR,
    tookCount: 2,
    previousTookSumMs: 2 * HOUR,
    previousTookCount: 1,
  });
  expect(result.otherCurrency).toBe(1);
  expect(result.currency).toBe("USD");

  const summary = await owner.query(api.stats.summary, { domain: DOMAIN, ...WEEK });
  expect(result.totals.revenueMinor).toBe(summary.current.revenueMinor);
  expect(result.totals.previousRevenueMinor).toBe(summary.previous.revenueMinor);
  expect(result.totals.payments).toBe(summary.current.payments);
  expect(result.totals.refundsMinor).toBe(summary.current.refundsMinor);

  const sources = await owner.query(api.stats.breakdown, { domain: DOMAIN, ...WEEK, dim: "source" });
  expect(sources.totalRevenueMinor).toBe(6300);
  expect(Object.fromEntries(sources.rows.filter((r) => r.revenueMinor !== 0).map((r) => [r.key, r.revenueMinor]))).toEqual({
    Google: 3900,
    "Hacker News": 1900,
    Unattributed: 500,
  });

  // The chart is the Analytics chart's revenue, per day of the week
  const series = await owner.query(api.stats.timeseries, { domain: DOMAIN, ...WEEK });
  expect(result.chart.map((p) => p.revenueMinor)).toEqual(series.map((p) => p.revenueMinor));
  expect(result.chart.map((p) => p.revenueMinor)).toEqual([0, 0, 0, 0, 500, 4900, 900]);
  expect(result.lists).toBeNull();
});

test("tiles: revenue, conversions, average order value and time to convert with their changes", () => {
  const tiles = revenueTiles({
    revenueMinor: 6300,
    previousRevenueMinor: 2000,
    payments: 3,
    previousPayments: 1,
    refundsMinor: 1000,
    previousRefundsMinor: 0,
    tookSumMs: 50 * HOUR,
    tookCount: 2,
    previousTookSumMs: 2 * HOUR,
    previousTookCount: 1,
  });
  expect(tiles.revenue).toEqual({ value: 6300, change: 2.15 });
  expect(tiles.conversions).toEqual({ value: 3, change: 2 });
  // Before refunds: $73 over 3 payments, against $20
  expect(tiles.aov.value).toBeCloseTo(7300 / 3);
  expect(tiles.aov.change).toBeCloseTo(7300 / 3 / 2000 - 1);
  expect(tiles.took).toEqual({ value: 25 * HOUR, change: 11.5 });

  const empty = revenueTiles({
    revenueMinor: 0,
    previousRevenueMinor: 0,
    payments: 0,
    previousPayments: 0,
    refundsMinor: 0,
    previousRefundsMinor: 0,
    tookSumMs: 0,
    tookCount: 0,
    previousTookSumMs: 0,
    previousTookCount: 0,
  });
  expect(empty.aov).toEqual({ value: null, change: null });
  expect(empty.took).toEqual({ value: null, change: null });
});

test("the payments list: who paid, from where, their journey and how long it took", async () => {
  const { owner } = await seed();
  const result = await ok(owner);
  expect(result.matched).toBe(4);
  const b = result.rows[1].customer;
  expect(
    result.rows.map((r) => [r.kind, r.customer, r.country, r.device, r.source, r.journey, r.tookMs, r.amountMinor]),
  ).toEqual([
    ["refund", "ann@example.com", "US", "desktop", "Google", 2, null, -1000],
    ["payment", b, "DE", "mobile", "Hacker News", 1, HOUR, 1900],
    ["payment", "ann@example.com", "US", "desktop", "Google", 2, 49 * HOUR, 4900],
    ["payment", "walkin@example.com", null, null, null, null, null, 500],
  ]);
  // B never identified: the animal name the Users table shows
  expect(result.rows[1].customer).toMatch(/^[a-z]+ [a-z]+$/);
  expect(result.rows[1].visitorId).toBe(VID_B);
  expect(result.rows[3].visitorId).toBeNull();
  expect(result.rows[2].entryPath).toBe("/pricing");
});

test("the payments list sorts, searches and pages", async () => {
  const { owner } = await seed();
  const amounts = async (o: Partial<typeof TABLE>) => (await ok(owner, o)).rows.map((r) => r.amountMinor);
  expect(await amounts({ sort: "amount", desc: true })).toEqual([4900, 1900, 500, -1000]);
  expect(await amounts({ sort: "amount", desc: false })).toEqual([-1000, 500, 1900, 4900]);
  expect(await amounts({ sort: "paid", desc: false })).toEqual([500, 4900, 1900, -1000]);
  // Rows without a time to convert stay last either way
  expect(await amounts({ sort: "took", desc: true })).toEqual([4900, 1900, -1000, 500]);
  expect(await amounts({ sort: "took", desc: false })).toEqual([1900, 4900, -1000, 500]);
  expect(await amounts({ sort: "location", desc: false })).toEqual([1900, -1000, 4900, 500]);
  expect(await amounts({ sort: "location", desc: true })).toEqual([-1000, 4900, 1900, 500]);

  expect(await amounts({ search: "germany" })).toEqual([1900]);
  expect(await amounts({ search: "DE" })).toEqual([1900]);
  expect(await amounts({ search: "google" })).toEqual([-1000, 4900]);
  expect(await amounts({ search: "refund" })).toEqual([-1000]);
  expect(await amounts({ search: "walkin" })).toEqual([500]);
  expect(await amounts({ search: "/pricing" })).toEqual([-1000, 1900, 4900]);
  const none = await ok(owner, { search: "nothing" });
  expect([none.rows, none.matched]).toEqual([[], 0]);

  // Past the end goes back to the last page
  expect((await ok(owner, { offset: 100 })).offset).toBe(0);
});

test("with a filter: the filtered view's totals, lists and payments", async () => {
  const { owner } = await seed();
  const filters: Filter[] = [{ dim: "source", value: "Google" }];
  const result = await ok(owner, { filters });
  const view = await owner.query(api.stats.filtered, { domain: DOMAIN, ...WEEK, filters });
  if (view.status !== "ok") throw new Error(view.status);
  expect(result.totals.revenueMinor).toBe(view.summary.current.revenueMinor);
  expect(result.totals).toMatchObject({ revenueMinor: 3900, payments: 1, refundsMinor: 1000, tookCount: 1 });
  expect(result.rows.map((r) => r.amountMinor)).toEqual([-1000, 4900]);
  expect(result.lists?.source.rows.map((r) => [r.key, r.revenueMinor])).toEqual([["Google", 3900]]);
  expect(result.lists?.source.totalRevenueMinor).toBe(view.breakdowns.source.totalRevenueMinor);
  expect(result.chart.map((p) => p.revenueMinor)).toEqual(view.timeseries.map((p) => p.revenueMinor));

  // Filtered day ranges are limited to 90 days
  const long = await owner.query(api.revenue.list, {
    domain: DOMAIN,
    range: { from: "2026-01-01", to: "2026-10-13" },
    filters,
    ...TABLE,
  });
  expect(long).toEqual({ status: "range" });
});

test("today: hour points from the filtered view, as the Analytics tab's", async () => {
  const { owner } = await seed();
  const now = Date.parse("2026-10-13T20:00:00Z");
  const result = await ok(owner, { range: { period: "today", now } });
  const hourly = await owner.query(api.stats.hourly, { domain: DOMAIN, period: "today", now, filters: [] });
  if (hourly.status !== "ok") throw new Error(hourly.status);
  // B's $19 and A's $10 refund on 13 Oct (LA)
  expect(result.totals.revenueMinor).toBe(900);
  expect(result.totals.revenueMinor).toBe(hourly.summary.current.revenueMinor);
  // Midnight to the end of the current hour (13:00 in LA)
  expect(result.chart).toHaveLength(14);
  expect(result.chart.map((p) => p.revenueMinor)).toEqual(hourly.timeseries.map((p) => p.revenueMinor));
  expect(result.rows.map((r) => r.amountMinor)).toEqual([-1000, 1900]);
});

test("a refund lowers revenue on the tab as it does on Analytics", async () => {
  const { owner } = await seed();
  const before = (await ok(owner, { range: { from: "2026-10-12", to: "2026-10-12" } })).totals;
  expect(before.revenueMinor).toBe(4900);
  const after = (await ok(owner, { range: { from: "2026-10-13", to: "2026-10-13" } })).totals;
  expect([after.revenueMinor, after.payments, after.refundsMinor]).toEqual([900, 1, 1000]);
});

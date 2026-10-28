/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Filter } from "./lib/filters";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test-secret";
const OWNER = { subject: "user_1", tokenIdentifier: "clerk|user_1" };
const STRANGER = { subject: "user_2", tokenIdentifier: "clerk|user_2" };

const VID_A = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f7a";
const VID_B = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f7b";
const VID_C = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f7c";
const SID1 = "1b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f71";
const SID2 = "2b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f72";
const SID3 = "3b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f73";

const WEEK = { from: "2026-10-07", to: "2026-10-13" };

type T = ReturnType<typeof convexTest>;

async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity(OWNER);
  await owner.mutation(api.sites.create, { domain: "picai.so", timezone: "America/Los_Angeles" });
  await owner.mutation(api.sites.setRevenue, { domain: "picai.so", revenueSource: "api", currency: "USD" });
  await owner.mutation(api.sites.setKeyGoal, { domain: "picai.so", keyGoal: "signup" });
  const key = await owner.action(api.sites.createApiKey, { domain: "picai.so" });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const keyHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { t, owner, keyHash };
}

type Visit = {
  vid: string;
  sid: string;
  pvId: string;
  path?: string;
  referrer?: string;
  country?: string;
  device?: "mobile" | "desktop";
};

async function visit(t: T, iso: string, o: Visit) {
  vi.setSystemTime(new Date(iso));
  await t.mutation(api.ingest.pageview, {
    secret: SECRET,
    site: "picai.so",
    hostname: "picai.so",
    path: o.path ?? "/",
    referrer: o.referrer ?? "(direct)",
    unique: true,
    device: o.device ?? "mobile",
    browser: o.device === "desktop" ? "Chrome" : "Mobile Safari",
    os: o.device === "desktop" ? "Mac OS" : "iOS",
    country: o.country ?? "US",
    pvId: o.pvId,
    visitorId: o.vid,
    sessionId: o.sid,
  });
}

async function event(t: T, iso: string, pvId: string, e: { type: "goal"; name: string } | { type: "outbound"; url: string }) {
  vi.setSystemTime(new Date(iso));
  await t.mutation(api.ingest.event, { secret: SECRET, site: "picai.so", hostname: "picai.so", pvId, event: e });
}

async function ping(t: T, iso: string, pvId: string, ms: number) {
  vi.setSystemTime(new Date(iso));
  await t.mutation(api.ingest.ping, { secret: SECRET, site: "picai.so", hostname: "picai.so", pvId, ms });
}

async function pay(t: T, keyHash: string, iso: string, id: string, amountMinor: number, visitorId: string) {
  vi.setSystemTime(new Date(iso));
  await t.mutation(api.payments.recordApi, {
    secret: SECRET,
    keyHash,
    payment: { id, amountMinor, currency: "USD", visitorId },
  });
}

/**
 * A: from ChatGPT on a phone in the US, reads / and /pricing, signs up, pays $49 the
 * next day. B: Direct on a desktop in Germany, clicks out to GitHub. C: from Google,
 * one page (a bounce).
 */
async function seed() {
  const s = await setup();
  const { t, keyHash } = s;
  await visit(t, "2026-10-12T17:00:00Z", { vid: VID_A, sid: SID1, pvId: "a1", referrer: "chatgpt.com" });
  await ping(t, "2026-10-12T17:00:30Z", "a1", 30_000);
  await visit(t, "2026-10-12T17:01:00Z", { vid: VID_A, sid: SID1, pvId: "a2", path: "/pricing" });
  await ping(t, "2026-10-12T17:02:00Z", "a2", 50_000);
  await event(t, "2026-10-12T17:02:10Z", "a2", { type: "goal", name: "signup" });
  await visit(t, "2026-10-12T18:00:00Z", { vid: VID_B, sid: SID2, pvId: "b1", country: "DE", device: "desktop" });
  await event(t, "2026-10-12T18:00:20Z", "b1", { type: "outbound", url: "https://github.com/acme" });
  await visit(t, "2026-10-13T16:00:00Z", { vid: VID_C, sid: SID3, pvId: "c1", referrer: "google.com" });
  await pay(t, keyHash, "2026-10-13T17:00:00Z", "order_1", 4900, VID_A);
  return s;
}

function filtered(owner: ReturnType<T["withIdentity"]>, filters: Filter[], range = WEEK) {
  return owner.query(api.stats.filtered, { domain: "picai.so", ...range, filters });
}

async function ok(owner: ReturnType<T["withIdentity"]>, filters: Filter[], range = WEEK) {
  const result = await filtered(owner, filters, range);
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

test("filtered views belong to the site's owner", async () => {
  const { t } = await seed();
  const args = { domain: "picai.so", ...WEEK, filters: [{ dim: "channel" as const, value: "AI" }] };
  await expect(t.query(api.stats.filtered, args)).rejects.toThrow(/Not signed in/);
  await expect(t.withIdentity(STRANGER).query(api.stats.filtered, args)).rejects.toThrow(/Site not found/);
});

test("rejects no filters or too many, and ranges over 90 days get a notice", async () => {
  const { owner } = await seed();
  await expect(filtered(owner, [])).rejects.toThrow(/filters/);
  const four: Filter[] = [
    { dim: "channel", value: "AI" },
    { dim: "country", value: "US" },
    { dim: "device", value: "mobile" },
    { dim: "page", value: "/" },
  ];
  await expect(filtered(owner, four)).rejects.toThrow(/filters/);
  const long = await filtered(owner, [{ dim: "channel", value: "AI" }], { from: "2026-07-01", to: "2026-10-13" });
  expect(long).toEqual({ status: "range" });
});

describe("channel:AI", () => {
  test("changes every tile, the chart and every list", async () => {
    const { owner } = await seed();
    const r = await ok(owner, [{ dim: "channel", value: "AI" }]);

    expect(r.summary.current).toEqual({
      visitors: 1,
      pageviews: 2,
      timeOnPageMs: 40_000,
      sessions: 1,
      bounceRate: 0,
      sessionTimeMs: 80_000,
      revenueMinor: 4900,
      payments: 1,
      refundsMinor: 0,
    });
    expect(r.timeseries.find((d) => d.date === "2026-10-12")).toEqual({
      date: "2026-10-12",
      pageviews: 2,
      visitors: 1,
      revenueMinor: 0,
      goal: 1,
      bounceRate: 0,
      sessionTimeMs: 80_000,
      timeOnPageMs: 40_000,
      conversionRate: 0,
    });
    // A paid the next day, with no matching visit that day to divide by
    expect(r.timeseries.find((d) => d.date === "2026-10-13")).toMatchObject({
      revenueMinor: 4900,
      visitors: 0,
      conversionRate: null,
    });
    expect(r.timeseries).toHaveLength(7);

    expect(r.breakdowns.channel.rows).toEqual([
      { key: "AI", pageviews: 2, visitors: 1, sessions: 1, events: 0, revenueMinor: 4900 },
    ]);
    expect(r.breakdowns.source.rows.map((x) => x.key)).toEqual(["ChatGPT"]);
    expect(r.breakdowns.page.rows.map((x) => [x.key, x.pageviews])).toEqual([
      ["/", 1],
      ["/pricing", 1],
    ]);
    expect(r.breakdowns.entry.rows.map((x) => x.key)).toEqual(["/"]);
    expect(r.breakdowns.exit.rows.map((x) => x.key)).toEqual(["/pricing"]);
    expect(r.breakdowns.country.rows.map((x) => x.key)).toEqual(["US"]);
    expect(r.breakdowns.device.rows.map((x) => x.key)).toEqual(["mobile"]);
    expect(r.breakdowns.outbound.rows).toEqual([]);
    expect(r.goals).toEqual({ rows: [{ name: "signup", completions: 1, visitors: 1 }], visitors: 1, keyGoal: "signup", keyGoalPrevious: 0 });
    expect(r.conversions).toEqual({ kind: "revenue", current: 1, previous: 0, otherCurrencyPayments: 0 });
  });

  test("matches the rollups' shape: the unfiltered numbers add up to the same totals", async () => {
    const { owner } = await seed();
    const rollup = await owner.query(api.stats.summary, { domain: "picai.so", ...WEEK });
    // Every session is mobile or desktop, so the two device filters add up to the whole
    const mobile = await ok(owner, [{ dim: "device", value: "mobile" }]);
    const desktop = await ok(owner, [{ dim: "device", value: "desktop" }]);
    for (const k of ["visitors", "sessions", "pageviews", "revenueMinor"] as const) {
      expect(mobile.summary.current[k] + desktop.summary.current[k]).toBe(rollup.current[k]);
    }
    expect(mobile.summary.current.bounceRate).toBe(0.5); // A did not bounce, C did
  });
});

test("counts the key goal's completions in the period before, from matching sessions only", async () => {
  const { t, owner } = await seed();
  // Oct 7-13 is the range, so Oct 1 is in the period before
  await visit(t, "2026-10-01T17:00:00Z", { vid: VID_B, sid: "4b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f74", pvId: "d1" });
  await event(t, "2026-10-01T17:00:10Z", "d1", { type: "goal", name: "signup" });
  await visit(t, "2026-10-01T17:01:00Z", { vid: VID_B, sid: "4b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f74", pvId: "d2", path: "/x" });
  await event(t, "2026-10-01T17:01:10Z", "d2", { type: "goal", name: "signup" });
  await visit(t, "2026-10-01T18:00:00Z", { vid: VID_C, sid: "5b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f75", pvId: "e1", device: "desktop" });
  await event(t, "2026-10-01T18:00:10Z", "e1", { type: "goal", name: "signup" });

  expect((await ok(owner, [{ dim: "device", value: "mobile" }])).goals.keyGoalPrevious).toBe(2);
  expect((await ok(owner, [{ dim: "device", value: "desktop" }])).goals.keyGoalPrevious).toBe(1);
});

test("the chart's rates and key goal count only matching sessions", async () => {
  const { owner } = await seed();
  const us = await ok(owner, [{ dim: "country", value: "US" }]);
  // Oct 12: A (signed up, two pages); B is in Germany
  expect(us.timeseries.find((d) => d.date === "2026-10-12")).toMatchObject({
    visitors: 1,
    goal: 1,
    bounceRate: 0,
    conversionRate: 0,
  });
  // Oct 13: C bounced; A's payment lands on its own day, credited to A's US session
  expect(us.timeseries.find((d) => d.date === "2026-10-13")).toMatchObject({
    visitors: 1,
    revenueMinor: 4900,
    goal: 0,
    bounceRate: 1,
    conversionRate: 1,
  });
  const de = await ok(owner, [{ dim: "country", value: "DE" }]);
  expect(de.timeseries.find((d) => d.date === "2026-10-12")).toMatchObject({ visitors: 1, goal: 0, bounceRate: 1 });
  expect(de.timeseries.find((d) => d.date === "2026-10-13")).toMatchObject({ revenueMinor: 0, conversionRate: null });
});

test("page, goal and outbound filters pick the sessions that had them", async () => {
  const { owner } = await seed();
  const pricing = await ok(owner, [{ dim: "page", value: "/pricing" }]);
  expect(pricing.summary.current).toMatchObject({ visitors: 1, sessions: 1, revenueMinor: 4900 });
  // Pages lists every page those sessions viewed
  expect(pricing.breakdowns.page.rows.map((x) => x.key)).toEqual(["/", "/pricing"]);

  const signup = await ok(owner, [{ dim: "goal", value: "signup" }]);
  expect(signup.breakdowns.source.rows.map((x) => x.key)).toEqual(["ChatGPT"]);

  const github = await ok(owner, [{ dim: "outbound", value: "https://github.com/acme" }]);
  expect(github.summary.current).toMatchObject({ visitors: 1, sessions: 1, revenueMinor: 0 });
  expect(github.breakdowns.country.rows.map((x) => x.key)).toEqual(["DE"]);
  expect(github.breakdowns.outbound.rows).toEqual([
    { key: "https://github.com/acme", pageviews: 0, visitors: 1, sessions: 0, events: 1, revenueMinor: 0 },
  ]);
});

test("filters combine, and a view with no sessions has no rates", async () => {
  const { owner } = await seed();
  const both = await ok(owner, [
    { dim: "channel", value: "Organic Search" },
    { dim: "country", value: "US" },
  ]);
  expect(both.summary.current).toMatchObject({ visitors: 1, sessions: 1, bounceRate: 1 });

  const none = await ok(owner, [
    { dim: "channel", value: "AI" },
    { dim: "country", value: "DE" },
  ]);
  expect(none.summary.current).toMatchObject({ visitors: 0, sessions: 0, bounceRate: null, sessionTimeMs: null });
  expect(none.breakdowns.page.rows).toEqual([]);
  expect(none.conversions.current).toBe(0);
});

test("the AI list keeps only AI sources, with their revenue and totals", async () => {
  const { owner } = await seed();
  // Every session is mobile but B's, so ChatGPT (A) and Google (C) both match
  const r = await ok(owner, [{ dim: "device", value: "mobile" }]);
  expect(r.breakdowns.source.rows.map((x) => x.key)).toEqual(["ChatGPT", "Google"]);
  expect(r.breakdowns["source:AI"].rows).toEqual([
    { key: "ChatGPT", pageviews: 2, visitors: 1, sessions: 1, events: 0, revenueMinor: 4900 },
  ]);
  expect(r.breakdowns["source:AI"]).toMatchObject({ totalVisitors: 1, totalSessions: 1, totalRevenueMinor: 4900 });

  const search = await ok(owner, [{ dim: "channel", value: "Organic Search" }]);
  expect(search.breakdowns["source:AI"].rows).toEqual([]);
});

test("a payment credited to a session before the range still counts under that session's keys", async () => {
  const { t, owner, keyHash } = await seed();
  // A pays again a week later without visiting; the payment is credited to the ChatGPT session
  await pay(t, keyHash, "2026-10-20T17:00:00Z", "order_2", 1000, VID_A);
  const day = { from: "2026-10-20", to: "2026-10-20" };

  const ai = await ok(owner, [{ dim: "channel", value: "AI" }], day);
  expect(ai.summary.current).toMatchObject({ visitors: 0, sessions: 0, revenueMinor: 1000, payments: 1 });
  expect(ai.breakdowns.channel.rows).toEqual([
    { key: "AI", pageviews: 0, visitors: 0, sessions: 0, events: 0, revenueMinor: 1000 },
  ]);
  // Its pageviews are read too, so a page filter finds it
  const pricing = await ok(owner, [{ dim: "page", value: "/pricing" }], day);
  expect(pricing.summary.current.revenueMinor).toBe(1000);
  const direct = await ok(owner, [{ dim: "channel", value: "Direct" }], day);
  expect(direct.summary.current.revenueMinor).toBe(0);
});

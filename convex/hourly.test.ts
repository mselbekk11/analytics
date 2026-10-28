/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
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

// 14:40 on 13 Oct in Los Angeles (UTC-7)
const NOW = Date.parse("2026-10-13T21:40:00Z");

type T = ReturnType<typeof convexTest>;
type Owner = ReturnType<T["withIdentity"]>;

async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity(OWNER);
  await owner.mutation(api.sites.create, { domain: "picai.so", timezone: "America/Los_Angeles" });
  await owner.mutation(api.sites.setRevenue, { domain: "picai.so", revenueSource: "api", currency: "USD" });
  const key = await owner.action(api.sites.createApiKey, { domain: "picai.so" });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const keyHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { t, owner, keyHash };
}

type Visit = {
  pvId: string;
  vid?: string;
  sid?: string;
  path?: string;
  referrer?: string;
  country?: string;
  unique?: boolean;
};

async function visit(t: T, iso: string, o: Visit) {
  vi.setSystemTime(new Date(iso));
  await t.mutation(api.ingest.pageview, {
    secret: SECRET,
    site: "picai.so",
    hostname: "picai.so",
    path: o.path ?? "/",
    referrer: o.referrer ?? "(direct)",
    unique: o.unique ?? true,
    device: "mobile",
    browser: "Mobile Safari",
    os: "iOS",
    country: o.country ?? "US",
    pvId: o.pvId,
    ...(o.vid ? { visitorId: o.vid, sessionId: o.sid } : { cookieless: true }),
  });
}

/**
 * A and B visit on 12 Oct (10:00 and 11:00 in LA), C on 13 Oct at 09:00 from Google,
 * and A pays $49 on 13 Oct at 10:00.
 */
async function seed() {
  const s = await setup();
  const { t, keyHash } = s;
  await visit(t, "2026-10-12T17:00:00Z", { vid: VID_A, sid: SID1, pvId: "a1" });
  await visit(t, "2026-10-12T17:05:00Z", { vid: VID_A, sid: SID1, pvId: "a2", path: "/pricing" });
  await visit(t, "2026-10-12T18:00:00Z", { vid: VID_B, sid: SID2, pvId: "b1", country: "DE" });
  await visit(t, "2026-10-13T16:00:00Z", { vid: VID_C, sid: SID3, pvId: "c1", referrer: "google.com" });
  vi.setSystemTime(new Date("2026-10-13T17:00:00Z"));
  await t.mutation(api.payments.recordApi, {
    secret: SECRET,
    keyHash,
    payment: { id: "order_1", amountMinor: 4900, currency: "USD", visitorId: VID_A },
  });
  return s;
}

async function hourly(owner: Owner, period: "today" | "yesterday" | "24h", filters: Filter[] = []) {
  const result = await owner.query(api.stats.hourly, { domain: "picai.so", period, now: NOW, filters });
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

test("hourly views belong to the site's owner", async () => {
  const { t } = await seed();
  const args = { domain: "picai.so", period: "today" as const, now: NOW, filters: [] };
  await expect(t.query(api.stats.hourly, args)).rejects.toThrow(/Not signed in/);
  await expect(t.withIdentity(STRANGER).query(api.stats.hourly, args)).rejects.toThrow(/Site not found/);
});

test("today runs from local midnight to the end of the current hour, one point per hour", async () => {
  const { owner } = await seed();
  const view = await hourly(owner, "today");
  const points = view.timeseries.map((p) => p.date);
  expect(points).toHaveLength(15);
  expect(points[0]).toBe("2026-10-13T00:00");
  expect(points.at(-1)).toBe("2026-10-13T14:00");
  // 16:00Z and 17:00Z are 09:00 and 10:00 in Los Angeles
  const at = (h: string) => view.timeseries.find((p) => p.date === `2026-10-13T${h}:00`)!;
  expect(at("09")).toMatchObject({ visitors: 1, pageviews: 1, bounceRate: 1 });
  expect(at("10")).toMatchObject({ visitors: 0, revenueMinor: 4900 });
  expect(view.summary.current).toMatchObject({ visitors: 1, pageviews: 1, sessions: 1, revenueMinor: 4900 });
  // A's payment is credited to A's Direct session from yesterday
  expect(view.breakdowns.source.rows.map((r) => [r.key, r.visitors, r.revenueMinor])).toEqual([
    ["Google", 1, 0],
    ["Direct", 0, 4900],
  ]);
});

test("the previous window has the same length and ends where the window starts", async () => {
  const { owner } = await seed();
  // Today's 15 hours follow 16:00Z-07:00Z, which holds A's and B's visits
  const today = await hourly(owner, "today");
  expect(today.summary.previous).toMatchObject({ visitors: 2, pageviews: 3, sessions: 2 });
  // Yesterday is the whole of 12 Oct in LA; 11 Oct had nothing
  const yesterday = await hourly(owner, "yesterday");
  expect(yesterday.timeseries).toHaveLength(24);
  expect(yesterday.timeseries[0].date).toBe("2026-10-12T00:00");
  expect(yesterday.summary.current).toMatchObject({ visitors: 2, pageviews: 3, sessions: 2 });
  expect(yesterday.summary.previous).toMatchObject({ visitors: 0, pageviews: 0 });
  const tenAm = yesterday.timeseries.find((p) => p.date === "2026-10-12T10:00")!;
  expect(tenAm).toMatchObject({ visitors: 1, pageviews: 2 });
});

test("24h ends at the client's current hour, in the site's timezone", async () => {
  const { owner } = await seed();
  const view = await hourly(owner, "24h");
  expect(view.timeseries).toHaveLength(24);
  expect(view.timeseries[0].date).toBe("2026-10-12T15:00");
  expect(view.timeseries.at(-1)!.date).toBe("2026-10-13T14:00");
  expect(view.summary.current.visitors).toBe(1);
  expect(view.summary.previous.visitors).toBe(2);

  // The same moment in another timezone moves the hours
  await owner.mutation(api.sites.update, { domain: "picai.so", timezone: "Europe/Berlin" });
  const berlin = await hourly(owner, "24h");
  expect(berlin.timeseries.at(-1)!.date).toBe("2026-10-13T23:00");
});

test("filters combine with hourly ranges", async () => {
  const { owner } = await seed();
  const google = await hourly(owner, "yesterday", [{ dim: "country", value: "DE" }]);
  expect(google.summary.current).toMatchObject({ visitors: 1, pageviews: 1 });
  expect(google.breakdowns.country.rows.map((r) => r.key)).toEqual(["DE"]);
  const none = await hourly(owner, "today", [{ dim: "country", value: "DE" }]);
  expect(none.summary.current.visitors).toBe(0);
  await expect(
    owner.query(api.stats.hourly, {
      domain: "picai.so",
      period: "today",
      now: NOW,
      filters: [
        { dim: "country", value: "US" },
        { dim: "device", value: "mobile" },
        { dim: "page", value: "/" },
        { dim: "browser", value: "Chrome" },
      ],
    }),
  ).rejects.toThrow(/filters/);
});

test("cookieless pageviews count toward pageviews and pageview lists, not sessions", async () => {
  const { t, owner } = await setup();
  await visit(t, "2026-10-13T20:00:00Z", { pvId: "x1", path: "/blog" });
  await visit(t, "2026-10-13T20:10:00Z", { pvId: "x2", path: "/blog", unique: false });
  await visit(t, "2026-10-13T20:20:00Z", { pvId: "x3", path: "/", country: "DE" });
  const view = await hourly(owner, "today");
  expect(view.summary.current).toMatchObject({ pageviews: 3, visitors: 2, sessions: 0, bounceRate: null, sessionTimeMs: null });
  expect(view.timeseries.find((p) => p.date === "2026-10-13T13:00")).toMatchObject({ pageviews: 3, visitors: 2 });
  expect(view.breakdowns.page.rows.map((r) => [r.key, r.pageviews])).toEqual([["/blog", 2], ["/", 1]]);
  expect(view.breakdowns.country.rows.map((r) => [r.key, r.visitors])).toEqual([["US", 1], ["DE", 1]]);
  expect(view.breakdowns.source.rows).toEqual([]);
  // A filter picks sessions, so session-less pageviews drop out
  const filtered = await hourly(owner, "today", [{ dim: "page", value: "/blog" }]);
  expect(filtered.summary.current.pageviews).toBe(0);
});

test("past the read budget, the view says there are too many rows", async () => {
  const { t, owner } = await setup();
  await t.run(async (ctx) => {
    const site = (await ctx.db.query("sites").first())!;
    for (let i = 0; i < 12_001; i++) {
      await ctx.db.insert("pageviews", {
        siteId: site._id,
        ts: Date.parse("2026-10-13T20:00:00Z") + i,
        path: "/",
        referrer: "(direct)",
        unique: true,
        device: "mobile",
        browser: "Mobile Safari",
        country: "US",
        pvId: `bulk-${i}`,
      });
    }
  });
  const result = await owner.query(api.stats.hourly, { domain: "picai.so", period: "today", now: NOW, filters: [] });
  expect(result.status).toBe("tooMany");
});

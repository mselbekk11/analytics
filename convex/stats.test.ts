/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test-secret";
const OWNER = { subject: "user_1", tokenIdentifier: "clerk|user_1" };
const STRANGER = { subject: "user_2", tokenIdentifier: "clerk|user_2" };

type Hit = {
  path?: string;
  referrer?: string;
  unique?: boolean;
  device?: "mobile" | "tablet" | "desktop";
  browser?: string;
  country?: string;
};

let pvCounter = 0;

/** Records one pageview at `iso` through the real ingest mutation. */
async function visit(t: ReturnType<typeof convexTest>, iso: string, h: Hit = {}) {
  vi.setSystemTime(new Date(iso));
  const pvId = `pv-${++pvCounter}`;
  await t.mutation(api.ingest.pageview, {
    secret: SECRET,
    site: "picai.so",
    hostname: "picai.so",
    path: h.path ?? "/",
    referrer: h.referrer ?? "(direct)",
    unique: h.unique ?? true,
    device: h.device ?? "desktop",
    browser: h.browser ?? "Chrome",
    country: h.country ?? "US",
    pvId,
  });
  return pvId;
}

async function setup() {
  const t = convexTest(schema, modules);
  await t
    .withIdentity(OWNER)
    .mutation(api.sites.create, { domain: "picai.so", timezone: "America/Los_Angeles" });
  return t;
}

beforeEach(() => {
  vi.stubEnv("INGEST_SECRET", SECRET);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

// Los Angeles is UTC-7 in October, so 17:00Z is 10:00 local on the same date.
const range = { domain: "picai.so", from: "2026-10-10", to: "2026-10-13" };

describe("access control", () => {
  test("every stats query requires the site's owner", async () => {
    const t = await setup();
    const calls = [
      (c: typeof t) => c.query(api.stats.summary, range),
      (c: typeof t) => c.query(api.stats.timeseries, range),
      (c: typeof t) => c.query(api.stats.breakdown, { ...range, dim: "page" }),
      (c: typeof t) => c.query(api.stats.live, { domain: "picai.so", since: 0 }),
    ];
    for (const call of calls) {
      await expect(call(t)).rejects.toThrow(/Not signed in/);
      await expect(call(t.withIdentity(STRANGER) as typeof t)).rejects.toThrow(/Site not found/);
      await expect(call(t.withIdentity(OWNER) as typeof t)).resolves.toBeDefined();
    }
  });

  test("an unknown domain looks the same as someone else's", async () => {
    const t = await setup();
    await expect(
      t.withIdentity(OWNER).query(api.stats.summary, { ...range, domain: "nope.com" }),
    ).rejects.toThrow(/Site not found/);
  });

  test("rejects reversed and over-long ranges", async () => {
    const t = (await setup()).withIdentity(OWNER);
    await expect(
      t.query(api.stats.summary, { ...range, from: "2026-10-13", to: "2026-10-10" }),
    ).rejects.toThrow(/Invalid date range/);
    await expect(
      t.query(api.stats.timeseries, { ...range, from: "2024-01-01", to: "2026-10-13" }),
    ).rejects.toThrow(/Invalid date range/);
  });

  test("sites.get returns null for a site the caller does not own", async () => {
    const t = await setup();
    expect(await t.withIdentity(OWNER).query(api.sites.get, { domain: "www.picai.so" })).toEqual({
      domain: "picai.so",
      timezone: "America/Los_Angeles",
    });
    expect(await t.withIdentity(STRANGER).query(api.sites.get, { domain: "picai.so" })).toBeNull();
    expect(await t.withIdentity(STRANGER).query(api.sites.list, {})).toEqual([]);
  });
});

describe("stats.summary", () => {
  test("sums the range and the previous range of equal length", async () => {
    const t = await setup();
    // Current range: Oct 10-13. Previous: Oct 6-9.
    await visit(t, "2026-10-10T17:00:00Z");
    await visit(t, "2026-10-12T17:00:00Z");
    await visit(t, "2026-10-12T17:05:00Z", { unique: false });
    await visit(t, "2026-10-07T17:00:00Z");
    // Outside both ranges
    await visit(t, "2026-10-05T17:00:00Z");
    // Oct 14 05:00Z is still Oct 13 in LA, so it counts
    const late = await visit(t, "2026-10-14T05:00:00Z");
    await t.mutation(api.ingest.duration, {
      secret: SECRET,
      site: "picai.so",
      hostname: "picai.so",
      pvId: late,
      ms: 30_000,
    });

    const s = await t.withIdentity(OWNER).query(api.stats.summary, range);
    expect(s.current).toEqual({ visitors: 3, pageviews: 4, timeOnPageMs: 30_000 });
    expect(s.previous).toEqual({ visitors: 1, pageviews: 1, timeOnPageMs: null });
  });

  test("averages time on page over the beacons received", async () => {
    const t = await setup();
    for (const ms of [10_000, 20_000, 40_000]) {
      const pvId = await visit(t, "2026-10-11T17:00:00Z");
      await t.mutation(api.ingest.duration, {
        secret: SECRET,
        site: "picai.so",
        hostname: "picai.so",
        pvId,
        ms,
      });
    }
    await visit(t, "2026-10-11T17:00:00Z"); // no beacon: not part of the average
    const s = await t.withIdentity(OWNER).query(api.stats.summary, range);
    expect(s.current.timeOnPageMs).toBe(23_333);
  });
});

describe("stats.timeseries", () => {
  test("returns one point per day with gaps filled as zero", async () => {
    const t = await setup();
    await visit(t, "2026-10-10T17:00:00Z");
    await visit(t, "2026-10-12T17:00:00Z");
    await visit(t, "2026-10-12T18:00:00Z", { unique: false });
    await visit(t, "2026-10-20T17:00:00Z"); // after the range

    expect(await t.withIdentity(OWNER).query(api.stats.timeseries, range)).toEqual([
      { date: "2026-10-10", pageviews: 1, visitors: 1 },
      { date: "2026-10-11", pageviews: 0, visitors: 0 },
      { date: "2026-10-12", pageviews: 2, visitors: 1 },
      { date: "2026-10-13", pageviews: 0, visitors: 0 },
    ]);
  });
});

describe("stats.breakdown", () => {
  test("merges days per key; pages sort by pageviews", async () => {
    const t = await setup();
    await visit(t, "2026-10-10T17:00:00Z", { path: "/" });
    await visit(t, "2026-10-11T17:00:00Z", { path: "/pricing" });
    await visit(t, "2026-10-12T17:00:00Z", { path: "/pricing", unique: false });
    await visit(t, "2026-10-12T17:01:00Z", { path: "/pricing", unique: false });
    await visit(t, "2026-10-13T17:00:00Z", { path: "/" });
    await visit(t, "2026-10-13T17:01:00Z", { path: "/blog", unique: false });

    const b = await t
      .withIdentity(OWNER)
      .query(api.stats.breakdown, { ...range, dim: "page" });
    expect(b.rows).toEqual([
      { key: "/pricing", pageviews: 3, visitors: 1 },
      { key: "/", pageviews: 2, visitors: 2 },
      { key: "/blog", pageviews: 1, visitors: 0 },
    ]);
    expect(b.totalPageviews).toBe(6);
    expect(b.totalVisitors).toBe(3);
  });

  test("visitor lists sort by visitors and drop keys with no unique visits", async () => {
    const t = await setup();
    await visit(t, "2026-10-10T17:00:00Z", { referrer: "google.com" });
    await visit(t, "2026-10-11T17:00:00Z", { referrer: "google.com" });
    await visit(t, "2026-10-11T17:00:00Z", { referrer: "news.ycombinator.com" });
    await visit(t, "2026-10-12T17:00:00Z", { referrer: "(direct)", unique: false });
    await visit(t, "2026-10-12T17:00:00Z", { referrer: "(direct)", unique: false });
    await visit(t, "2026-10-01T17:00:00Z", { referrer: "bing.com" }); // before the range

    const b = await t
      .withIdentity(OWNER)
      .query(api.stats.breakdown, { ...range, dim: "referrer" });
    expect(b.rows.map((r) => [r.key, r.visitors])).toEqual([
      ["google.com", 2],
      ["news.ycombinator.com", 1],
    ]);
    expect(b.totalVisitors).toBe(3);
  });

  test("device totals give the percentage base", async () => {
    const t = await setup();
    await visit(t, "2026-10-10T17:00:00Z", { device: "mobile" });
    await visit(t, "2026-10-10T17:00:00Z", { device: "mobile" });
    await visit(t, "2026-10-10T17:00:00Z", { device: "desktop" });
    await visit(t, "2026-10-10T17:00:00Z", { device: "tablet" });
    const b = await t
      .withIdentity(OWNER)
      .query(api.stats.breakdown, { ...range, dim: "device" });
    expect(b.rows[0]).toMatchObject({ key: "mobile", visitors: 2 });
    expect(b.totalVisitors).toBe(4);
  });
});

describe("stats.live", () => {
  test("counts pageviews since the given timestamp", async () => {
    const t = await setup();
    await visit(t, "2026-10-13T16:50:00Z");
    await visit(t, "2026-10-13T16:56:00Z");
    await visit(t, "2026-10-13T16:59:00Z", { unique: false });
    const since = Date.parse("2026-10-13T16:55:00Z");
    expect(await t.withIdentity(OWNER).query(api.stats.live, { domain: "picai.so", since })).toBe(2);
  });
});

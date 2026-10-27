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
  visitorId?: string;
  sessionId?: string;
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
    visitorId: h.visitorId,
    sessionId: h.sessionId,
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
      (c: typeof t) => c.query(api.stats.online, { domain: "picai.so", since: 0 }),
      (c: typeof t) => c.query(api.stats.goals, range),
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
      trackingStartedAt: null,
      keyGoal: null,
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
    const noSessions = { sessions: 0, bounceRate: null, sessionTimeMs: null };
    expect(s.current).toEqual({ visitors: 3, pageviews: 4, timeOnPageMs: 30_000, ...noSessions });
    expect(s.previous).toEqual({ visitors: 1, pageviews: 1, timeOnPageMs: null, ...noSessions });
    expect(s).toMatchObject({ comparable: true, visitorsApprox: false });
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
      { key: "/pricing", pageviews: 3, visitors: 1, sessions: 0, events: 0 },
      { key: "/", pageviews: 2, visitors: 2, sessions: 0, events: 0 },
      { key: "/blog", pageviews: 1, visitors: 0, sessions: 0, events: 0 },
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

  test("entry and exit pages sort by sessions; channels by visitors", async () => {
    const t = await setup();
    const v = (visitorId: string, sessionId: string) => ({ visitorId, sessionId });
    await visit(t, "2026-10-10T17:00:00Z", { ...v("v1", "s1"), referrer: "google.com" });
    await visit(t, "2026-10-10T17:01:00Z", { ...v("v1", "s1"), path: "/pricing", unique: false });
    await visit(t, "2026-10-11T17:00:00Z", { ...v("v2", "s2"), path: "/blog", referrer: "chatgpt.com" });
    await visit(t, "2026-10-11T17:10:00Z", { ...v("v3", "s3"), path: "/blog", referrer: "perplexity.ai" });
    const as = t.withIdentity(OWNER);

    const entry = await as.query(api.stats.breakdown, { ...range, dim: "entry" });
    expect(entry.rows.map((r) => [r.key, r.sessions])).toEqual([
      ["/blog", 2],
      ["/", 1],
    ]);
    expect(entry.totalSessions).toBe(3);

    const exit = await as.query(api.stats.breakdown, { ...range, dim: "exit" });
    // "/" moved to "/pricing" and keeps a row with 0 sessions, which is left out
    expect(exit.rows.map((r) => [r.key, r.sessions])).toEqual([
      ["/blog", 2],
      ["/pricing", 1],
    ]);

    const channels = await as.query(api.stats.breakdown, { ...range, dim: "channel" });
    expect(channels.rows.map((r) => [r.key, r.visitors, r.sessions])).toEqual([
      ["AI", 2, 2],
      ["Organic Search", 1, 1],
    ]);
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

describe("stats.summary with visitor ids", () => {
  const summary = (t: ReturnType<typeof convexTest>, r = range) =>
    t.withIdentity(OWNER).query(api.stats.summary, r);

  test("counts distinct visitors, sessions, bounce rate and session time", async () => {
    const t = await setup();
    // One visitor on two days, three sessions; one session has two pageviews
    await visit(t, "2026-10-11T17:00:00Z", { visitorId: "v1", sessionId: "s1" });
    await visit(t, "2026-10-12T17:00:00Z", { visitorId: "v1", sessionId: "s2" });
    const pv = await visit(t, "2026-10-12T17:10:00Z", { visitorId: "v1", sessionId: "s2" });
    await visit(t, "2026-10-13T17:00:00Z", { visitorId: "v2", sessionId: "s3" });
    await t.mutation(api.ingest.ping, {
      secret: SECRET,
      site: "picai.so",
      hostname: "picai.so",
      pvId: pv,
      ms: 60_000,
    });

    const s = await summary(t);
    // The chart's daily visitors add up to 3; the tile counts 2 distinct ids
    expect(s.current).toMatchObject({
      visitors: 2,
      pageviews: 4,
      sessions: 3,
      bounceRate: 2 / 3,
      sessionTimeMs: 20_000,
    });
  });

  test("adds SA-style visitors from the days before tracking started", async () => {
    const t = await setup();
    await visit(t, "2026-10-10T17:00:00Z"); // old script, unique visit
    await visit(t, "2026-10-10T18:00:00Z"); // old script, unique visit
    await visit(t, "2026-10-12T17:00:00Z", { visitorId: "v1", sessionId: "s1" });
    await visit(t, "2026-10-13T17:00:00Z", { visitorId: "v1", sessionId: "s2" });
    expect((await summary(t)).current.visitors).toBe(3);
  });

  test("hides changes while the previous range starts before tracking", async () => {
    const t = await setup();
    await visit(t, "2026-10-07T17:00:00Z");
    await visit(t, "2026-10-12T17:00:00Z", { visitorId: "v1", sessionId: "s1" });
    expect((await summary(t)).comparable).toBe(false);
    // Once both ranges are after the launch day, they compare again
    expect(
      (await summary(t, { domain: "picai.so", from: "2026-10-16", to: "2026-10-19" })).comparable,
    ).toBe(true);
    // A range entirely before the launch day uses the old definition throughout
    expect(
      (await summary(t, { domain: "picai.so", from: "2026-10-01", to: "2026-10-04" })).comparable,
    ).toBe(true);
  });

  test("the previous range counts its own distinct visitors", async () => {
    const t = await setup();
    await visit(t, "2026-10-01T17:00:00Z", { visitorId: "v0", sessionId: "s0" }); // launch day
    await visit(t, "2026-10-07T17:00:00Z", { visitorId: "v1", sessionId: "s1" });
    await visit(t, "2026-10-08T17:00:00Z", { visitorId: "v1", sessionId: "s2" });
    await visit(t, "2026-10-11T17:00:00Z", { visitorId: "v1", sessionId: "s3" });
    const s = await summary(t);
    expect(s.comparable).toBe(true);
    expect(s.previous).toMatchObject({ visitors: 1, sessions: 2 });
    expect(s.current).toMatchObject({ visitors: 1, sessions: 1 });
  });

  test("sites.get reports when tracking started", async () => {
    const t = await setup();
    await visit(t, "2026-10-12T17:00:00Z", { visitorId: "v1", sessionId: "s1" });
    expect(await t.withIdentity(OWNER).query(api.sites.get, { domain: "picai.so" })).toMatchObject({
      trackingStartedAt: Date.parse("2026-10-12T17:00:00Z"),
    });
  });
});

describe("stats.online", () => {
  test("counts distinct visitors with a pageview or ping since the timestamp", async () => {
    const t = await setup();
    await visit(t, "2026-10-13T16:50:00Z", { visitorId: "v1", sessionId: "s1" });
    const reading = await visit(t, "2026-10-13T16:51:00Z", { visitorId: "v2", sessionId: "s2" });
    await visit(t, "2026-10-13T16:56:00Z", { visitorId: "v3", sessionId: "s3" });
    await visit(t, "2026-10-13T16:57:00Z", { visitorId: "v3", sessionId: "s3" });
    // v2 is still reading the page they opened at 16:51
    vi.setSystemTime(new Date("2026-10-13T16:58:00Z"));
    await t.mutation(api.ingest.ping, {
      secret: SECRET,
      site: "picai.so",
      hostname: "picai.so",
      pvId: reading,
      ms: 60_000,
    });
    const since = Date.parse("2026-10-13T16:55:00Z");
    expect(await t.withIdentity(OWNER).query(api.stats.online, { domain: "picai.so", since })).toBe(2);
  });
});

/** A goal or outbound click on the pageview `pvId`, at the current fake time. */
async function event(
  t: ReturnType<typeof convexTest>,
  pvId: string,
  e: { type: "goal"; name: string } | { type: "outbound"; url: string },
) {
  await t.mutation(api.ingest.event, { secret: SECRET, site: "picai.so", hostname: "picai.so", pvId, event: e });
}

describe("stats.goals", () => {
  test("completions and visitors per goal, and the daily visitors to divide by", async () => {
    const t = await setup();
    const a1 = await visit(t, "2026-10-12T17:00:00Z", { visitorId: "a", sessionId: "a1" });
    await event(t, a1, { type: "goal", name: "signup" });
    const a2 = await visit(t, "2026-10-12T17:05:00Z", { visitorId: "a", sessionId: "a1", path: "/x" });
    await event(t, a2, { type: "goal", name: "signup" });
    await event(t, a2, { type: "goal", name: "newsletter" });
    const b1 = await visit(t, "2026-10-13T17:00:00Z", { visitorId: "b", sessionId: "b1" });
    await event(t, b1, { type: "goal", name: "newsletter" });
    await visit(t, "2026-10-13T17:00:00Z", { visitorId: "c", sessionId: "c1" });
    await visit(t, "2026-10-01T17:00:00Z", { visitorId: "d", sessionId: "d1" }); // outside the range

    expect(await t.withIdentity(OWNER).query(api.stats.goals, range)).toEqual({
      rows: [
        { name: "newsletter", completions: 2, visitors: 2 },
        { name: "signup", completions: 2, visitors: 1 },
      ],
      visitors: 3,
      keyGoal: null,
    });
  });

  test("always lists the key goal, even with no completions", async () => {
    const t = await setup();
    await t.withIdentity(OWNER).mutation(api.sites.setKeyGoal, { domain: "picai.so", keyGoal: "booking" });
    const pv = await visit(t, "2026-10-13T17:00:00Z", { visitorId: "a", sessionId: "a1" });
    await event(t, pv, { type: "goal", name: "signup" });

    const goals = await t.withIdentity(OWNER).query(api.stats.goals, range);
    expect(goals.keyGoal).toBe("booking");
    expect(goals.rows).toEqual([
      { name: "signup", completions: 1, visitors: 1 },
      { name: "booking", completions: 0, visitors: 0 },
    ]);
  });
});

describe("stats.breakdown for outbound links", () => {
  test("sorts by clicks and totals them", async () => {
    const t = await setup();
    const a = await visit(t, "2026-10-13T17:00:00Z", { visitorId: "a", sessionId: "a1" });
    await event(t, a, { type: "outbound", url: "https://x.com/acme" });
    await event(t, a, { type: "outbound", url: "https://github.com/acme" });
    const b = await visit(t, "2026-10-13T17:01:00Z", { visitorId: "a", sessionId: "a1", path: "/b" });
    await event(t, b, { type: "outbound", url: "https://github.com/acme" });

    const out = await t.withIdentity(OWNER).query(api.stats.breakdown, { ...range, dim: "outbound" });
    expect(out.rows.map((r) => [r.key, r.events, r.visitors])).toEqual([
      ["https://github.com/acme", 2, 1],
      ["https://x.com/acme", 1, 1],
    ]);
    expect(out.totalEvents).toBe(3);
  });
});

/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

// Design v4 Phase 6: sessions, entries, bounces and time on the page rows, at ingest and
// from the backfill, and what the Pages tab makes of them.

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test-secret";
const OWNER = { subject: "user_1", tokenIdentifier: "clerk|user_1" };

type T = ReturnType<typeof convexTest>;

async function setup() {
  const t = convexTest(schema, modules);
  await t.withIdentity(OWNER).mutation(api.sites.create, { domain: "picai.so", timezone: "America/Los_Angeles" });
  return t;
}

async function hit(t: T, iso: string, o: { pvId: string; path?: string; vid?: string; sid?: string; cookieless?: boolean }) {
  vi.setSystemTime(new Date(iso));
  await t.mutation(api.ingest.pageview, {
    secret: SECRET,
    site: "picai.so",
    hostname: "picai.so",
    path: o.path ?? "/",
    referrer: "(direct)",
    unique: true,
    device: "desktop",
    browser: "Chrome",
    country: "US",
    pvId: o.pvId,
    visitorId: o.vid,
    sessionId: o.sid,
    cookieless: o.cookieless,
  });
}

async function ping(t: T, iso: string, pvId: string, ms: number) {
  vi.setSystemTime(new Date(iso));
  await t.mutation(api.ingest.ping, { secret: SECRET, site: "picai.so", hostname: "picai.so", pvId, ms });
}

async function goal(t: T, iso: string, pvId: string) {
  vi.setSystemTime(new Date(iso));
  await t.mutation(api.ingest.event, {
    secret: SECRET,
    site: "picai.so",
    hostname: "picai.so",
    pvId,
    event: { type: "goal", name: "signup" },
  });
}

/** Each page row's [date, path, pageviews, sessions, entries, bounces, engagedMs, durationCount]. */
async function pageRows(t: T) {
  return t.run(async (ctx) =>
    (await ctx.db.query("dailyDims").collect())
      .filter((d) => d.dim === "page")
      .map((d) => [
        d.date,
        d.key,
        d.pageviews,
        d.sessions ?? 0,
        d.entries ?? 0,
        d.bounces ?? 0,
        d.engagedMs ?? 0,
        d.durationCount ?? 0,
      ])
      .sort(),
  );
}

beforeEach(() => {
  vi.stubEnv("INGEST_SECRET", SECRET);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("ingest", () => {
  test("a one-pageview session is a session, an entry and a bounce on its page", async () => {
    const t = await setup();
    await hit(t, "2026-10-13T17:00:00Z", { pvId: "a1", vid: "v1", sid: "s1" });
    expect(await pageRows(t)).toEqual([["2026-10-13", "/", 1, 1, 1, 1, 0, 0]]);
  });

  test("a multi-page session counts once per page, and its bounce comes off the entry page", async () => {
    const t = await setup();
    await hit(t, "2026-10-13T17:00:00Z", { pvId: "a1", vid: "v1", sid: "s1" });
    await hit(t, "2026-10-13T17:01:00Z", { pvId: "a2", vid: "v1", sid: "s1", path: "/pricing" });
    await hit(t, "2026-10-13T17:02:00Z", { pvId: "a3", vid: "v1", sid: "s1" });
    expect(await pageRows(t)).toEqual([
      ["2026-10-13", "/", 2, 1, 1, 0, 0, 0],
      ["2026-10-13", "/pricing", 1, 1, 0, 0, 0, 0],
    ]);
  });

  test("a goal takes the bounce off, as a second pageview does", async () => {
    const t = await setup();
    await hit(t, "2026-10-13T17:00:00Z", { pvId: "a1", vid: "v1", sid: "s1" });
    await goal(t, "2026-10-13T17:00:30Z", "a1");
    expect(await pageRows(t)).toEqual([["2026-10-13", "/", 1, 1, 1, 0, 0, 0]]);
  });

  test("pings add engaged time to the pageview's page and day, counting each pageview once", async () => {
    const t = await setup();
    // 23:59 on 12 Oct in LA; the pings come after midnight
    await hit(t, "2026-10-13T06:59:00Z", { pvId: "a1", vid: "v1", sid: "s1", path: "/docs" });
    await ping(t, "2026-10-13T07:00:00Z", "a1", 30_000);
    await ping(t, "2026-10-13T07:00:20Z", "a1", 20_000);
    // Cookieless: time, but no session, entry or bounce
    await hit(t, "2026-10-13T17:00:00Z", { pvId: "b1", cookieless: true });
    await ping(t, "2026-10-13T17:00:10Z", "b1", 10_000);
    expect(await pageRows(t)).toEqual([
      ["2026-10-12", "/docs", 1, 1, 1, 1, 50_000, 1],
      ["2026-10-13", "/", 1, 0, 0, 0, 10_000, 1],
    ]);
  });
});

/** Traffic from before Phase 6 on 12 Oct (LA), with time, goals and a cookieless hit. */
async function oldTraffic(t: T) {
  // s1: / then /pricing then / again, with time on two pageviews
  await hit(t, "2026-10-12T17:00:00Z", { pvId: "a1", vid: "v1", sid: "s1" });
  await ping(t, "2026-10-12T17:00:30Z", "a1", 30_000);
  await hit(t, "2026-10-12T17:01:00Z", { pvId: "a2", vid: "v1", sid: "s1", path: "/pricing" });
  await ping(t, "2026-10-12T17:01:40Z", "a2", 40_000);
  await hit(t, "2026-10-12T17:02:00Z", { pvId: "a3", vid: "v1", sid: "s1" });
  // s2: bounced on /pricing
  await hit(t, "2026-10-12T18:00:00Z", { pvId: "b1", vid: "v2", sid: "s2", path: "/pricing" });
  // s3: one pageview and a goal
  await hit(t, "2026-10-12T19:00:00Z", { pvId: "c1", vid: "v3", sid: "s3", path: "/signup" });
  await goal(t, "2026-10-12T19:00:20Z", "c1");
  // Cookieless, with time
  await hit(t, "2026-10-12T20:00:00Z", { pvId: "d1", cookieless: true, path: "/docs" });
  await ping(t, "2026-10-12T20:00:15Z", "d1", 15_000);
  // s4 and s5 have one pageview each so far; they go on after the deploy
  await hit(t, "2026-10-12T21:00:00Z", { pvId: "e1", vid: "v4", sid: "s4" });
  await hit(t, "2026-10-12T21:10:00Z", { pvId: "f1", vid: "v5", sid: "s5", path: "/blog" });
}

/** Traffic after Phase 6 went live, including sessions and a pageview that started before it. */
async function newTraffic(t: T) {
  await hit(t, "2026-10-12T21:20:00Z", { pvId: "e2", vid: "v4", sid: "s4", path: "/pricing" });
  await goal(t, "2026-10-12T21:20:30Z", "f1");
  await ping(t, "2026-10-12T21:21:00Z", "f1", 20_000);
  await hit(t, "2026-10-13T17:00:00Z", { pvId: "g1", vid: "v6", sid: "s6", path: "/blog" });
}

/** Undoes what Phase 6's ingest wrote, leaving the page rows as they were before it. */
async function stripPageStats(t: T) {
  await t.run(async (ctx) => {
    for (const d of await ctx.db.query("dailyDims").collect()) {
      if (d.dim !== "page") continue;
      await ctx.db.patch("dailyDims", d._id, {
        sessions: undefined,
        entries: undefined,
        bounces: undefined,
        engagedMs: undefined,
        durationCount: undefined,
      });
    }
    for (const s of await ctx.db.query("sites").collect()) {
      await ctx.db.patch("sites", s._id, { pageStatsStartedAt: undefined });
    }
  });
}

async function backfill(t: T) {
  await t.mutation(internal.migrations.backfillPageStats, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

describe("migrations.backfillPageStats", () => {
  test("rebuilds the same page rows as Phase 6's ingest, across the cutoff", async () => {
    const live = await setup();
    await oldTraffic(live);
    await newTraffic(live);
    const expected = await pageRows(live);

    const t = await setup();
    await oldTraffic(t);
    await stripPageStats(t);
    await newTraffic(t);
    await backfill(t);

    expect(await pageRows(t)).toEqual(expected);
    // Spot checks on the expected rows themselves
    expect(expected).toEqual([
      ["2026-10-12", "/", 3, 2, 2, 0, 30_000, 1],
      ["2026-10-12", "/blog", 1, 1, 1, 0, 20_000, 1],
      ["2026-10-12", "/docs", 1, 0, 0, 0, 15_000, 1],
      ["2026-10-12", "/pricing", 3, 3, 1, 1, 40_000, 1],
      ["2026-10-12", "/signup", 1, 1, 1, 0, 0, 0],
      ["2026-10-13", "/blog", 1, 1, 1, 1, 0, 0],
    ]);
  });

  test("entries and bounces add up to the site's sessions and bounces", async () => {
    const t = await setup();
    await oldTraffic(t);
    await stripPageStats(t);
    await newTraffic(t);
    await backfill(t);

    const { stats, rows } = await t.run(async (ctx) => ({
      stats: await ctx.db.query("dailyStats").collect(),
      rows: (await ctx.db.query("dailyDims").collect()).filter((d) => d.dim === "page"),
    }));
    for (const day of stats) {
      const onDay = rows.filter((r) => r.date === day.date);
      expect(onDay.reduce((n, r) => n + (r.entries ?? 0), 0)).toBe(day.sessions);
      expect(onDay.reduce((n, r) => n + (r.bounces ?? 0), 0)).toBe(day.bounces);
      expect(onDay.reduce((n, r) => n + (r.engagedMs ?? 0), 0)).toBe(day.durationSumMs);
      expect(onDay.reduce((n, r) => n + (r.durationCount ?? 0), 0)).toBe(day.durationCount);
    }
  });

  test("works for a site with no traffic since, and running it twice changes nothing", async () => {
    const live = await setup();
    await oldTraffic(live);
    const expected = await pageRows(live);

    const t = await setup();
    await oldTraffic(t);
    await stripPageStats(t);
    vi.setSystemTime(new Date("2026-10-20T00:00:00Z"));
    await backfill(t);
    await backfill(t);

    expect(await pageRows(t)).toEqual(expected);
  });
});

describe("pages.list", () => {
  const list = (t: T, range: { from: string; to: string }, filters: { dim: "country"; value: string }[] = []) =>
    t.withIdentity(OWNER).query(api.pages.list, {
      domain: "picai.so",
      range,
      filters,
      sort: "views",
      desc: true,
      search: "",
      offset: 0,
    });

  test("sessions with their change, bounce, duration and the tiles", async () => {
    const t = await setup();
    // 11 Oct: two sessions on /pricing, before the range's previous day
    await hit(t, "2026-10-11T17:00:00Z", { pvId: "p1", vid: "v1", sid: "s0", path: "/pricing" });
    await hit(t, "2026-10-11T17:05:00Z", { pvId: "p2", vid: "v9", sid: "s9", path: "/pricing" });
    await oldTraffic(t);
    await newTraffic(t);

    const result = await list(t, { from: "2026-10-12", to: "2026-10-12" });
    if (result.status !== "ok") throw new Error(result.status);
    const rows = Object.fromEntries(result.rows.map((r) => [r.path, r]));
    expect(rows["/"]).toMatchObject({ views: 3, sessions: 2, sessionsChange: null, bounceRate: 0, durationMs: 30_000 });
    // 3 sessions against 2 the day before; 1 of the 1 that started there bounced
    expect(rows["/pricing"]).toMatchObject({ sessions: 3, sessionsChange: 0.5, bounceRate: 1, durationMs: 40_000 });
    // Cookieless only: duration, but no sessions or bounce
    expect(rows["/docs"]).toMatchObject({ sessions: 0, bounceRate: null, durationMs: 15_000 });
    expect(result.pages).toBe(5);
    expect(result.tiles).toEqual({
      pageviews: 9,
      previousPageviews: 2,
      sessions: 5,
      bounceRate: 0.2,
      timeOnPageMs: Math.round(105_000 / 4),
    });

    // The filtered view counts the same pages the same way
    const filtered = await list(t, { from: "2026-10-12", to: "2026-10-12" }, [{ dim: "country", value: "US" }]);
    if (filtered.status !== "ok") throw new Error(filtered.status);
    const f = Object.fromEntries(filtered.rows.map((r) => [r.path, r]));
    expect(f["/pricing"]).toMatchObject({ sessions: 3, sessionsChange: 0.5, bounceRate: 1, durationMs: 40_000 });
    expect(f["/"]).toMatchObject({ sessions: 2, bounceRate: 0, durationMs: 30_000 });
    expect(filtered.tiles).toMatchObject({ sessions: 5, bounceRate: 0.2 });
  });
});

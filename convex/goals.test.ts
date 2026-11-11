/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { goalTiles, parseGoal } from "./lib/goals";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test-secret";
const OWNER = { subject: "user_1", tokenIdentifier: "clerk|user_1" };
const STRANGER = { subject: "user_2", tokenIdentifier: "clerk|user_2" };
const DOMAIN = "picai.so";

type Hit = { visitorId?: string; sessionId?: string; path?: string; referrer?: string };

let pvCounter = 0;

/** One pageview at `iso` through the real ingest mutation. */
async function visit(t: ReturnType<typeof convexTest>, iso: string, h: Hit = {}) {
  vi.setSystemTime(new Date(iso));
  const pvId = `pv-${++pvCounter}`;
  await t.mutation(api.ingest.pageview, {
    secret: SECRET,
    site: DOMAIN,
    hostname: DOMAIN,
    path: h.path ?? "/",
    referrer: h.referrer ?? "(direct)",
    unique: true,
    device: "desktop",
    browser: "Chrome",
    country: "US",
    pvId,
    visitorId: h.visitorId,
    sessionId: h.sessionId,
  });
  return pvId;
}

async function goal(t: ReturnType<typeof convexTest>, pvId: string, name: string) {
  await t.mutation(api.ingest.event, {
    secret: SECRET,
    site: DOMAIN,
    hostname: DOMAIN,
    pvId,
    event: { type: "goal", name },
  });
}

async function setup() {
  const t = convexTest(schema, modules);
  await t.withIdentity(OWNER).mutation(api.sites.create, { domain: DOMAIN, timezone: "America/Los_Angeles" });
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

// Los Angeles is UTC-7 in October, so 17:00Z is 10:00 local on the same date
const range = { from: "2026-10-10", to: "2026-10-13" };
const overviewArgs = { domain: DOMAIN, range, filters: [] };

/**
 * Three visitors: a from Google signs up twice and views /pricing, b from Hacker News
 * signs up and subscribes to the newsletter, c comes direct, views /pricing twice and
 * clicks "demo". d is outside the range.
 */
async function seed(t: ReturnType<typeof convexTest>) {
  const a1 = await visit(t, "2026-10-12T17:00:00Z", { visitorId: "a", sessionId: "a1", referrer: "www.google.com" });
  await goal(t, a1, "signup");
  const a2 = await visit(t, "2026-10-12T17:05:00Z", { visitorId: "a", sessionId: "a1", path: "/pricing" });
  await goal(t, a2, "signup");
  const b1 = await visit(t, "2026-10-13T17:00:00Z", {
    visitorId: "b",
    sessionId: "b1",
    referrer: "news.ycombinator.com",
  });
  await goal(t, b1, "signup");
  await goal(t, b1, "newsletter");
  await visit(t, "2026-10-13T18:00:00Z", { visitorId: "c", sessionId: "c1", path: "/pricing" });
  const c2 = await visit(t, "2026-10-13T18:01:00Z", { visitorId: "c", sessionId: "c1", path: "/pricing" });
  await goal(t, c2, "demo");
  const d = await visit(t, "2026-10-01T17:00:00Z", { visitorId: "d", sessionId: "d1", path: "/pricing" });
  await goal(t, d, "signup");
}

describe("goals list", () => {
  test("create, list and remove, keyed by kind and cleaned key", async () => {
    const t = await setup();
    const owner = t.withIdentity(OWNER);
    vi.setSystemTime(new Date("2026-10-13T00:00:00Z"));
    const signup = await owner.mutation(api.goals.create, { domain: DOMAIN, kind: "event", key: " signup ", name: "Signup" });
    vi.setSystemTime(new Date("2026-10-13T00:01:00Z"));
    await owner.mutation(api.goals.create, { domain: DOMAIN, kind: "page", key: "pricing/?ref=x" });
    // The same goal again is the same row
    expect(await owner.mutation(api.goals.create, { domain: DOMAIN, kind: "event", key: "signup" })).toBe(signup);

    const list = await owner.query(api.goals.list, { domain: DOMAIN });
    expect(list.map(({ kind, key, name }) => ({ kind, key, name }))).toEqual([
      { kind: "event", key: "signup", name: "Signup" },
      { kind: "page", key: "/pricing", name: "/pricing" },
    ]);

    await owner.mutation(api.goals.remove, { domain: DOMAIN, id: signup });
    expect((await owner.query(api.goals.list, { domain: DOMAIN })).map((g) => g.key)).toEqual(["/pricing"]);
  });

  test("only the site's owner can read or change its goals", async () => {
    const t = await setup();
    const id = await t.withIdentity(OWNER).mutation(api.goals.create, { domain: DOMAIN, kind: "event", key: "signup" });
    const stranger = t.withIdentity(STRANGER);
    await expect(stranger.query(api.goals.list, { domain: DOMAIN })).rejects.toThrow("Site not found");
    await expect(stranger.mutation(api.goals.create, { domain: DOMAIN, kind: "event", key: "x" })).rejects.toThrow(
      "Site not found",
    );
    await expect(stranger.mutation(api.goals.remove, { domain: DOMAIN, id })).rejects.toThrow("Site not found");
    await t.withIdentity(STRANGER).mutation(api.accounts.ensure, {});
    await expect(stranger.query(api.goals.overview, overviewArgs)).rejects.toThrow("Site not found");
  });

  test("rejects empty keys, wildcards and long names", () => {
    expect(() => parseGoal("event", "  ", undefined)).toThrow("Enter an event name");
    expect(() => parseGoal("page", "/blog/*", undefined)).toThrow("exact path");
    expect(() => parseGoal("event", "x".repeat(101), undefined)).toThrow("at most 100");
    expect(() => parseGoal("event", "signup", "y".repeat(61))).toThrow("at most 60");
    expect(parseGoal("page", "", undefined)).toEqual({ key: "/", name: "/" });
  });
});

describe("goals.overview", () => {
  test("conversions, visitors and top source per goal; the rest are other events", async () => {
    const t = await setup();
    await seed(t);
    const owner = t.withIdentity(OWNER);
    await owner.mutation(api.goals.create, { domain: DOMAIN, kind: "event", key: "signup", name: "Signup" });
    await owner.mutation(api.goals.create, { domain: DOMAIN, kind: "page", key: "/pricing", name: "Viewed pricing" });

    const view = await owner.query(api.goals.overview, overviewArgs);
    if (view.status !== "ok") throw new Error(view.status);
    expect(view.rows.map(({ kind, key, name, conversions, visitors, topSource }) => ({
      kind,
      key,
      name,
      conversions,
      visitors,
      topSource,
    }))).toEqual([
      // a twice from Google, b once from Hacker News
      { kind: "event", key: "signup", name: "Signup", conversions: 3, visitors: 2, topSource: "Google" },
      // c twice direct, a once from Google
      { kind: "page", key: "/pricing", name: "Viewed pricing", conversions: 3, visitors: 2, topSource: "Direct" },
    ]);
    expect(view.others).toEqual([
      { name: "demo", events: 1, visitors: 1 },
      { name: "newsletter", events: 1, visitors: 1 },
    ]);
    expect(view.visitors).toBe(3);

    // The same numbers the Events card shows (stats.goals)
    const card = await owner.query(api.stats.goals, { domain: DOMAIN, ...range });
    expect(card.rows.find((r) => r.name === "signup")).toEqual({ name: "signup", completions: 3, visitors: 2 });
    expect(card.visitors).toBe(view.visitors);
  });

  test("making an other event a goal moves it into the table", async () => {
    const t = await setup();
    await seed(t);
    const owner = t.withIdentity(OWNER);
    const before = await owner.query(api.goals.overview, overviewArgs);
    if (before.status !== "ok") throw new Error(before.status);
    expect(before.rows).toEqual([]);
    expect(before.others.map((o) => o.name)).toEqual(["signup", "demo", "newsletter"]);

    await owner.mutation(api.goals.create, { domain: DOMAIN, kind: "event", key: "newsletter" });
    const after = await owner.query(api.goals.overview, overviewArgs);
    if (after.status !== "ok") throw new Error(after.status);
    expect(after.rows.map((r) => [r.key, r.conversions, r.topSource])).toEqual([["newsletter", 1, "Hacker News"]]);
    expect(after.others.map((o) => o.name)).toEqual(["signup", "demo"]);
  });

  test("a goal with nothing in the range has zeros and no source", async () => {
    const t = await setup();
    await seed(t);
    const owner = t.withIdentity(OWNER);
    await owner.mutation(api.goals.create, { domain: DOMAIN, kind: "event", key: "purchase" });
    const view = await owner.query(api.goals.overview, overviewArgs);
    if (view.status !== "ok") throw new Error(view.status);
    expect(view.rows.map((r) => [r.key, r.conversions, r.visitors, r.topSource])).toEqual([["purchase", 0, 0, null]]);
  });

  test("with a filter, counts only the matching sessions", async () => {
    const t = await setup();
    await seed(t);
    const owner = t.withIdentity(OWNER);
    await owner.mutation(api.goals.create, { domain: DOMAIN, kind: "event", key: "signup" });
    await owner.mutation(api.goals.create, { domain: DOMAIN, kind: "page", key: "/pricing" });
    const view = await owner.query(api.goals.overview, {
      ...overviewArgs,
      filters: [{ dim: "source", value: "Google" }],
    });
    if (view.status !== "ok") throw new Error(view.status);
    expect(view.rows.map((r) => [r.key, r.conversions, r.visitors, r.topSource])).toEqual([
      ["signup", 2, 1, "Google"],
      ["/pricing", 1, 1, "Google"],
    ]);
    expect(view.others).toEqual([]);
    expect(view.visitors).toBe(1);
  });

  test("hour ranges read the raw rows", async () => {
    const t = await setup();
    await seed(t);
    const owner = t.withIdentity(OWNER);
    await owner.mutation(api.goals.create, { domain: DOMAIN, kind: "event", key: "signup" });
    // Today in Los Angeles is Oct 13, up to 12:00 local
    const view = await owner.query(api.goals.overview, {
      domain: DOMAIN,
      range: { period: "today", now: Date.parse("2026-10-13T18:30:00Z") },
      filters: [],
    });
    if (view.status !== "ok") throw new Error(view.status);
    expect(view.rows.map((r) => [r.key, r.conversions, r.topSource])).toEqual([["signup", 1, "Hacker News"]]);
    expect(view.others.map((o) => o.name)).toEqual(["demo", "newsletter"]);
  });

  test("filters on more than 90 days are refused", async () => {
    const t = await setup();
    const view = await t.withIdentity(OWNER).query(api.goals.overview, {
      domain: DOMAIN,
      range: { from: "2026-01-01", to: "2026-10-13" },
      filters: [{ dim: "source", value: "Google" }],
    });
    expect(view).toEqual({ status: "range" });
  });

  test("deleting the site deletes its goals", async () => {
    const t = await setup();
    await t.withIdentity(OWNER).mutation(api.goals.create, { domain: DOMAIN, kind: "event", key: "signup" });
    await t.withIdentity(OWNER).mutation(api.sites.remove, { domain: DOMAIN });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.query("goals").collect())).toEqual([]);
  });
});

describe("goalTiles", () => {
  test("tracked by kind, total conversions and the average rate", () => {
    const rows = [
      { kind: "event" as const, conversions: 402, visitors: 74 },
      { kind: "event" as const, conversions: 87, visitors: 16 },
      { kind: "page" as const, conversions: 1600, visitors: 298 },
    ];
    expect(goalTiles(rows, 1000)).toEqual({
      tracked: 3,
      events: 2,
      pageviews: 1,
      conversions: 2089,
      avgRate: (0.074 + 0.016 + 0.298) / 3,
    });
    expect(goalTiles([], 1000).avgRate).toBeNull();
    expect(goalTiles(rows, 0).avgRate).toBeNull();
  });
});

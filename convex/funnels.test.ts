/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import {
  funnelCounts,
  funnelStats,
  MAX_FUNNELS,
  parseFunnel,
  stepsReached,
  windowLabel,
  type FunnelStep,
  type Hit,
} from "./lib/funnels";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test-secret";
const OWNER = { subject: "user_1", tokenIdentifier: "clerk|user_1" };
const STRANGER = { subject: "user_2", tokenIdentifier: "clerk|user_2" };
const DOMAIN = "picai.so";
const HOUR = 60 * 60 * 1000;

const page = (pattern: string): FunnelStep => ({ kind: "page", pattern });
const event = (name: string): FunnelStep => ({ kind: "event", name });
const pv = (h: number, key: string, entry = true): Hit => ({ ts: h * HOUR, kind: "page", key, entry });
const ev = (h: number, key: string, entry = true): Hit => ({ ts: h * HOUR, kind: "event", key, entry });

const SIGNUP = [page("/"), page("/pricing"), page("/signup/*"), event("signup")];

describe("stepsReached", () => {
  test("counts the steps in order", () => {
    const hits = [pv(0, "/"), pv(1, "/pricing"), pv(2, "/signup/team"), ev(2, "signup")];
    expect(stepsReached(hits, SIGNUP, 24 * HOUR)).toBe(4);
  });

  test("a skipped step ends the funnel there, even if later steps happen", () => {
    const hits = [pv(0, "/"), pv(1, "/signup/team"), ev(2, "signup")];
    expect(stepsReached(hits, SIGNUP, 24 * HOUR)).toBe(1);
  });

  test("steps out of order don't count until they come in order", () => {
    const hits = [pv(0, "/pricing"), pv(1, "/"), pv(2, "/signup"), pv(3, "/pricing")];
    expect(stepsReached(hits, SIGNUP, 24 * HOUR)).toBe(2);
  });

  test("a later step past the window from entry doesn't count", () => {
    const hits = [pv(0, "/"), pv(1, "/pricing"), pv(25, "/signup")];
    expect(stepsReached(hits, SIGNUP, 24 * HOUR)).toBe(2);
    // Exactly on the window still counts
    expect(stepsReached([pv(0, "/"), pv(24, "/pricing")], SIGNUP, 24 * HOUR)).toBe(2);
  });

  test("a later entry can still finish in its own window (the furthest attempt counts)", () => {
    const hits = [pv(0, "/"), pv(30, "/"), pv(31, "/pricing"), pv(32, "/signup"), ev(32, "signup")];
    expect(stepsReached(hits, SIGNUP, 24 * HOUR)).toBe(4);
  });

  test("only entries in the range count; later steps may fall outside it", () => {
    const hits = [pv(0, "/", false), pv(1, "/pricing", false)];
    expect(stepsReached(hits, SIGNUP, 24 * HOUR)).toBe(0);
    expect(stepsReached([pv(0, "/"), pv(1, "/pricing", false)], SIGNUP, 24 * HOUR)).toBe(2);
  });

  test("wildcards: * matches anything, a trailing /* the bare prefix too", () => {
    const steps = [page("/blog/*"), page("/docs/*/setup")];
    expect(stepsReached([pv(0, "/blog"), pv(1, "/docs/a/b/setup")], steps, HOUR * 2)).toBe(2);
    expect(stepsReached([pv(0, "/blog/x/y"), pv(1, "/docs/setup")], steps, HOUR * 2)).toBe(1);
    expect(stepsReached([pv(0, "/blogger")], steps, HOUR)).toBe(0);
    // No * means that exact path
    expect(stepsReached([pv(0, "/pricing/team")], [page("/pricing"), page("/")], HOUR)).toBe(0);
  });

  test("event steps match events by name, never pageviews", () => {
    const steps = [event("signup"), page("/welcome")];
    expect(stepsReached([pv(0, "signup"), pv(1, "/welcome")], steps, HOUR * 2)).toBe(0);
    expect(stepsReached([ev(0, "signup"), pv(1, "/welcome")], steps, HOUR * 2)).toBe(2);
    expect(stepsReached([ev(0, "Signup")], steps, HOUR)).toBe(0);
  });

  test("one hit can't fill two steps", () => {
    expect(stepsReached([pv(0, "/a")], [page("/*"), page("/a")], HOUR)).toBe(1);
    expect(stepsReached([pv(0, "/a"), pv(0, "/a")], [page("/*"), page("/a")], HOUR)).toBe(2);
  });
});

describe("funnelStats", () => {
  test("shares, drop-offs and the headline numbers", () => {
    const { steps, entered, completed, conversion } = funnelStats([10, 5, 2]);
    expect(steps).toEqual([
      { count: 10, ofEntered: 1, ofPrevious: 1, dropped: 0 },
      { count: 5, ofEntered: 0.5, ofPrevious: 0.5, dropped: 5 },
      { count: 2, ofEntered: 0.2, ofPrevious: 0.4, dropped: 3 },
    ]);
    expect({ entered, completed, conversion }).toEqual({ entered: 10, completed: 2, conversion: 0.2 });
  });

  test("nobody entered", () => {
    const { steps, conversion } = funnelStats([0, 0]);
    expect(steps[1]).toEqual({ count: 0, ofEntered: 0, ofPrevious: 0, dropped: 0 });
    expect(conversion).toBe(0);
  });

  test("counts per step from several visitors", () => {
    const journeys = [
      [pv(0, "/"), pv(1, "/pricing")],
      [pv(0, "/")],
      [pv(0, "/pricing")],
      [pv(0, "/"), pv(1, "/pricing"), pv(2, "/signup"), ev(3, "signup")],
    ];
    expect(funnelCounts(journeys, SIGNUP, 24)).toEqual([3, 2, 1, 1]);
  });
});

describe("parseFunnel", () => {
  test("cleans the name, steps and window", () => {
    expect(parseFunnel("  Signup ", [page("/blog/**/"), event(" signup ")], undefined)).toEqual({
      name: "Signup",
      steps: [page("/blog/*"), event("signup")],
      windowHours: 24,
    });
  });

  test("refuses bad input", () => {
    expect(() => parseFunnel("", SIGNUP, 24)).toThrow("name");
    expect(() => parseFunnel("x", [page("/")], 24)).toThrow("2 to 8 steps");
    expect(() => parseFunnel("x", Array.from({ length: 9 }, () => page("/")), 24)).toThrow("2 to 8 steps");
    expect(() => parseFunnel("x", [page("/"), page("pricing")], 24)).toThrow("Step 2");
    expect(() => parseFunnel("x", [page("/"), event(" ")], 24)).toThrow("Step 2: Enter an event name");
    expect(() => parseFunnel("x", SIGNUP, 0)).toThrow("window");
    expect(() => parseFunnel("x", SIGNUP, 1.5)).toThrow("window");
    expect(() => parseFunnel("x", SIGNUP, 721)).toThrow("window");
  });

  test("window labels", () => {
    expect([windowLabel(1), windowLabel(24), windowLabel(48), windowLabel(36)]).toEqual([
      "1 hour",
      "24 hours",
      "2 days",
      "36 hours",
    ]);
  });
});

// Through the real mutations and ingest

let pvCounter = 0;

async function visit(t: ReturnType<typeof convexTest>, iso: string, visitorId: string | undefined, path: string) {
  vi.setSystemTime(new Date(iso));
  const pvId = `pv-${++pvCounter}`;
  await t.mutation(api.ingest.pageview, {
    secret: SECRET,
    site: DOMAIN,
    hostname: DOMAIN,
    path,
    referrer: "(direct)",
    unique: true,
    device: "desktop",
    browser: "Chrome",
    country: "US",
    pvId,
    visitorId,
    sessionId: visitorId && `${visitorId}-s`,
  });
  return pvId;
}

async function goal(t: ReturnType<typeof convexTest>, iso: string, pvId: string, name: string) {
  vi.setSystemTime(new Date(iso));
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

const STEPS = [page("/"), page("/pricing"), page("/checkout/*"), event("purchase")];
// Los Angeles is UTC-7 in October, so 17:00Z is 10:00 local on the same date
const range = { from: "2026-10-10", to: "2026-10-13" };

describe("funnels", () => {
  test("create and list, oldest first, for the owner only", async () => {
    const t = await setup();
    const owner = t.withIdentity(OWNER);
    vi.setSystemTime(new Date("2026-10-12T00:00:00Z"));
    const a = await owner.mutation(api.funnels.create, { domain: DOMAIN, name: "Purchase", steps: STEPS });
    vi.setSystemTime(new Date("2026-10-12T01:00:00Z"));
    await owner.mutation(api.funnels.create, { domain: DOMAIN, name: "Blog", steps: STEPS.slice(0, 2), windowHours: 2 });
    const list = await owner.query(api.funnels.list, { domain: DOMAIN });
    expect(list.map((f) => [f.name, f.windowHours, f.steps.length])).toEqual([
      ["Purchase", 24, 4],
      ["Blog", 2, 2],
    ]);
    expect(list[0].id).toBe(a);

    const stranger = t.withIdentity(STRANGER);
    await stranger.mutation(api.accounts.ensure, {});
    await expect(stranger.query(api.funnels.list, { domain: DOMAIN })).rejects.toThrow("Site not found");
    await expect(
      stranger.mutation(api.funnels.create, { domain: DOMAIN, name: "x", steps: STEPS }),
    ).rejects.toThrow("Site not found");
    await expect(stranger.query(api.funnels.results, { domain: DOMAIN, range })).rejects.toThrow("Site not found");
    await expect(t.query(api.funnels.list, { domain: DOMAIN })).rejects.toThrow();
  });

  test(`at most ${MAX_FUNNELS} funnels a site`, async () => {
    const t = await setup();
    const owner = t.withIdentity(OWNER);
    for (let i = 0; i < MAX_FUNNELS; i++) {
      await owner.mutation(api.funnels.create, { domain: DOMAIN, name: `F${i}`, steps: STEPS });
    }
    await expect(owner.mutation(api.funnels.create, { domain: DOMAIN, name: "one more", steps: STEPS })).rejects.toThrow(
      `at most ${MAX_FUNNELS} funnels`,
    );
  });

  test("a scripted journey: three pages and an event; skipping or running late drops out", async () => {
    const t = await setup();
    const owner = t.withIdentity(OWNER);
    const id = await owner.mutation(api.funnels.create, { domain: DOMAIN, name: "Purchase", steps: STEPS });

    // a: every step in order within an hour
    await visit(t, "2026-10-11T17:00:00Z", "a", "/");
    await visit(t, "2026-10-11T17:05:00Z", "a", "/pricing");
    const a3 = await visit(t, "2026-10-11T17:10:00Z", "a", "/checkout/pro");
    await goal(t, "2026-10-11T17:11:00Z", a3, "purchase");
    // b: skips /pricing
    await visit(t, "2026-10-12T17:00:00Z", "b", "/");
    const b2 = await visit(t, "2026-10-12T17:05:00Z", "b", "/checkout/pro");
    await goal(t, "2026-10-12T17:06:00Z", b2, "purchase");
    // c: reaches checkout exactly 24 hours after entering (still in), buys an hour later (out)
    await visit(t, "2026-10-12T17:00:00Z", "c", "/");
    await visit(t, "2026-10-12T18:00:00Z", "c", "/pricing");
    const c3 = await visit(t, "2026-10-13T17:00:00Z", "c", "/checkout");
    await goal(t, "2026-10-13T18:00:00Z", c3, "purchase");
    // d: enters before the range, finishes in it: not counted
    await visit(t, "2026-10-09T17:00:00Z", "d", "/");
    await visit(t, "2026-10-10T08:00:00Z", "d", "/pricing");
    // e: enters on the last day, finishes the next morning (after the range, within the window)
    await visit(t, "2026-10-14T05:00:00Z", "e", "/");
    await visit(t, "2026-10-14T16:00:00Z", "e", "/pricing");
    // A cookieless pageview of / doesn't count
    await visit(t, "2026-10-12T17:00:00Z", undefined, "/");

    const result = await owner.query(api.funnels.results, { domain: DOMAIN, range });
    // a, b, c and e entered; a, c and e reached /pricing; a and c checkout; only a bought
    expect(result).toMatchObject({ status: "ok", funnels: [{ id, counts: [4, 3, 2, 1] }] });
    if (result.status === "ok") expect(result.read).toBeGreaterThan(0);

    // A wider window lets c finish
    const wide = await owner.mutation(api.funnels.create, {
      domain: DOMAIN,
      name: "Purchase, 2 days",
      steps: STEPS,
      windowHours: 48,
    });
    const again = await owner.query(api.funnels.results, { domain: DOMAIN, range });
    expect(again.status === "ok" && again.funnels.find((f) => f.id === wide)?.counts).toEqual([4, 3, 2, 2]);
  });

  test("hour ranges count entries in the hours", async () => {
    const t = await setup();
    const owner = t.withIdentity(OWNER);
    await owner.mutation(api.funnels.create, { domain: DOMAIN, name: "Two", steps: STEPS.slice(0, 2) });
    await visit(t, "2026-10-12T10:00:00Z", "a", "/"); // 03:00 local on the 12th
    await visit(t, "2026-10-12T10:30:00Z", "a", "/pricing");
    await visit(t, "2026-10-11T10:00:00Z", "b", "/"); // the day before
    const now = Date.parse("2026-10-12T12:00:00Z");
    const result = await owner.query(api.funnels.results, { domain: DOMAIN, range: { period: "today", now } });
    expect(result).toMatchObject({ status: "ok", funnels: [{ counts: [1, 1] }] });
  });

  test("cookieless sites get no funnels", async () => {
    const t = await setup();
    const owner = t.withIdentity(OWNER);
    await owner.mutation(api.sites.setCookieless, { domain: DOMAIN, cookieless: true });
    expect(await owner.query(api.funnels.results, { domain: DOMAIN, range })).toEqual({ status: "cookieless" });
  });

  test("no funnels yet", async () => {
    const t = await setup();
    expect(await t.withIdentity(OWNER).query(api.funnels.results, { domain: DOMAIN, range })).toEqual({
      status: "ok",
      funnels: [],
      read: 0,
    });
  });
});

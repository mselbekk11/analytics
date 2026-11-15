/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { signupMatches, signupTiles, toSignupRow } from "./lib/signups";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test-secret";
const OWNER = { subject: "user_1", tokenIdentifier: "clerk|user_1" };
const STRANGER = { subject: "user_2", tokenIdentifier: "clerk|user_2" };
const DOMAIN = "picai.so";
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Los Angeles is UTC-7 in October, so 17:00Z is 10:00 local on the same date
const WEEK = { from: "2026-10-07", to: "2026-10-13" };
const BEFORE = { from: "2026-09-30", to: "2026-10-06" };

type T = ReturnType<typeof convexTest>;

let counter = 0;

async function visit(
  t: T,
  iso: string,
  o: { vid: string; sid?: string; path?: string; referrer?: string; country?: string },
): Promise<string> {
  vi.setSystemTime(new Date(iso));
  const pvId = `pv-${++counter}`;
  await t.mutation(api.ingest.pageview, {
    secret: SECRET,
    site: DOMAIN,
    hostname: DOMAIN,
    path: o.path ?? "/",
    referrer: o.referrer ?? "(direct)",
    unique: true,
    device: "desktop",
    browser: "Chrome",
    country: o.country ?? "US",
    pvId,
    visitorId: o.vid,
    sessionId: o.sid ?? `${o.vid}-s`,
  });
  return pvId;
}

async function identify(t: T, iso: string, pvId: string, user: { email?: string; userId?: string; name?: string }) {
  vi.setSystemTime(new Date(iso));
  await t.mutation(api.ingest.event, {
    secret: SECRET,
    site: DOMAIN,
    hostname: DOMAIN,
    pvId,
    event: { type: "identify", ...user },
  });
}

async function setup(opts: { payments?: boolean } = {}) {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity(OWNER);
  await owner.mutation(api.sites.create, { domain: DOMAIN, timezone: "America/Los_Angeles" });
  type Pay = (iso: string, p: { id: string; amountMinor: number; visitorId?: string; email?: string }) => Promise<void>;
  let pay: Pay = async () => {};
  if (opts.payments) {
    await owner.mutation(api.sites.setRevenue, { domain: DOMAIN, revenueSource: "api", currency: "USD" });
    const key = await owner.action(api.sites.createApiKey, { domain: DOMAIN });
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
    const keyHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    pay = async (iso, p) => {
      vi.setSystemTime(new Date(iso));
      await t.mutation(api.payments.recordApi, {
        secret: SECRET,
        keyHash,
        payment: { currency: "USD", ts: Date.parse(iso), ...p },
      });
    };
  }
  return { t, owner, pay };
}

async function visitor(t: T, visitorId: string) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("visitors")
      .filter((q) => q.eq(q.field("visitorId"), visitorId))
      .unique(),
  );
}

type Owner = ReturnType<T["withIdentity"]>;
type Range = { from: string; to: string } | { period: "today" | "yesterday" | "24h"; now: number };

async function ok(owner: Owner, opts: { range?: Range; search?: string; offset?: number } = {}) {
  const result = await owner.query(api.signups.list, {
    domain: DOMAIN,
    range: opts.range ?? WEEK,
    search: opts.search ?? "",
    offset: opts.offset ?? 0,
  });
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

describe("signup detection at ingest", () => {
  test("the first identify() with an email or user id is the signup, with its pages", async () => {
    const { t } = await setup();
    await visit(t, "2026-10-10T17:00:00Z", { vid: "a", path: "/blog/post" });
    const pv = await visit(t, "2026-10-11T17:00:00Z", { vid: "a", sid: "a-2", path: "/welcome" });
    // A name alone isn't a signup
    await identify(t, "2026-10-11T17:01:00Z", pv, { name: "Ann" });
    expect((await visitor(t, "a"))?.identifiedAt).toBeUndefined();
    // Nor is an email without an @
    await identify(t, "2026-10-11T17:01:30Z", pv, { email: "not-an-email" });
    expect((await visitor(t, "a"))?.identifiedAt).toBeUndefined();

    await identify(t, "2026-10-11T17:02:00Z", pv, { email: "Ann@Example.com" });
    const a = await visitor(t, "a");
    expect(a?.identifiedAt).toBe(Date.parse("2026-10-11T17:02:00Z"));
    expect(a?.signupPath).toBe("/welcome");
    expect(a?.landingPath).toBe("/blog/post"); // the first session's entry, not this one's
    expect(a?.email).toBe("ann@example.com");
  });

  test("a user id alone counts", async () => {
    const { t } = await setup();
    const pv = await visit(t, "2026-10-10T17:00:00Z", { vid: "u" });
    await identify(t, "2026-10-10T17:05:00Z", pv, { userId: "user_42" });
    expect((await visitor(t, "u"))?.identifiedAt).toBe(Date.parse("2026-10-10T17:05:00Z"));
  });

  test("re-identifying the same visitor doesn't move the signup or count it twice", async () => {
    const { t, owner } = await setup();
    const pv1 = await visit(t, "2026-10-10T17:00:00Z", { vid: "a", path: "/signup" });
    await identify(t, "2026-10-10T17:01:00Z", pv1, { email: "ann@example.com" });
    const pv2 = await visit(t, "2026-10-12T17:00:00Z", { vid: "a", sid: "a-2", path: "/app" });
    await identify(t, "2026-10-12T17:01:00Z", pv2, { email: "ann@work.example.com", userId: "u1" });
    await identify(t, "2026-10-12T17:02:00Z", pv2, { email: "ann@example.com" });
    const a = await visitor(t, "a");
    expect(a?.identifiedAt).toBe(Date.parse("2026-10-10T17:01:00Z"));
    expect(a?.signupPath).toBe("/signup");
    const result = await ok(owner);
    expect(result.totals.signups).toBe(1);
    expect(result.rows.map((r) => r.visitorId)).toEqual(["a"]);
  });

  test("a visitor identified before signups were recorded keeps its first identify", async () => {
    const { t } = await setup();
    const pv1 = await visit(t, "2026-10-08T17:00:00Z", { vid: "old", path: "/join" });
    await identify(t, "2026-10-08T17:01:00Z", pv1, { email: "old@example.com" });
    // As if that identify ran before this phase: no signup fields stored
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query("visitors")
        .filter((q) => q.eq(q.field("visitorId"), "old"))
        .unique();
      await ctx.db.patch("visitors", row!._id, { identifiedAt: undefined, signupPath: undefined, landingPath: undefined });
    });
    const pv2 = await visit(t, "2026-10-12T17:00:00Z", { vid: "old", sid: "old-2", path: "/app" });
    await identify(t, "2026-10-12T17:01:00Z", pv2, { email: "old@example.com" });
    const old = await visitor(t, "old");
    expect(old?.identifiedAt).toBe(Date.parse("2026-10-08T17:01:00Z"));
    expect(old?.signupPath).toBe("/join");
  });
});

describe("signups.list", () => {
  test("belongs to the site's owner", async () => {
    const { t } = await setup();
    const args = { domain: DOMAIN, range: WEEK, search: "", offset: 0 };
    await expect(t.query(api.signups.list, args)).rejects.toThrow();
    const stranger = t.withIdentity(STRANGER);
    await stranger.mutation(api.accounts.ensure, {});
    await expect(stranger.query(api.signups.list, args)).rejects.toThrow("Site not found");
    // Nor through a site of their own
    await stranger.mutation(api.sites.create, { domain: "other.com", timezone: "UTC" });
    await expect(stranger.query(api.signups.list, args)).rejects.toThrow("Site not found");
  });

  test("two signups, one paying: 2 signups, 1 free, 1 paying, 50% free → paid", async () => {
    const { t, owner, pay } = await setup({ payments: true });
    const pa = await visit(t, "2026-10-10T17:00:00Z", { vid: "a", path: "/pricing", referrer: "www.google.com" });
    await identify(t, "2026-10-10T17:30:00Z", pa, { email: "ann@example.com", name: "Ann" });
    const pb = await visit(t, "2026-10-12T17:00:00Z", { vid: "b", path: "/", country: "DE" });
    await identify(t, "2026-10-12T19:00:00Z", pb, { userId: "user_b" });
    await pay("2026-10-12T20:00:00Z", { id: "p-1", amountMinor: 2900, visitorId: "b" });

    const result = await ok(owner);
    const tiles = signupTiles(result.totals);
    expect(tiles.signups.value).toBe(2);
    expect(tiles.free.value).toBe(1);
    expect(tiles.paying.value).toBe(1);
    expect(tiles.paidRate.value).toBe(0.5);
    // Time to sign up: 30 minutes and 2 hours from the first visit
    expect(tiles.took.value).toBe((30 * MINUTE + 2 * HOUR) / 2);

    expect(result.chart).toHaveLength(7);
    expect(result.chart.find((p) => p.date === "2026-10-10")).toEqual({ date: "2026-10-10", free: 1, paying: 0 });
    expect(result.chart.find((p) => p.date === "2026-10-12")).toEqual({ date: "2026-10-12", free: 0, paying: 1 });

    expect(result.rows.map((r) => [r.visitorId, r.person, r.paying, r.tookMs, r.journey])).toEqual([
      ["b", expect.any(String), true, 2 * HOUR, 1],
      ["a", "Ann", false, 30 * MINUTE, 1],
    ]);
    expect(result.rows[0]).toMatchObject({ userId: "user_b", revenueMinor: 2900, country: "DE", landingPath: "/" });
    expect(result.rows[1]).toMatchObject({ email: "ann@example.com", source: "Google", signupPath: "/pricing" });

    expect(result.lists.source).toEqual([
      { key: "Direct", signups: 1, paying: 1 },
      { key: "Google", signups: 1, paying: 0 },
    ]);
    expect(result.lists.country.map((r) => r.key)).toEqual(["DE", "US"]);
    expect(result.lists.landing.map((r) => r.key)).toEqual(["/", "/pricing"]);
  });

  test("a payment before the signup still makes it paying", async () => {
    const { t, owner, pay } = await setup({ payments: true });
    const pv = await visit(t, "2026-10-10T17:00:00Z", { vid: "c" });
    await pay("2026-10-10T17:10:00Z", { id: "p-c", amountMinor: 900, visitorId: "c" });
    await identify(t, "2026-10-10T17:20:00Z", pv, { email: "c@example.com" });
    const result = await ok(owner);
    expect(signupTiles(result.totals).paying.value).toBe(1);
  });

  test("the period before, hour ranges and the range edges", async () => {
    const { t, owner } = await setup();
    // 6 Oct 23:30 local (7 Oct 06:30Z) belongs to the week before
    const p0 = await visit(t, "2026-10-07T06:00:00Z", { vid: "early" });
    await identify(t, "2026-10-07T06:30:00Z", p0, { email: "early@example.com" });
    const p1 = await visit(t, "2026-10-13T17:00:00Z", { vid: "late" });
    await identify(t, "2026-10-13T17:10:00Z", p1, { email: "late@example.com" });

    const week = await ok(owner);
    expect(week.totals).toMatchObject({ signups: 1, previousSignups: 1, previousPaying: 0 });
    expect(signupTiles(week.totals).signups.change).toBe(0);
    expect((await ok(owner, { range: BEFORE })).rows.map((r) => r.visitorId)).toEqual(["early"]);

    const now = Date.parse("2026-10-13T18:00:00Z");
    const today = await ok(owner, { range: { period: "today", now } });
    expect(today.totals.signups).toBe(1);
    expect(today.chart.find((p) => p.date === "2026-10-13T10:00")).toMatchObject({ free: 1 });
  });

  test("search and paging", async () => {
    const { t, owner } = await setup();
    const pa = await visit(t, "2026-10-10T17:00:00Z", { vid: "a", path: "/docs" });
    await identify(t, "2026-10-10T17:01:00Z", pa, { email: "ann@example.com" });
    const pb = await visit(t, "2026-10-11T17:00:00Z", { vid: "b", country: "DE" });
    await identify(t, "2026-10-11T17:01:00Z", pb, { userId: "bob_1" });
    expect((await ok(owner, { search: "ann@" })).rows.map((r) => r.visitorId)).toEqual(["a"]);
    expect((await ok(owner, { search: "bob_" })).rows.map((r) => r.visitorId)).toEqual(["b"]);
    expect((await ok(owner, { search: "germany" })).rows.map((r) => r.visitorId)).toEqual(["b"]);
    expect((await ok(owner, { search: "/docs" })).rows.map((r) => r.visitorId)).toEqual(["a"]);
    expect((await ok(owner, { search: "free" })).matched).toBe(2);
    expect((await ok(owner, { search: "paying" })).matched).toBe(0);
    // An offset past the end goes back to the last page
    expect((await ok(owner, { offset: 500 })).offset).toBe(0);
  });

  test("cookieless sites have no signups to show", async () => {
    const { owner } = await setup();
    await owner.mutation(api.sites.setCookieless, { domain: DOMAIN, cookieless: true });
    const result = await owner.query(api.signups.list, { domain: DOMAIN, range: WEEK, search: "", offset: 0 });
    expect(result.status).toBe("cookieless");
  });
});

describe("backfillIdentifiedAt", () => {
  test("gives identified visitors their first identify, and is safe to run twice", async () => {
    const { t, owner } = await setup();
    const pa = await visit(t, "2026-10-08T17:00:00Z", { vid: "a", path: "/" });
    await identify(t, "2026-10-08T17:05:00Z", pa, { email: "a@example.com" });
    const pa2 = await visit(t, "2026-10-09T17:00:00Z", { vid: "a", sid: "a-2", path: "/settings" });
    await identify(t, "2026-10-09T17:05:00Z", pa2, { email: "a@example.com" });
    const pu = await visit(t, "2026-10-09T18:00:00Z", { vid: "u", path: "/x" });
    await visit(t, "2026-10-10T18:00:00Z", { vid: "e", path: "/y" });
    await visit(t, "2026-10-10T19:00:00Z", { vid: "anon", path: "/z" });
    await identify(t, "2026-10-10T19:05:00Z", pu, { name: "Nameless" });

    await t.run(async (ctx) => {
      for await (const row of ctx.db.query("visitors")) {
        const patch: Record<string, unknown> = { identifiedAt: undefined, signupPath: undefined, landingPath: undefined };
        // u: a user id with no identify call left; e: an email from a payment only
        if (row.visitorId === "u") {
          patch.userId = "u-1";
          for await (const ev of ctx.db.query("events")) if (ev.visitorId === "u") await ctx.db.delete("events", ev._id);
        }
        if (row.visitorId === "e") patch.email = "payer@example.com";
        // a: a later identifiedAt than its first identify is moved earlier
        if (row.visitorId === "a") patch.identifiedAt = Date.parse("2026-10-09T17:05:00Z");
        await ctx.db.patch("visitors", row._id, patch);
      }
    });

    await t.mutation(internal.migrations.backfillIdentifiedAt, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const a = await visitor(t, "a");
    expect(a?.identifiedAt).toBe(Date.parse("2026-10-08T17:05:00Z"));
    expect(a?.signupPath).toBe("/");
    expect(a?.landingPath).toBe("/");
    const u = await visitor(t, "u");
    expect(u?.identifiedAt).toBe(u?.firstSeen);
    expect(u?.signupPath).toBeUndefined();
    expect(u?.landingPath).toBe("/x");
    expect((await visitor(t, "e"))?.identifiedAt).toBeUndefined();
    expect((await visitor(t, "anon"))?.identifiedAt).toBeUndefined();

    await t.mutation(internal.migrations.backfillIdentifiedAt, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await visitor(t, "a"))?.identifiedAt).toBe(Date.parse("2026-10-08T17:05:00Z"));
    expect((await ok(owner)).totals.signups).toBe(2);
  });
});

describe("helpers", () => {
  test("tiles without signups have no rate or average", () => {
    const tiles = signupTiles({
      signups: 0,
      paying: 0,
      tookSumMs: 0,
      previousSignups: 2,
      previousPaying: 1,
      previousTookSumMs: 10,
    });
    expect(tiles.paidRate).toEqual({ value: null, change: null });
    expect(tiles.took).toEqual({ value: null, change: null });
    expect(tiles.signups.change).toBe(-1);
  });

  test("time to sign up is never negative", () => {
    const row = toSignupRow({
      _id: "x" as never,
      _creationTime: 0,
      siteId: "s" as never,
      visitorId: "v",
      firstSeen: 100,
      lastSeen: 100,
      lastSeenDate: "2026-10-10",
      sessions: 1,
      revenueMinor: 0,
      identifiedAt: 50,
    });
    expect(row.tookMs).toBe(0);
    expect(signupMatches(row, "FREE")).toBe(true);
  });
});

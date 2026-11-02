/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { persona } from "./lib/names";
import schema from "./schema";

// The Users tab's visitor table (design v4 Phase 9): visitor totals at ingest, their
// backfill, and visitors.list.

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test-secret";
const OWNER = { subject: "user_1", tokenIdentifier: "clerk|user_1" };
const STRANGER = { subject: "user_2", tokenIdentifier: "clerk|user_2" };

const VID_A = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f7a";
const VID_B = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f7b";
const VID_C = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f7c";

// 7 to 13 October in Los Angeles
const WEEK = { from: "2026-10-07", to: "2026-10-13" };

type T = ReturnType<typeof convexTest>;
type Owner = ReturnType<T["withIdentity"]>;

async function setup(o: { revenueSource?: "api" | "none"; keyGoal?: string } = {}) {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity(OWNER);
  await owner.mutation(api.sites.create, { domain: "picai.so", timezone: "America/Los_Angeles" });
  if (o.revenueSource) {
    await owner.mutation(api.sites.setRevenue, { domain: "picai.so", revenueSource: o.revenueSource, currency: "USD" });
  }
  if (o.keyGoal) await owner.mutation(api.sites.setKeyGoal, { domain: "picai.so", keyGoal: o.keyGoal });
  return { t, owner };
}

async function visit(
  t: T,
  iso: string,
  o: { vid: string; sid: string; pvId: string; path?: string; country?: string; city?: string; device?: "mobile" | "desktop"; browser?: string },
) {
  vi.setSystemTime(new Date(iso));
  await t.mutation(api.ingest.pageview, {
    secret: SECRET,
    site: "picai.so",
    hostname: "picai.so",
    path: o.path ?? "/",
    referrer: "(direct)",
    unique: true,
    device: o.device ?? "desktop",
    browser: o.browser ?? "Chrome",
    country: o.country ?? "US",
    city: o.city,
    pvId: o.pvId,
    visitorId: o.vid,
    sessionId: o.sid,
  });
}

async function ping(t: T, iso: string, pvId: string, ms: number) {
  vi.setSystemTime(new Date(iso));
  await t.mutation(api.ingest.ping, { secret: SECRET, site: "picai.so", hostname: "picai.so", pvId, ms });
}

async function goal(t: T, iso: string, pvId: string, name: string) {
  vi.setSystemTime(new Date(iso));
  await t.mutation(api.ingest.event, { secret: SECRET, site: "picai.so", hostname: "picai.so", pvId, event: { type: "goal", name } });
}

async function list(
  owner: Owner,
  o: { range?: typeof WEEK | { period: "today" | "yesterday" | "24h"; now: number }; kind?: "all" | "customers"; search?: string; offset?: number } = {},
) {
  const result = await owner.query(api.visitors.list, {
    domain: "picai.so",
    range: o.range ?? WEEK,
    kind: o.kind ?? "all",
    search: o.search ?? "",
    offset: o.offset ?? 0,
  });
  if (result.status !== "ok") throw new Error(`status ${result.status}`);
  return result;
}

/**
 * A: two sessions, the latest from Berlin on a phone. B: one session the week before.
 * C: one session today (13 Oct).
 */
async function seed(t: T) {
  await visit(t, "2026-10-10T17:00:00Z", { vid: VID_A, sid: "a1", pvId: "a1-1", path: "/" });
  await ping(t, "2026-10-10T17:00:40Z", "a1-1", 40_000);
  await visit(t, "2026-10-10T17:01:00Z", { vid: VID_A, sid: "a1", pvId: "a1-2", path: "/pricing" });
  await ping(t, "2026-10-10T17:01:20Z", "a1-2", 20_000);
  await visit(t, "2026-10-12T17:00:00Z", {
    vid: VID_A,
    sid: "a2",
    pvId: "a2-1",
    path: "/blog/hello",
    country: "DE",
    city: "Berlin",
    device: "mobile",
    browser: "Mobile Safari",
  });
  await visit(t, "2026-10-12T17:02:00Z", { vid: VID_A, sid: "a2", pvId: "a2-2", path: "/docs", country: "DE", city: "Berlin", device: "mobile", browser: "Mobile Safari" });
  await ping(t, "2026-10-12T17:03:00Z", "a2-2", 60_000);
  await visit(t, "2026-10-01T17:00:00Z", { vid: VID_B, sid: "b1", pvId: "b1-1", path: "/old" });
  await visit(t, "2026-10-13T17:00:00Z", { vid: VID_C, sid: "c1", pvId: "c1-1", path: "/signup", country: "GB" });
}

beforeEach(() => {
  vi.stubEnv("INGEST_SECRET", SECRET);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

test("the visitor table belongs to the site's owner", async () => {
  const { t } = await setup();
  await visit(t, "2026-10-13T17:00:00Z", { vid: VID_A, sid: "a1", pvId: "pv-1" });
  const args = { domain: "picai.so", range: WEEK, kind: "all" as const, search: "", offset: 0 };
  await expect(t.query(api.visitors.list, args)).rejects.toThrow(/Not signed in/);
  await expect(t.withIdentity(STRANGER).query(api.visitors.list, args)).rejects.toThrow(/Site not found/);
  await expect(t.withIdentity(OWNER).query(api.visitors.list, args)).resolves.toMatchObject({ status: "ok" });
});

test("a site that never sent a visitor id is cookieless", async () => {
  const { t, owner } = await setup();
  vi.setSystemTime(new Date("2026-10-13T17:00:00Z"));
  await t.mutation(api.ingest.pageview, {
    secret: SECRET,
    site: "picai.so",
    hostname: "picai.so",
    path: "/",
    referrer: "(direct)",
    unique: true,
    device: "desktop",
    browser: "Chrome",
    country: "US",
    pvId: "pv-1",
    cookieless: true,
  });
  const result = await owner.query(api.visitors.list, { domain: "picai.so", range: WEEK, kind: "all", search: "", offset: 0 });
  expect(result).toEqual({ status: "cookieless" });
});

describe("visitor totals", () => {
  test("ingest keeps each visitor's totals and latest session details", async () => {
    const { t, owner } = await setup();
    await seed(t);
    const { rows } = await list(owner);
    expect(rows.find((r) => r.visitorId === VID_A)).toEqual({
      visitorId: VID_A,
      name: null,
      email: null,
      country: "DE",
      region: null,
      city: "Berlin",
      device: "mobile",
      browser: "Mobile Safari",
      entryPath: "/blog/hello",
      exitPath: "/docs",
      firstSource: "Direct",
      sessions: 2,
      pageviews: 4,
      engagedMs: 120_000,
      revenueMinor: 0,
      lastSeen: Date.parse("2026-10-12T17:02:00Z"),
    });
  });

  test("the backfill recounts every visitor from its sessions, and running it twice changes nothing", async () => {
    const { t } = await setup();
    await seed(t);
    const totals = () =>
      t.run(async (ctx) =>
        (await ctx.db.query("visitors").collect()).map((v) => ({
          visitorId: v.visitorId,
          pageviews: v.pageviews,
          engagedMs: v.engagedMs,
          country: v.country,
          city: v.city,
          device: v.device,
          browser: v.browser,
          entryPath: v.entryPath,
          exitPath: v.exitPath,
        })),
      );
    const expected = await totals();
    // As visitors from before Phase 9 were stored
    await t.run(async (ctx) => {
      for (const v of await ctx.db.query("visitors").collect()) {
        await ctx.db.patch("visitors", v._id, {
          pageviews: undefined,
          engagedMs: undefined,
          country: undefined,
          city: undefined,
          device: undefined,
          browser: undefined,
          entryPath: undefined,
          exitPath: undefined,
        });
      }
    });
    for (let run = 0; run < 2; run++) {
      await t.mutation(internal.migrations.backfillVisitorTotals, {});
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await totals()).toEqual(expected);
    }
    expect(expected.find((v) => v.visitorId === VID_A)).toMatchObject({ pageviews: 4, engagedMs: 120_000 });
  });
});

describe("visitors.list", () => {
  test("lists the visitors seen in the range, the latest seen first", async () => {
    const { t, owner } = await setup();
    await seed(t);
    const week = await list(owner);
    expect(week.rows.map((r) => r.visitorId)).toEqual([VID_C, VID_A]);
    expect(week).toMatchObject({ matched: 2, offset: 0, truncated: false });
    // A day with only A's first session
    const tenth = await list(owner, { range: { from: "2026-10-10", to: "2026-10-10" } });
    expect(tenth.rows.map((r) => r.visitorId)).toEqual([VID_A]);
    // A was seen before and after the 11th, but not on it
    const eleventh = await list(owner, { range: { from: "2026-10-11", to: "2026-10-11" } });
    expect(eleventh.rows).toEqual([]);
    // Today, by the hour
    const today = await list(owner, { range: { period: "today", now: Date.parse("2026-10-13T18:00:00Z") } });
    expect(today.rows.map((r) => r.visitorId)).toEqual([VID_C]);
  });

  test("search matches name, email, id, persona, country and path", async () => {
    const { t, owner } = await setup();
    await seed(t);
    await t.mutation(api.ingest.event, {
      secret: SECRET,
      site: "picai.so",
      hostname: "picai.so",
      pvId: "c1-1",
      event: { type: "identify", name: "Jo Bloggs", email: "jo@example.com" },
    });
    const found = async (search: string) => (await list(owner, { search })).rows.map((r) => r.visitorId);
    expect(await found("bloggs")).toEqual([VID_C]);
    expect(await found("EXAMPLE.com")).toEqual([VID_C]);
    expect(await found(VID_A.slice(-6))).toEqual([VID_A]);
    expect(await found(persona(VID_A).name)).toEqual([VID_A]);
    expect(await found("germany")).toEqual([VID_A]);
    // A code matches whole ("gb"), or as part of any other field
    expect(await found("GB")).toEqual([VID_C]);
    expect(await found("berlin")).toEqual([VID_A]);
    expect(await found("/docs")).toEqual([VID_A]);
    expect(await found("/signup")).toEqual([VID_C]);
    // Only the latest session's pages count
    expect(await found("/pricing")).toEqual([]);
    expect(await list(owner, { search: "nobody" })).toMatchObject({ rows: [], matched: 0 });
  });

  test("customers are the visitors who paid or completed the key goal", async () => {
    const { t, owner } = await setup({ revenueSource: "api", keyGoal: "signup" });
    await seed(t);
    await goal(t, "2026-10-13T17:01:00Z", "c1-1", "signup");
    // A pays (set directly; payments.test covers how payments reach visitors)
    await t.run(async (ctx) => {
      const a = (await ctx.db.query("visitors").collect()).find((v) => v.visitorId === VID_A)!;
      await ctx.db.patch("visitors", a._id, { firstPaidAt: Date.parse("2026-10-12T17:05:00Z"), revenueMinor: 4900 });
    });
    const result = await list(owner, { kind: "customers" });
    expect(result.customerKinds).toEqual(["revenue", "goal"]);
    expect(result.rows.map((r) => [r.visitorId, r.revenueMinor])).toEqual([
      [VID_C, 0],
      [VID_A, 4900],
    ]);

    await owner.mutation(api.sites.setKeyGoal, { domain: "picai.so", keyGoal: null });
    expect((await list(owner, { kind: "customers" })).rows.map((r) => r.visitorId)).toEqual([VID_A]);
    await owner.mutation(api.sites.setRevenue, { domain: "picai.so", revenueSource: "none", currency: "USD" });
    expect(await list(owner, { kind: "customers" })).toMatchObject({ customerKinds: [], rows: [], matched: 0 });
  });

  test("pages through 50 rows at a time", async () => {
    const { t, owner } = await setup();
    for (let i = 0; i < 55; i++) {
      const vid = `0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a${String(i).padStart(4, "0")}`;
      await visit(t, `2026-10-13T${String(10 + Math.floor(i / 10)).padStart(2, "0")}:${String(i % 10).padStart(2, "0")}:00Z`, {
        vid,
        sid: `s${i}`,
        pvId: `pv-${i}`,
      });
    }
    const first = await list(owner);
    expect(first).toMatchObject({ matched: 55, offset: 0 });
    expect(first.rows).toHaveLength(50);
    const second = await list(owner, { offset: 50 });
    expect(second.rows).toHaveLength(5);
    expect(second.rows.at(-1)!.visitorId).toMatch(/0000$/);
  });
});

/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

// The usage meter (launch v1 Phase 6): pageviews plus goals and outbound clicks, per UTC
// calendar month, summed over the account's sites.

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test-secret";
const OWNER = { subject: "user_1", tokenIdentifier: "clerk|user_1" };
const STRANGER = { subject: "user_2", tokenIdentifier: "clerk|user_2" };
const VID = "11111111-1111-4111-8111-111111111111";
const SID = "22222222-2222-4222-8222-222222222222";

type T = ReturnType<typeof convexTest>;

const pageview = (t: T, site: string, pvId: string, ids = true) =>
  t.mutation(api.ingest.pageview, {
    secret: SECRET,
    site,
    hostname: site,
    path: "/",
    referrer: "(direct)",
    unique: true,
    device: "desktop",
    browser: "Chrome",
    country: "US",
    pvId,
    ...(ids ? { visitorId: VID, sessionId: SID } : {}),
  });

const goal = (t: T, site: string, pvId: string, name: string) =>
  t.mutation(api.ingest.event, { secret: SECRET, site, hostname: site, pvId, event: { type: "goal", name } });

const outbound = (t: T, site: string, pvId: string, url: string) =>
  t.mutation(api.ingest.event, { secret: SECRET, site, hostname: site, pvId, event: { type: "outbound", url } });

const ping = (t: T, site: string, pvId: string) =>
  t.mutation(api.ingest.ping, { secret: SECRET, site, hostname: site, pvId, ms: 10_000 });

async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity(OWNER);
  await owner.mutation(api.sites.create, { domain: "a.dev", timezone: "America/Los_Angeles" });
  await owner.mutation(api.sites.create, { domain: "b.dev", timezone: "Asia/Tokyo" });
  await t.withIdentity(STRANGER).mutation(api.sites.create, { domain: "c.dev", timezone: "UTC" });
  return { t, owner };
}

beforeEach(() => {
  vi.stubEnv("INGEST_SECRET", SECRET);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-11T12:00:00Z"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("billing.usage", () => {
  test("counts pageviews, goals and outbound clicks exactly, and not pings or identify", async () => {
    const { t, owner } = await setup();
    const usage = () => owner.query(api.billing.usage, { month: "2026-11" });
    expect(await usage()).toEqual({ pageviews: 0, events: 0, total: 0 });

    await pageview(t, "a.dev", "pv-1");
    await pageview(t, "a.dev", "pv-2");
    await pageview(t, "a.dev", "pv-3", false); // cookieless counts too
    await goal(t, "a.dev", "pv-1", "signup");
    await goal(t, "a.dev", "pv-2", "signup");
    await outbound(t, "a.dev", "pv-1", "https://x.com/");
    expect(await usage()).toEqual({ pageviews: 3, events: 3, total: 6 });

    await ping(t, "a.dev", "pv-1");
    await ping(t, "a.dev", "pv-2");
    await t.mutation(api.ingest.event, {
      secret: SECRET,
      site: "a.dev",
      hostname: "a.dev",
      pvId: "pv-1",
      event: { type: "identify", email: "jo@example.com" },
    });
    // Dropped hits don't count: a retried beacon and a repeated goal on the same pageview
    await pageview(t, "a.dev", "pv-1");
    await goal(t, "a.dev", "pv-1", "signup");
    expect(await usage()).toEqual({ pageviews: 3, events: 3, total: 6 });
  });

  test("sums the owner's sites and nobody else's", async () => {
    const { t, owner } = await setup();
    await pageview(t, "a.dev", "a-1");
    await pageview(t, "b.dev", "b-1");
    await goal(t, "b.dev", "b-1", "signup");
    await pageview(t, "c.dev", "c-1"); // the stranger's
    expect(await owner.query(api.billing.usage, { month: "2026-11" })).toEqual({ pageviews: 2, events: 1, total: 3 });
    expect(await t.withIdentity(STRANGER).query(api.billing.usage, { month: "2026-11" })).toMatchObject({ total: 1 });
  });

  test("months are UTC calendar months, whatever the site's timezone", async () => {
    const { t, owner } = await setup();
    // 23:59 UTC on Oct 31: Nov 1 in Tokyo, but October for the meter
    vi.setSystemTime(new Date("2026-10-31T23:59:00Z"));
    await pageview(t, "b.dev", "b-oct");
    // 03:00 UTC on Nov 1: still Oct 31 in Los Angeles, but November for the meter
    vi.setSystemTime(new Date("2026-11-01T03:00:00Z"));
    await pageview(t, "a.dev", "a-nov");
    await goal(t, "a.dev", "a-nov", "signup");
    // Dec 1 starts a new month
    vi.setSystemTime(new Date("2026-12-01T00:00:00Z"));
    await pageview(t, "a.dev", "a-dec");

    const usage = (month: string) => owner.query(api.billing.usage, { month });
    expect(await usage("2026-10")).toEqual({ pageviews: 1, events: 0, total: 1 });
    expect(await usage("2026-11")).toEqual({ pageviews: 1, events: 1, total: 2 });
    expect(await usage("2026-12")).toEqual({ pageviews: 1, events: 0, total: 1 });
    await expect(usage("Nov")).rejects.toThrow(/Bad month/);
    await expect(usage("2026-13")).rejects.toThrow(/Bad month/);
  });

  test("a deleted site's rows go with it", async () => {
    const { t, owner } = await setup();
    await pageview(t, "a.dev", "a-1");
    await owner.mutation(api.sites.remove, { domain: "a.dev" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.query("usageDays").collect())).toEqual([]);
  });
});

describe("billing.overLimit", () => {
  test("lists subscribed accounts over their tier, which still track and read normally", async () => {
    const { t, owner } = await setup();
    await owner.mutation(api.accounts.ensure, {});
    await t.withIdentity(STRANGER).mutation(api.accounts.ensure, {});
    const sites = await t.run((ctx) => ctx.db.query("sites").collect());
    const id = (d: string) => sites.find((s) => s.domain === d)!._id;
    await t.run(async (ctx) => {
      const accounts = await ctx.db.query("accounts").collect();
      for (const a of accounts) await ctx.db.patch("accounts", a._id, { status: "active", events: 500_000, stripeCustomerId: `cus_${a.ownerId}` });
      await ctx.db.insert("usageDays", { siteId: id("a.dev"), date: "2026-11-02", pageviews: 400_000, events: 50_000 });
      await ctx.db.insert("usageDays", { siteId: id("b.dev"), date: "2026-11-10", pageviews: 60_000, events: 0 });
      await ctx.db.insert("usageDays", { siteId: id("c.dev"), date: "2026-11-10", pageviews: 500_000, events: 0 }); // at the limit, not over
      await ctx.db.insert("usageDays", { siteId: id("c.dev"), date: "2026-10-10", pageviews: 900_000, events: 0 }); // last month
    });

    const list = await t.query(internal.billing.overLimit, {
      month: "2026-11",
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(list.isDone).toBe(true);
    expect(list.page).toEqual([
      {
        ownerId: OWNER.tokenIdentifier,
        access: "active",
        limit: 500_000,
        usage: { pageviews: 460_000, events: 50_000, total: 510_000 },
        stripeCustomerId: `cus_${OWNER.tokenIdentifier}`,
      },
    ]);

    // Over the limit changes nothing: hits are stored and stats read
    await pageview(t, "a.dev", "a-1");
    expect(await owner.query(api.billing.usage, { month: "2026-11" })).toMatchObject({ total: 510_001 });
    await expect(owner.query(api.sites.list, {})).resolves.toHaveLength(2);
  });

  test("leaves out trials and comped accounts, which have no limit", async () => {
    const { t, owner } = await setup();
    await owner.mutation(api.accounts.ensure, {});
    await t.mutation(internal.accounts.setComped, { ownerId: STRANGER.tokenIdentifier, comped: true });
    const sites = await t.run((ctx) => ctx.db.query("sites").collect());
    await t.run(async (ctx) => {
      for (const s of sites) await ctx.db.insert("usageDays", { siteId: s._id, date: "2026-11-02", pageviews: 20_000_000, events: 0 });
    });
    const list = await t.query(internal.billing.overLimit, {
      month: "2026-11",
      paginationOpts: { numItems: 100, cursor: null },
    });
    expect(list.page).toEqual([]);
  });
});

describe("migrations.backfillUsage", () => {
  test("counts this month's hits from before ingest counted them, once", async () => {
    const { t, owner } = await setup();
    const sites = await t.run((ctx) => ctx.db.query("sites").collect());
    const a = sites.find((s) => s.domain === "a.dev")!._id;
    // Rows as they were before Phase 6: raw hits with no usageDays
    const pv = (ts: string, pvId: string) =>
      t.run((ctx) =>
        ctx.db.insert("pageviews", {
          siteId: a,
          ts: Date.parse(ts),
          path: "/",
          referrer: "(direct)",
          unique: true,
          device: "desktop",
          browser: "Chrome",
          country: "US",
          pvId,
        }),
      );
    const ev = (ts: string, type: "goal" | "outbound" | "identify" | "claim") =>
      t.run((ctx) =>
        ctx.db.insert("events", { siteId: a, ts: Date.parse(ts), date: "x", type, name: type, path: "/", pvId: "old-2" }),
      );
    await pv("2026-10-31T23:00:00Z", "old-1"); // last month
    await pv("2026-11-01T00:30:00Z", "old-2");
    await pv("2026-11-10T09:00:00Z", "old-3");
    await ev("2026-10-31T23:30:00Z", "goal"); // last month
    await ev("2026-11-01T00:40:00Z", "goal");
    await ev("2026-11-10T09:10:00Z", "outbound");
    await ev("2026-11-10T09:20:00Z", "identify");
    await ev("2026-11-10T09:30:00Z", "claim");

    // A hit after the deploy is counted by ingest, which sets usageStartedAt
    await pageview(t, "a.dev", "new-1");

    await t.mutation(internal.migrations.backfillUsage, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await t.mutation(internal.migrations.backfillUsage, {}); // a second run changes nothing
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await owner.query(api.billing.usage, { month: "2026-11" })).toEqual({ pageviews: 3, events: 2, total: 5 });
    const rows = await t.run((ctx) => ctx.db.query("usageDays").collect());
    expect(rows.map((r) => [r.date, r.pageviews, r.events]).sort()).toEqual([
      ["2026-11-01", 1, 1],
      ["2026-11-10", 1, 1],
      ["2026-11-11", 1, 0],
    ]);
  });
});

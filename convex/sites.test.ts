/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("sites.create", () => {
  test("stores a normalised domain owned by the caller's tokenIdentifier", async () => {
    const t = convexTest(schema, modules);
    const asOwner = t.withIdentity({ subject: "user_1", tokenIdentifier: "clerk|user_1" });
    const { siteId, domain } = await asOwner.mutation(api.sites.create, {
      domain: "https://www.PicAI.so/",
      timezone: "Europe/Oslo",
    });
    expect(domain).toBe("picai.so");
    const site = await t.run((ctx) => ctx.db.get("sites", siteId));
    expect(site).toMatchObject({
      domain: "picai.so",
      ownerId: "clerk|user_1",
      timezone: "Europe/Oslo",
    });
  });

  test("rejects a duplicate domain, even in another form", async () => {
    const t = convexTest(schema, modules);
    const asOwner = t.withIdentity({ tokenIdentifier: "clerk|user_1" });
    await asOwner.mutation(api.sites.create, { domain: "picai.so", timezone: "UTC" });
    await expect(
      asOwner.mutation(api.sites.create, { domain: "www.picai.so", timezone: "UTC" }),
    ).rejects.toThrow(/already been added/);
  });

  test("rejects invalid input and signed-out callers", async () => {
    const t = convexTest(schema, modules);
    const asOwner = t.withIdentity({ tokenIdentifier: "clerk|user_1" });
    await expect(
      asOwner.mutation(api.sites.create, { domain: "not a domain", timezone: "UTC" }),
    ).rejects.toThrow(/domain/);
    await expect(
      asOwner.mutation(api.sites.create, { domain: "picai.so", timezone: "Nowhere/Land" }),
    ).rejects.toThrow(/timezone/);
    await expect(
      t.mutation(api.sites.create, { domain: "picai.so", timezone: "UTC" }),
    ).rejects.toThrow(/Not signed in/);
  });
});

const OWNER = { subject: "user_1", tokenIdentifier: "clerk|user_1" };
const STRANGER = { subject: "user_2", tokenIdentifier: "clerk|user_2" };

afterEach(() => {
  vi.useRealTimers();
});

async function addSite(t: ReturnType<typeof convexTest>, domain: string, timezone: string) {
  const { siteId } = await t.withIdentity(OWNER).mutation(api.sites.create, { domain, timezone });
  return siteId;
}

async function addDay(
  t: ReturnType<typeof convexTest>,
  siteId: Id<"sites">,
  date: string,
  pageviews: number,
  visitors: number,
) {
  await t.run((ctx) =>
    ctx.db.insert("dailyStats", {
      siteId,
      date,
      pageviews,
      visitors,
      durationSumMs: 0,
      durationCount: 0,
    }),
  );
}

describe("sites.listWithStats", () => {
  test("gives each site 30 zero-filled days ending today in its own timezone", async () => {
    const t = convexTest(schema, modules);
    const la = await addSite(t, "picai.so", "America/Los_Angeles");
    const oslo = await addSite(t, "sensai.co", "Europe/Oslo");
    // 2026-10-14 03:00Z is Oct 13 in Los Angeles and Oct 14 in Oslo
    const now = Date.parse("2026-10-14T03:00:00Z");
    await addDay(t, la, "2026-10-13", 5, 3);
    await addDay(t, la, "2026-09-14", 2, 1); // first day of LA's window
    await addDay(t, la, "2026-09-13", 100, 100); // one day too old
    await addDay(t, oslo, "2026-10-14", 7, 4);
    await addDay(t, oslo, "2026-09-14", 9, 9); // just outside Oslo's window

    const list = await t.withIdentity(OWNER).query(api.sites.listWithStats, { now });
    expect(list.map((s) => s.domain)).toEqual(["picai.so", "sensai.co"]);

    const [picai, sensai] = list;
    expect(picai.days).toHaveLength(30);
    expect(picai.days[0]).toEqual({ date: "2026-09-14", pageviews: 2, visitors: 1 });
    expect(picai.days[29]).toEqual({ date: "2026-10-13", pageviews: 5, visitors: 3 });
    expect(picai.days[10]).toEqual({ date: "2026-09-24", pageviews: 0, visitors: 0 });
    expect(picai).toMatchObject({ pageviews: 7, visitors: 4 });

    expect(sensai.days[0].date).toBe("2026-09-15");
    expect(sensai.days[29]).toEqual({ date: "2026-10-14", pageviews: 7, visitors: 4 });
    expect(sensai).toMatchObject({ pageviews: 7, visitors: 4 });
  });

  test("shows only the caller's sites and requires sign-in", async () => {
    const t = convexTest(schema, modules);
    await addSite(t, "picai.so", "UTC");
    const now = Date.parse("2026-10-14T12:00:00Z");
    expect(await t.withIdentity(STRANGER).query(api.sites.listWithStats, { now })).toEqual([]);
    await expect(t.query(api.sites.listWithStats, { now })).rejects.toThrow(/Not signed in/);
  });
});

describe("sites.update", () => {
  test("changes the timezone of the caller's own site only", async () => {
    const t = convexTest(schema, modules);
    await addSite(t, "picai.so", "UTC");
    await t
      .withIdentity(OWNER)
      .mutation(api.sites.update, { domain: "picai.so", timezone: "Europe/Oslo" });
    expect(await t.withIdentity(OWNER).query(api.sites.get, { domain: "picai.so" })).toEqual({
      domain: "picai.so",
      timezone: "Europe/Oslo",
      trackingStartedAt: null,
      keyGoal: null,
      revenueSource: "none",
      currency: "USD",
    });

    await expect(
      t.withIdentity(OWNER).mutation(api.sites.update, { domain: "picai.so", timezone: "Nope" }),
    ).rejects.toThrow(/timezone/);
    await expect(
      t
        .withIdentity(STRANGER)
        .mutation(api.sites.update, { domain: "picai.so", timezone: "UTC" }),
    ).rejects.toThrow(/Site not found/);
  });
});

describe("sites.remove", () => {
  test("deletes the site at once and its data in scheduled batches", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const siteId = await addSite(t, "picai.so", "UTC");
    const otherId = await addSite(t, "sensai.co", "UTC");
    // More pageviews than one batch, so the cleanup has to reschedule itself
    await t.run(async (ctx) => {
      for (const id of [siteId, otherId]) {
        const n = id === siteId ? 1_005 : 3;
        for (let i = 0; i < n; i++) {
          await ctx.db.insert("pageviews", {
            siteId: id,
            ts: i,
            path: "/",
            referrer: "(direct)",
            unique: true,
            device: "desktop",
            browser: "Chrome",
            country: "US",
            pvId: `${id}-${i}`,
          });
        }
        await ctx.db.insert("dailyDims", {
          siteId: id,
          date: "2026-10-14",
          dim: "page",
          key: "/",
          pageviews: n,
          visitors: n,
        });
      }
    });
    await t.run(async (ctx) => {
      for (const id of [siteId, otherId]) {
        await ctx.db.insert("sessions", {
          siteId: id,
          sessionId: `s-${id}`,
          visitorId: `v-${id}`,
          date: "2026-10-14",
          startedAt: 1,
          lastSeenAt: 1,
          engagedMs: 0,
          pageviews: 1,
          goals: 0,
          entryPath: "/",
          exitPath: "/",
          referrer: "(direct)",
          country: "US",
          device: "desktop",
          browser: "Chrome",
          revenueMinor: 0,
        });
        await ctx.db.insert("visitors", {
          siteId: id,
          visitorId: `v-${id}`,
          firstSeen: 1,
          lastSeen: 1,
          lastSeenDate: "2026-10-14",
          sessions: 1,
          revenueMinor: 0,
        });
        await ctx.db.insert("events", {
          siteId: id,
          ts: 1,
          date: "2026-10-14",
          type: "goal",
          name: "signup",
          path: "/",
          pvId: `${id}-0`,
          visitorId: `v-${id}`,
          sessionId: `s-${id}`,
        });
      }
    });
    await addDay(t, siteId, "2026-10-14", 1_005, 1_005);
    await addDay(t, otherId, "2026-10-14", 3, 3);

    await t.withIdentity(OWNER).mutation(api.sites.remove, { domain: "picai.so" });
    expect(await t.withIdentity(OWNER).query(api.sites.get, { domain: "picai.so" })).toBeNull();

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const left = await t.run(async (ctx) => ({
      pageviews: (await ctx.db.query("pageviews").take(5_000)).map((r) => r.siteId),
      dims: (await ctx.db.query("dailyDims").take(100)).map((r) => r.siteId),
      stats: (await ctx.db.query("dailyStats").take(100)).map((r) => r.siteId),
      sessions: (await ctx.db.query("sessions").take(100)).map((r) => r.siteId),
      visitors: (await ctx.db.query("visitors").take(100)).map((r) => r.siteId),
      events: (await ctx.db.query("events").take(100)).map((r) => r.siteId),
    }));
    expect(left.pageviews).toEqual([otherId, otherId, otherId]);
    expect(left.dims).toEqual([otherId]);
    expect(left.stats).toEqual([otherId]);
    expect(left.sessions).toEqual([otherId]);
    expect(left.visitors).toEqual([otherId]);
    expect(left.events).toEqual([otherId]);
  });

  test("refuses someone else's site", async () => {
    const t = convexTest(schema, modules);
    await addSite(t, "picai.so", "UTC");
    await expect(
      t.withIdentity(STRANGER).mutation(api.sites.remove, { domain: "picai.so" }),
    ).rejects.toThrow(/Site not found/);
    expect(await t.withIdentity(OWNER).query(api.sites.get, { domain: "picai.so" })).not.toBeNull();
  });
});

describe("key goal", () => {
  test("goalNames lists every recorded goal once; setKeyGoal sets and clears the key goal", async () => {
    const t = convexTest(schema, modules);
    const siteId = await addSite(t, "picai.so", "UTC");
    await t.run(async (ctx) => {
      for (const [date, key] of [["2026-10-13", "signup"], ["2026-10-14", "signup"], ["2026-10-14", "booking"]]) {
        await ctx.db.insert("dailyDims", { siteId, date, dim: "goal", key, pageviews: 0, visitors: 1, events: 1 });
      }
    });
    const owner = t.withIdentity(OWNER);
    expect(await owner.query(api.sites.goalNames, { domain: "picai.so" })).toEqual(["booking", "signup"]);

    await owner.mutation(api.sites.setKeyGoal, { domain: "picai.so", keyGoal: " signup " });
    expect((await owner.query(api.sites.get, { domain: "picai.so" }))?.keyGoal).toBe("signup");
    await owner.mutation(api.sites.setKeyGoal, { domain: "picai.so", keyGoal: null });
    expect((await owner.query(api.sites.get, { domain: "picai.so" }))?.keyGoal).toBeNull();
  });

  test("only the owner can read goal names or set the key goal", async () => {
    const t = convexTest(schema, modules);
    await addSite(t, "picai.so", "UTC");
    const stranger = t.withIdentity(STRANGER);
    await expect(stranger.query(api.sites.goalNames, { domain: "picai.so" })).rejects.toThrow(/Site not found/);
    await expect(
      stranger.mutation(api.sites.setKeyGoal, { domain: "picai.so", keyGoal: "signup" }),
    ).rejects.toThrow(/Site not found/);
  });
});

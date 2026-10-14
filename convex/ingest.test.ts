/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test-secret";

type Hit = {
  secret: string;
  site: string;
  hostname: string;
  path: string;
  referrer: string;
  unique: boolean;
  device: "mobile" | "tablet" | "desktop";
  browser: string;
  country: string;
  pvId: string;
};

function hit(overrides: Partial<Hit> = {}): Hit {
  return {
    secret: SECRET,
    site: "picai.so",
    hostname: "picai.so",
    path: "/",
    referrer: "google.com",
    unique: true,
    device: "desktop",
    browser: "Chrome",
    country: "US",
    pvId: "pv-1",
    ...overrides,
  };
}

async function setup() {
  const t = convexTest(schema, modules);
  const asOwner = t.withIdentity({ subject: "user_1", tokenIdentifier: "clerk|user_1" });
  await asOwner.mutation(api.sites.create, {
    domain: "picai.so",
    timezone: "America/Los_Angeles",
  });
  return t;
}

async function tables(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => ({
    pageviews: await ctx.db.query("pageviews").collect(),
    dailyStats: await ctx.db.query("dailyStats").collect(),
    dailyDims: await ctx.db.query("dailyDims").collect(),
  }));
}

beforeEach(() => {
  vi.stubEnv("INGEST_SECRET", SECRET);
  vi.useFakeTimers();
  // 2026-10-13 10:00 in Los Angeles
  vi.setSystemTime(new Date("2026-10-13T17:00:00Z"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("ingest.pageview", () => {
  test("writes the raw row, the daily stats and one row per dimension", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, hit());

    const { pageviews, dailyStats, dailyDims } = await tables(t);
    expect(pageviews).toHaveLength(1);
    expect(pageviews[0]).toMatchObject({ path: "/", referrer: "google.com", unique: true });
    expect(dailyStats).toEqual([
      expect.objectContaining({
        date: "2026-10-13",
        pageviews: 1,
        visitors: 1,
        durationSumMs: 0,
        durationCount: 0,
      }),
    ]);
    expect(dailyDims.map((d) => [d.dim, d.key, d.pageviews, d.visitors]).sort()).toEqual([
      ["browser", "Chrome", 1, 1],
      ["country", "US", 1, 1],
      ["device", "desktop", 1, 1],
      ["page", "/", 1, 1],
      ["referrer", "google.com", 1, 1],
    ]);
  });

  test("increments existing rows, counting visitors only for unique visits", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, hit({ pvId: "a" }));
    await t.mutation(api.ingest.pageview, hit({ pvId: "b", unique: false }));
    await t.mutation(api.ingest.pageview, hit({ pvId: "c", path: "/pricing" }));

    const { dailyStats, dailyDims } = await tables(t);
    expect(dailyStats[0]).toMatchObject({ pageviews: 3, visitors: 2 });
    const home = dailyDims.find((d) => d.dim === "page" && d.key === "/");
    expect(home).toMatchObject({ pageviews: 2, visitors: 1 });
    expect(dailyDims.filter((d) => d.dim === "page")).toHaveLength(2);
  });

  test("buckets by the site's timezone", async () => {
    const t = await setup();
    // 2026-10-14 05:00Z is still Oct 13 in Los Angeles
    vi.setSystemTime(new Date("2026-10-14T05:00:00Z"));
    await t.mutation(api.ingest.pageview, hit());
    const { dailyStats } = await tables(t);
    expect(dailyStats[0].date).toBe("2026-10-13");
  });

  test("rejects a wrong secret", async () => {
    const t = await setup();
    await expect(t.mutation(api.ingest.pageview, hit({ secret: "nope" }))).rejects.toThrow(
      "Invalid ingest secret",
    );
    expect((await tables(t)).pageviews).toHaveLength(0);
  });

  test("rejects every call when INGEST_SECRET is not configured", async () => {
    const t = await setup();
    vi.stubEnv("INGEST_SECRET", "");
    await expect(t.mutation(api.ingest.pageview, hit({ secret: "" }))).rejects.toThrow();
  });

  test("ignores an unknown site", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, hit({ site: "unknown.com", hostname: "unknown.com" }));
    expect((await tables(t)).pageviews).toHaveLength(0);
  });

  test("ignores a hit from a foreign hostname", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, hit({ hostname: "evil.com" }));
    await t.mutation(api.ingest.pageview, hit({ hostname: "notpicai.so", pvId: "pv-2" }));
    expect((await tables(t)).pageviews).toHaveLength(0);
  });

  test("accepts subdomains and a www/uppercase data-site", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, hit({ hostname: "www.picai.so" }));
    await t.mutation(api.ingest.pageview, hit({ site: "WWW.picai.so", pvId: "pv-2" }));
    expect((await tables(t)).pageviews).toHaveLength(2);
  });

  test("counts a repeated pvId once", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, hit());
    await t.mutation(api.ingest.pageview, hit());
    const { pageviews, dailyStats } = await tables(t);
    expect(pageviews).toHaveLength(1);
    expect(dailyStats[0].pageviews).toBe(1);
  });
});

describe("ingest.duration", () => {
  const dur = (o: Partial<{ secret: string; site: string; hostname: string; pvId: string; ms: number }> = {}) => ({
    secret: SECRET,
    site: "picai.so",
    hostname: "picai.so",
    pvId: "pv-1",
    ms: 12_000,
    ...o,
  });

  test("sets the pageview's duration and adds it to the day", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, hit());
    await t.mutation(api.ingest.duration, dur());
    const { pageviews, dailyStats } = await tables(t);
    expect(pageviews[0].durationMs).toBe(12_000);
    expect(dailyStats[0]).toMatchObject({ durationSumMs: 12_000, durationCount: 1 });
  });

  test("ignores a duplicate beacon for the same pageview", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, hit());
    await t.mutation(api.ingest.duration, dur());
    await t.mutation(api.ingest.duration, dur({ ms: 50_000 }));
    const { pageviews, dailyStats } = await tables(t);
    expect(pageviews[0].durationMs).toBe(12_000);
    expect(dailyStats[0]).toMatchObject({ durationSumMs: 12_000, durationCount: 1 });
  });

  test("counts on the pageview's own day when sent after midnight", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, hit());
    // Next day in Los Angeles
    vi.setSystemTime(new Date("2026-10-14T17:00:00Z"));
    await t.mutation(api.ingest.duration, dur());
    const { dailyStats } = await tables(t);
    expect(dailyStats).toHaveLength(1);
    expect(dailyStats[0]).toMatchObject({ date: "2026-10-13", durationCount: 1 });
  });

  test("ignores values over 30 minutes, negative or fractional", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, hit());
    await t.mutation(api.ingest.duration, dur({ ms: 30 * 60 * 1000 + 1 }));
    await t.mutation(api.ingest.duration, dur({ ms: -5 }));
    await t.mutation(api.ingest.duration, dur({ ms: 1.5 }));
    const { pageviews } = await tables(t);
    expect(pageviews[0].durationMs).toBeUndefined();
  });

  test("ignores a pvId that belongs to another site", async () => {
    const t = await setup();
    const asOwner = t.withIdentity({ tokenIdentifier: "clerk|user_1" });
    await asOwner.mutation(api.sites.create, { domain: "other.com", timezone: "UTC" });
    await t.mutation(api.ingest.pageview, hit());
    await t.mutation(api.ingest.duration, dur({ site: "other.com", hostname: "other.com" }));
    expect((await tables(t)).pageviews[0].durationMs).toBeUndefined();
  });

  test("rejects a wrong secret and ignores a foreign hostname", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, hit());
    await expect(t.mutation(api.ingest.duration, dur({ secret: "nope" }))).rejects.toThrow();
    await t.mutation(api.ingest.duration, dur({ hostname: "evil.com" }));
    expect((await tables(t)).pageviews[0].durationMs).toBeUndefined();
  });
});

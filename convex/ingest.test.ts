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
  os?: string;
  region?: string;
  city?: string;
  lat?: number;
  lon?: number;
  pvId: string;
  visitorId?: string;
  sessionId?: string;
  cookieless?: boolean;
  campaign?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
    refTag?: string;
  };
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
    sessions: await ctx.db.query("sessions").collect(),
    visitors: await ctx.db.query("visitors").collect(),
    sites: await ctx.db.query("sites").collect(),
    events: await ctx.db.query("events").collect(),
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
      ["channel", "Organic Search", 0, 1],
      ["city", "Unknown", 1, 1],
      ["country", "US", 1, 1],
      ["device", "desktop", 1, 1],
      ["os", "Unknown", 1, 1],
      ["page", "/", 1, 1],
      ["referrer", "google.com", 1, 1],
      ["region", "Unknown", 1, 1],
      ["source", "Google", 0, 1],
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

// Hits from the 5a script: the phone's visitor id, and a session id per visit
const phone = (pvId: string, sessionId: string, o: Partial<Hit> = {}) =>
  hit({ pvId, visitorId: "vid-phone", sessionId, ...o });

describe("ingest.pageview with visitor and session ids", () => {
  test("the first hit starts a session, creates the visitor and counts a bounce", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1", { path: "/pricing" }));

    const { pageviews, sessions, visitors, dailyStats, sites } = await tables(t);
    expect(pageviews[0]).toMatchObject({ visitorId: "vid-phone", sessionId: "s1" });
    expect(sessions).toEqual([
      expect.objectContaining({
        sessionId: "s1",
        visitorId: "vid-phone",
        date: "2026-10-13",
        pageviews: 1,
        entryPath: "/pricing",
        exitPath: "/pricing",
        referrer: "google.com",
        country: "US",
      }),
    ]);
    expect(visitors).toEqual([
      expect.objectContaining({ visitorId: "vid-phone", sessions: 1, lastSeenDate: "2026-10-13" }),
    ]);
    expect(dailyStats[0]).toMatchObject({ pageviews: 1, visitors: 1, sessions: 1, bounces: 1 });
    expect(sites[0].trackingStartedAt).toBe(Date.now());
  });

  test("a second pageview takes the bounce back and moves the exit page", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    await t.mutation(api.ingest.pageview, phone("b", "s1", { path: "/pricing", unique: false }));
    await t.mutation(api.ingest.pageview, phone("c", "s1", { path: "/signup", unique: false }));

    const { sessions, dailyStats } = await tables(t);
    expect(sessions[0]).toMatchObject({ pageviews: 3, entryPath: "/", exitPath: "/signup" });
    expect(dailyStats[0]).toMatchObject({ pageviews: 3, visitors: 1, sessions: 1, bounces: 0 });
  });

  test("two visits 40 minutes apart are one visitor and two sessions, both bounces", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    vi.setSystemTime(new Date("2026-10-13T17:40:00Z"));
    // The session cookie expired after 30 minutes, so the script sends a new id
    await t.mutation(api.ingest.pageview, phone("b", "s2", { referrer: "(direct)" }));

    const { sessions, visitors, dailyStats } = await tables(t);
    expect(sessions.map((x) => x.sessionId)).toEqual(["s1", "s2"]);
    expect(visitors).toEqual([expect.objectContaining({ sessions: 2 })]);
    expect(dailyStats[0]).toMatchObject({ visitors: 1, sessions: 2, bounces: 2 });
  });

  test("with ids, a visitor counts once a day in the lists, whatever the unique flag says", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1", { unique: false }));
    await t.mutation(api.ingest.pageview, phone("b", "s2", { unique: true }));
    const { dailyStats, dailyDims } = await tables(t);
    expect(dailyStats[0]).toMatchObject({ pageviews: 2, visitors: 1 });
    expect(dailyDims.find((d) => d.dim === "country")).toMatchObject({ pageviews: 2, visitors: 1 });
  });

  test("a returning visitor counts again on a new local day", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    vi.setSystemTime(new Date("2026-10-14T17:00:00Z"));
    await t.mutation(api.ingest.pageview, phone("b", "s2"));
    const { dailyStats, visitors } = await tables(t);
    expect(dailyStats.map((d) => [d.date, d.visitors, d.sessions])).toEqual([
      ["2026-10-13", 1, 1],
      ["2026-10-14", 1, 1],
    ]);
    expect(visitors[0]).toMatchObject({ lastSeenDate: "2026-10-14", sessions: 2 });
  });

  test("a session that runs past midnight takes the bounce off the day it started", async () => {
    const t = await setup();
    vi.setSystemTime(new Date("2026-10-14T06:55:00Z")); // 23:55 on Oct 13 in LA
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    vi.setSystemTime(new Date("2026-10-14T07:05:00Z")); // 00:05 on Oct 14
    await t.mutation(api.ingest.pageview, phone("b", "s1", { unique: false }));
    const { dailyStats } = await tables(t);
    expect(dailyStats.map((d) => [d.date, d.pageviews, d.visitors, d.sessions, d.bounces])).toEqual([
      ["2026-10-13", 1, 1, 1, 0],
      ["2026-10-14", 1, 1, 0, 0],
    ]);
  });

  test("keeps the first trackingStartedAt", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    const started = Date.now();
    vi.setSystemTime(new Date("2026-10-15T17:00:00Z"));
    await t.mutation(api.ingest.pageview, phone("b", "s2"));
    expect((await tables(t)).sites[0].trackingStartedAt).toBe(started);
  });
});

/** Session dims as [dim, key, sessions, visitors], sorted. */
async function sessionDims(t: ReturnType<typeof convexTest>) {
  const { dailyDims } = await tables(t);
  const sessionLevel = ["source", "channel", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "entry", "exit"];
  return dailyDims
    .filter((d) => sessionLevel.includes(d.dim))
    .map((d) => [d.dim, d.key, d.sessions, d.visitors])
    .sort();
}

describe("sources, channels and campaigns", () => {
  test("a new session is classified and counted on its source, tag, entry and exit dims", async () => {
    const t = await setup();
    await t.mutation(
      api.ingest.pageview,
      phone("a", "s1", {
        referrer: "(direct)",
        path: "/pricing",
        campaign: { utmSource: "test", utmCampaign: "phase5b" },
      }),
    );

    const { sessions, visitors, sites } = await tables(t);
    expect(sessions[0]).toMatchObject({
      source: "test",
      channel: "Referral",
      utmSource: "test",
      utmCampaign: "phase5b",
    });
    expect(visitors[0]).toMatchObject({ firstSource: "test", firstChannel: "Referral" });
    expect(sites[0].sourcesStartedAt).toBe(Date.now());
    expect(await sessionDims(t)).toEqual([
      ["channel", "Referral", 1, 1],
      ["entry", "/pricing", 1, 0],
      ["exit", "/pricing", 1, 0],
      ["source", "test", 1, 1],
      ["utm_campaign", "phase5b", 1, 1],
      ["utm_source", "test", 1, 1],
    ]);
  });

  test("a click from chatgpt.com is ChatGPT under AI", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1", { referrer: "chatgpt.com" }));
    const { sessions } = await tables(t);
    expect(sessions[0]).toMatchObject({ source: "ChatGPT", channel: "AI" });
  });

  test("trims campaign tags to 100 characters and ignores empty ones", async () => {
    const t = await setup();
    await t.mutation(
      api.ingest.pageview,
      phone("a", "s1", { campaign: { utmCampaign: `  ${"x".repeat(150)}`, utmTerm: " " } }),
    );
    const { sessions } = await tables(t);
    expect(sessions[0].utmCampaign).toBe("x".repeat(100));
    expect(sessions[0].utmTerm).toBeUndefined();
  });

  test("later pageviews move the exit page and keep the session's source", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    await t.mutation(
      api.ingest.pageview,
      phone("b", "s1", { path: "/pricing", referrer: "(direct)", unique: false, campaign: { utmSource: "x" } }),
    );
    await t.mutation(api.ingest.pageview, phone("c", "s1", { path: "/signup", referrer: "(direct)", unique: false }));

    expect(await sessionDims(t)).toEqual([
      ["channel", "Organic Search", 1, 1],
      ["entry", "/", 1, 0],
      ["exit", "/", 0, 0],
      ["exit", "/pricing", 0, 0],
      ["exit", "/signup", 1, 0],
      ["source", "Google", 1, 1],
    ]);
  });

  test("a visitor counts once per source and day, however many sessions", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    vi.setSystemTime(new Date("2026-10-13T17:40:00Z"));
    await t.mutation(api.ingest.pageview, phone("b", "s2"));
    vi.setSystemTime(new Date("2026-10-13T18:20:00Z"));
    await t.mutation(api.ingest.pageview, phone("c", "s3", { referrer: "chatgpt.com" }));
    vi.setSystemTime(new Date("2026-10-14T17:00:00Z")); // next local day
    await t.mutation(api.ingest.pageview, phone("d", "s4"));

    const dims = (await sessionDims(t)).filter(([d]) => d === "source" || d === "channel");
    expect(dims).toEqual([
      ["channel", "AI", 1, 1],
      ["channel", "Organic Search", 1, 1],
      ["channel", "Organic Search", 2, 1],
      ["source", "ChatGPT", 1, 1],
      ["source", "Google", 1, 1],
      ["source", "Google", 2, 1],
    ]);
  });

  test("hits without ids count a visitor on source dims for unique visits only", async () => {
    const t = await setup();
    await t.mutation(
      api.ingest.pageview,
      hit({ pvId: "a", cookieless: true, referrer: "(direct)", campaign: { refTag: "launch" } }),
    );
    await t.mutation(api.ingest.pageview, hit({ pvId: "b", cookieless: true, unique: false }));

    expect(await sessionDims(t)).toEqual([
      ["channel", "Referral", 0, 1],
      ["ref", "launch", 0, 1],
      ["source", "launch", 0, 1],
    ]);
  });
});

describe("hits without ids", () => {
  test("are counted the old way until the site's first id-carrying hit", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, hit({ pvId: "a" }));
    const { pageviews, sessions, dailyStats, sites } = await tables(t);
    expect(pageviews[0].visitorId).toBeUndefined();
    expect(sessions).toHaveLength(0);
    expect(dailyStats[0]).toMatchObject({ visitors: 1, sessions: 0, bounces: 0 });
    expect(sites[0].trackingStartedAt).toBeUndefined();
  });

  test("from a cached old script are kept for 7 days after tracking starts, then dropped", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    vi.setSystemTime(new Date("2026-10-19T17:00:00Z")); // 6 days later
    await t.mutation(api.ingest.pageview, hit({ pvId: "old-1" }));
    vi.setSystemTime(new Date("2026-10-20T17:00:01Z")); // just over 7 days
    await t.mutation(api.ingest.pageview, hit({ pvId: "old-2" }));
    const { pageviews } = await tables(t);
    expect(pageviews.map((p) => p.pvId)).toEqual(["a", "old-1"]);
  });

  test("in cookieless mode are always kept and use the unique-visit rule", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    vi.setSystemTime(new Date("2026-11-30T18:00:00Z"));
    await t.mutation(api.ingest.pageview, hit({ pvId: "b", cookieless: true }));
    await t.mutation(api.ingest.pageview, hit({ pvId: "c", cookieless: true, unique: false }));
    const { dailyStats } = await tables(t);
    expect(dailyStats.find((d) => d.date === "2026-11-30")).toMatchObject({
      pageviews: 2,
      visitors: 1,
      sessions: 0,
    });
  });
});

describe("ingest.ping", () => {
  const ping = (o: Partial<{ secret: string; site: string; hostname: string; pvId: string; ms: number }> = {}) => ({
    secret: SECRET,
    site: "picai.so",
    hostname: "picai.so",
    pvId: "a",
    ms: 60_000,
    ...o,
  });

  test("adds engaged time to the pageview, the session and the day", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    vi.setSystemTime(new Date("2026-10-13T17:01:00Z"));
    await t.mutation(api.ingest.ping, ping());
    await t.mutation(api.ingest.ping, ping({ ms: 15_000 }));

    const { pageviews, sessions, dailyStats } = await tables(t);
    expect(pageviews[0].durationMs).toBe(75_000);
    expect(sessions[0]).toMatchObject({ engagedMs: 75_000, lastSeenAt: Date.now() });
    // Time on page counts the pageview once, however many pings it sent
    expect(dailyStats[0]).toMatchObject({
      durationSumMs: 75_000,
      durationCount: 1,
      sessionEngagedMs: 75_000,
    });
  });

  test("caps a ping at 70 seconds and a pageview at 30 minutes", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    await t.mutation(api.ingest.ping, ping({ ms: 600_000 }));
    expect((await tables(t)).pageviews[0].durationMs).toBe(70_000);
    for (let i = 0; i < 30; i++) await t.mutation(api.ingest.ping, ping());
    const { pageviews, sessions, dailyStats } = await tables(t);
    expect(pageviews[0].durationMs).toBe(1_800_000);
    expect(sessions[0].engagedMs).toBe(1_800_000);
    expect(dailyStats[0]).toMatchObject({ durationSumMs: 1_800_000, sessionEngagedMs: 1_800_000 });
  });

  test("counts session time on the day the session started", async () => {
    const t = await setup();
    vi.setSystemTime(new Date("2026-10-14T06:55:00Z")); // Oct 13 in LA
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    vi.setSystemTime(new Date("2026-10-14T07:05:00Z")); // Oct 14
    await t.mutation(api.ingest.pageview, phone("b", "s1"));
    await t.mutation(api.ingest.ping, ping({ pvId: "b", ms: 20_000 }));
    const { dailyStats } = await tables(t);
    expect(dailyStats.map((d) => [d.date, d.durationSumMs, d.sessionEngagedMs])).toEqual([
      ["2026-10-13", 0, 20_000],
      ["2026-10-14", 20_000, 0],
    ]);
  });

  test("works for a cookieless pageview", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, hit({ pvId: "a", cookieless: true }));
    await t.mutation(api.ingest.ping, ping({ ms: 5_000 }));
    expect((await tables(t)).dailyStats[0]).toMatchObject({ durationSumMs: 5_000, durationCount: 1 });
  });

  test("ignores an unknown pvId, another site's pvId and zero or fractional time", async () => {
    const t = await setup();
    const asOwner = t.withIdentity({ tokenIdentifier: "clerk|user_1" });
    await asOwner.mutation(api.sites.create, { domain: "other.com", timezone: "UTC" });
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    await t.mutation(api.ingest.ping, ping({ pvId: "nope" }));
    await t.mutation(api.ingest.ping, ping({ site: "other.com", hostname: "other.com" }));
    await t.mutation(api.ingest.ping, ping({ ms: 0 }));
    await t.mutation(api.ingest.ping, ping({ ms: 1.5 }));
    const { pageviews, sessions } = await tables(t);
    expect(pageviews[0].durationMs).toBeUndefined();
    expect(sessions[0].engagedMs).toBe(0);
  });

  test("rejects a wrong secret and ignores a foreign hostname", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    await expect(t.mutation(api.ingest.ping, ping({ secret: "nope" }))).rejects.toThrow(
      "Invalid ingest secret",
    );
    await t.mutation(api.ingest.ping, ping({ hostname: "evil.com" }));
    expect((await tables(t)).pageviews[0].durationMs).toBeUndefined();
  });
});

describe("OS, region and city", () => {
  const sf = {
    os: "iOS",
    region: "CA",
    city: "San Francisco",
    lat: 37.8,
    lon: -122.4,
  };

  test("are stored on the session and counted per pageview with the visitor", async () => {
    const t = await setup();
    const ids = { visitorId: "11111111-1111-4111-8111-111111111111", sessionId: "22222222-2222-4222-8222-222222222222" };
    await t.mutation(api.ingest.pageview, hit({ ...sf, ...ids, pvId: "a" }));
    await t.mutation(api.ingest.pageview, hit({ ...sf, ...ids, pvId: "b", path: "/pricing" }));

    const { sessions, dailyDims } = await tables(t);
    expect(sessions[0]).toMatchObject(sf);
    const geo = dailyDims
      .filter((d) => d.dim === "os" || d.dim === "region" || d.dim === "city")
      .map((d) => [d.dim, d.key, d.pageviews, d.visitors])
      .sort();
    expect(geo).toEqual([
      ["city", "US/CA/San Francisco", 2, 1],
      ["os", "iOS", 2, 1],
      ["region", "US/CA", 2, 1],
    ]);
  });

  test("two cities with the same name in different regions stay apart", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, hit({ pvId: "a", region: "OR", city: "Portland" }));
    await t.mutation(api.ingest.pageview, hit({ pvId: "b", region: "ME", city: "Portland" }));
    const keys = (await tables(t)).dailyDims.filter((d) => d.dim === "city").map((d) => d.key);
    expect(keys.sort()).toEqual(["US/ME/Portland", "US/OR/Portland"]);
  });

  test("a city without a region keeps an empty region part", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, hit({ country: "SG", city: "Singapore" }));
    const { dailyDims } = await tables(t);
    expect(dailyDims.find((d) => d.dim === "city")?.key).toBe("SG//Singapore");
    expect(dailyDims.find((d) => d.dim === "region")?.key).toBe("Unknown");
  });

  test("cookieless hits are counted in the lists without storing a location", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, hit({ ...sf, cookieless: true }));
    const { sessions, pageviews, dailyDims } = await tables(t);
    expect(sessions).toHaveLength(0);
    expect(pageviews[0]).not.toHaveProperty("city");
    expect(dailyDims.find((d) => d.dim === "city")).toMatchObject({ key: "US/CA/San Francisco", visitors: 1 });
  });
});

type EventArg =
  | { type: "goal"; name: string; props?: Record<string, string> }
  | { type: "outbound"; url: string }
  | { type: "identify"; userId?: string; email?: string; name?: string };

const send = (pvId: string, event: EventArg, o: { secret?: string; site?: string; hostname?: string } = {}) => ({
  secret: SECRET,
  site: "picai.so",
  hostname: "picai.so",
  pvId,
  event,
  ...o,
});

async function eventDims(t: ReturnType<typeof convexTest>) {
  const { dailyDims } = await tables(t);
  return dailyDims
    .filter((d) => d.dim === "goal" || d.dim === "outbound")
    .map((d) => [d.dim, d.date, d.key, d.events, d.visitors])
    .sort();
}

describe("ingest.event", () => {
  test("a goal is stored with the pageview's path, visitor and session, and counted", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1", { path: "/pricing" }));
    await t.mutation(api.ingest.event, send("a", { type: "goal", name: "signup", props: { plan: "pro" } }));

    const { events, sessions } = await tables(t);
    expect(events).toEqual([
      expect.objectContaining({
        type: "goal",
        name: "signup",
        date: "2026-10-13",
        path: "/pricing",
        pvId: "a",
        visitorId: "vid-phone",
        sessionId: "s1",
        props: { plan: "pro" },
      }),
    ]);
    expect(sessions[0].goals).toBe(1);
    expect(await eventDims(t)).toEqual([["goal", "2026-10-13", "signup", 1, 1]]);
  });

  test("the first goal takes the bounce off its session, once", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    await t.mutation(api.ingest.event, send("a", { type: "goal", name: "signup" }));
    await t.mutation(api.ingest.event, send("a", { type: "goal", name: "newsletter" }));
    // A second pageview after a goal must not take the bounce off again
    await t.mutation(api.ingest.pageview, phone("b", "s1", { path: "/thanks", unique: false }));

    const { dailyStats, sessions } = await tables(t);
    expect(sessions[0]).toMatchObject({ goals: 2, pageviews: 2 });
    expect(dailyStats[0]).toMatchObject({ sessions: 1, bounces: 0 });
  });

  test("the same goal twice on one pageview counts once", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    await t.mutation(api.ingest.event, send("a", { type: "goal", name: "signup" }));
    await t.mutation(api.ingest.event, send("a", { type: "goal", name: "signup" }));

    const { events, sessions } = await tables(t);
    expect(events).toHaveLength(1);
    expect(sessions[0].goals).toBe(1);
    expect(await eventDims(t)).toEqual([["goal", "2026-10-13", "signup", 1, 1]]);
  });

  test("a visitor counts once per goal and day, every completion counts", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    await t.mutation(api.ingest.event, send("a", { type: "goal", name: "signup" }));
    await t.mutation(api.ingest.pageview, phone("b", "s1", { unique: false }));
    await t.mutation(api.ingest.event, send("b", { type: "goal", name: "signup" }));
    vi.setSystemTime(new Date("2026-10-14T17:00:00Z")); // next local day
    await t.mutation(api.ingest.pageview, phone("c", "s2"));
    await t.mutation(api.ingest.event, send("c", { type: "goal", name: "signup" }));

    expect(await eventDims(t)).toEqual([
      ["goal", "2026-10-13", "signup", 2, 1],
      ["goal", "2026-10-14", "signup", 1, 1],
    ]);
  });

  test("an outbound click is counted per link, without touching the bounce", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    await t.mutation(api.ingest.event, send("a", { type: "outbound", url: "https://github.com/acme" }));
    await t.mutation(api.ingest.event, send("a", { type: "outbound", url: "https://github.com/acme" }));
    await t.mutation(api.ingest.event, send("a", { type: "outbound", url: "https://x.com/acme" }));

    const { dailyStats, sessions, events } = await tables(t);
    expect(events.map((e) => [e.type, e.name])).toEqual([
      ["outbound", "https://github.com/acme"],
      ["outbound", "https://x.com/acme"],
    ]);
    expect(sessions[0].goals).toBe(0);
    expect(dailyStats[0].bounces).toBe(1);
    expect(await eventDims(t)).toEqual([
      ["outbound", "2026-10-13", "https://github.com/acme", 1, 1],
      ["outbound", "2026-10-13", "https://x.com/acme", 1, 1],
    ]);
  });

  test("an event is dated on its own day, the bounce on the session's", async () => {
    const t = await setup();
    vi.setSystemTime(new Date("2026-10-14T06:50:00Z")); // 23:50 on the 13th in Los Angeles
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    vi.setSystemTime(new Date("2026-10-14T07:10:00Z")); // 00:10 on the 14th
    await t.mutation(api.ingest.event, send("a", { type: "goal", name: "signup" }));

    const { dailyStats, events } = await tables(t);
    expect(events[0].date).toBe("2026-10-14");
    expect(dailyStats.find((d) => d.date === "2026-10-13")).toMatchObject({ sessions: 1, bounces: 0 });
  });

  test("identify writes the user id, lower-cased email and name onto the visitor", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    await t.mutation(
      api.ingest.event,
      send("a", { type: "identify", userId: "u_1", email: " Jo@Example.com", name: "Jo" }),
    );
    // A later call with only some fields keeps the others
    await t.mutation(api.ingest.event, send("a", { type: "identify", name: "Jo Smith" }));

    const { visitors, events, dailyDims } = await tables(t);
    expect(visitors[0]).toMatchObject({ userId: "u_1", email: "jo@example.com", name: "Jo Smith" });
    expect(events.map((e) => [e.type, e.name])).toEqual([["identify", "identify"]]);
    expect(dailyDims.some((d) => d.dim === "goal")).toBe(false);
  });

  test("a goal from a cookieless pageview counts without a visitor or session; identify is dropped", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, hit({ pvId: "a", cookieless: true }));
    await t.mutation(api.ingest.event, send("a", { type: "goal", name: "signup" }));
    await t.mutation(api.ingest.event, send("a", { type: "identify", email: "jo@example.com" }));

    const { events, visitors } = await tables(t);
    expect(events).toEqual([expect.objectContaining({ type: "goal", name: "signup" })]);
    expect(events[0].visitorId).toBeUndefined();
    expect(visitors).toHaveLength(0);
    expect(await eventDims(t)).toEqual([["goal", "2026-10-13", "signup", 1, 1]]);
  });

  test("ignores an unknown pvId and another site's pageview", async () => {
    const t = await setup();
    await t
      .withIdentity({ subject: "user_2", tokenIdentifier: "clerk|user_2" })
      .mutation(api.sites.create, { domain: "other.com", timezone: "UTC" });
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    await t.mutation(api.ingest.event, send("nope", { type: "goal", name: "signup" }));
    await t.mutation(
      api.ingest.event,
      send("a", { type: "goal", name: "signup" }, { site: "other.com", hostname: "other.com" }),
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers); // the unknown pvId's one retry

    const { events, dailyDims } = await tables(t);
    expect(events).toHaveLength(0);
    expect(dailyDims.some((d) => d.dim === "goal")).toBe(false);
  });

  test("an event that arrives before its pageview is recorded on a retry, at its own time", async () => {
    const t = await setup();
    await t.mutation(api.ingest.event, send("a", { type: "goal", name: "signup" }));
    const sentAt = Date.now();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const { events, sessions, dailyStats } = await tables(t);
    expect(events).toEqual([expect.objectContaining({ name: "signup", ts: sentAt, sessionId: "s1" })]);
    expect(sessions[0].goals).toBe(1);
    expect(dailyStats[0].bounces).toBe(0);
  });

  test("ignores a hostname that does not match the site", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    await t.mutation(api.ingest.event, send("a", { type: "goal", name: "signup" }, { hostname: "evil.com" }));
    expect((await tables(t)).events).toHaveLength(0);
  });

  test("keeps at most 50 events per pageview", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    for (let i = 0; i < 55; i++) {
      await t.mutation(api.ingest.event, send("a", { type: "goal", name: `g${i}` }));
    }
    expect((await tables(t)).events).toHaveLength(50);
  });

  test("rejects a wrong secret", async () => {
    const t = await setup();
    await t.mutation(api.ingest.pageview, phone("a", "s1"));
    await expect(
      t.mutation(api.ingest.event, send("a", { type: "goal", name: "signup" }, { secret: "wrong" })),
    ).rejects.toThrow("Invalid ingest secret");
  });
});

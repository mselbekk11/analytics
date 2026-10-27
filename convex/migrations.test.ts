/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test-secret";
const SESSION_DIMS = new Set(["source", "channel", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "entry", "exit"]);

type T = ReturnType<typeof convexTest>;

let pvCounter = 0;

async function hit(
  t: T,
  iso: string,
  o: {
    referrer?: string;
    path?: string;
    unique?: boolean;
    vid?: string;
    sid?: string;
    cookieless?: boolean;
    campaign?: { utmSource?: string; utmCampaign?: string };
  } = {},
) {
  vi.setSystemTime(new Date(iso));
  await t.mutation(api.ingest.pageview, {
    secret: SECRET,
    site: "picai.so",
    hostname: "picai.so",
    path: o.path ?? "/",
    referrer: o.referrer ?? "(direct)",
    unique: o.unique ?? true,
    device: "desktop",
    browser: "Chrome",
    country: "US",
    pvId: `pv-${++pvCounter}`,
    visitorId: o.vid,
    sessionId: o.sid,
    cookieless: o.cookieless,
    campaign: o.campaign,
  });
}

async function setup() {
  const t = convexTest(schema, modules);
  await t
    .withIdentity({ subject: "user_1", tokenIdentifier: "clerk|user_1" })
    .mutation(api.sites.create, { domain: "picai.so", timezone: "America/Los_Angeles" });
  return t;
}

/** Traffic from before 5b: old cookieless days, then 5a sessions (dates in Los Angeles). */
async function oldTraffic(t: T) {
  // Oct 10: before visitor tracking
  await hit(t, "2026-10-10T17:00:00Z", { referrer: "google.com" });
  await hit(t, "2026-10-10T17:01:00Z", { path: "/a" });
  await hit(t, "2026-10-10T17:02:00Z", { unique: false });
  await hit(t, "2026-10-10T17:03:00Z", { referrer: "chatgpt.com" });
  // Oct 12: tracking starts; an old cached script still sends a hit without ids
  await hit(t, "2026-10-12T17:00:00Z", { referrer: "google.com", vid: "v1", sid: "s1" });
  await hit(t, "2026-10-12T17:01:00Z", { path: "/pricing", unique: false, vid: "v1", sid: "s1" });
  await hit(t, "2026-10-12T17:05:00Z", { referrer: "bing.com" });
  await hit(t, "2026-10-12T18:00:00Z", { referrer: "google.com", vid: "v1", sid: "s2" });
  await hit(t, "2026-10-12T19:00:00Z", { referrer: "chatgpt.com", vid: "v1", sid: "s3" });
  // Oct 13
  await hit(t, "2026-10-13T17:00:00Z", { vid: "v2", sid: "s4" });
}

/** Traffic after 5b went live, including a page in a session that started before it. */
async function newTraffic(t: T) {
  await hit(t, "2026-10-13T18:00:00Z", { vid: "v3", sid: "s5", campaign: { utmSource: "test", utmCampaign: "phase5b" } });
  await hit(t, "2026-10-13T18:01:00Z", { referrer: "t.co", cookieless: true });
  await hit(t, "2026-10-13T18:02:00Z", { path: "/x", unique: false, vid: "v2", sid: "s4" });
}

/** Undoes what 5b's ingest wrote, leaving the data as 5a left it. */
async function stripSources(t: T) {
  await t.run(async (ctx) => {
    for (const d of await ctx.db.query("dailyDims").collect()) {
      if (SESSION_DIMS.has(d.dim)) await ctx.db.delete("dailyDims", d._id);
    }
    for (const s of await ctx.db.query("sessions").collect()) {
      await ctx.db.patch("sessions", s._id, { source: undefined, channel: undefined });
    }
    for (const v of await ctx.db.query("visitors").collect()) {
      await ctx.db.patch("visitors", v._id, { firstSource: undefined, firstChannel: undefined });
    }
    for (const s of await ctx.db.query("sites").collect()) {
      await ctx.db.patch("sites", s._id, { sourcesStartedAt: undefined });
    }
  });
}

async function snapshot(t: T) {
  return t.run(async (ctx) => ({
    dims: (await ctx.db.query("dailyDims").collect())
      .filter((d) => SESSION_DIMS.has(d.dim) && ((d.sessions ?? 0) !== 0 || d.visitors !== 0))
      .map((d) => [d.date, d.dim, d.key, d.sessions ?? 0, d.visitors])
      .sort(),
    sessions: (await ctx.db.query("sessions").collect()).map((s) => [s.sessionId, s.source, s.channel]),
    visitors: (await ctx.db.query("visitors").collect()).map((v) => [v.visitorId, v.firstSource]),
  }));
}

async function backfill(t: T) {
  await t.mutation(internal.migrations.backfillSources, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

beforeEach(() => {
  vi.stubEnv("INGEST_SECRET", SECRET);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("migrations.backfillSources", () => {
  test("rebuilds the same source, channel, entry and exit rows as 5b's ingest", async () => {
    const live = await setup();
    await oldTraffic(live);
    await newTraffic(live);
    const expected = await snapshot(live);

    const t = await setup();
    await oldTraffic(t);
    await stripSources(t);
    await newTraffic(t);
    await backfill(t);

    expect(await snapshot(t)).toEqual(expected);
    // Spot checks on the expected rows themselves
    expect(expected.dims).toContainEqual(["2026-10-10", "source", "Google", 0, 1]);
    expect(expected.dims).toContainEqual(["2026-10-10", "channel", "Direct", 0, 1]);
    expect(expected.dims).toContainEqual(["2026-10-12", "source", "Google", 2, 1]);
    expect(expected.dims).toContainEqual(["2026-10-12", "source", "Bing", 0, 1]);
    expect(expected.dims).toContainEqual(["2026-10-13", "exit", "/x", 1, 0]);
    expect(expected.visitors).toContainEqual(["v1", "Google"]);
  });

  test("works for a site with no traffic since 5b, and running it twice changes nothing", async () => {
    const live = await setup();
    await oldTraffic(live);
    const expected = await snapshot(live);

    const t = await setup();
    await oldTraffic(t);
    await stripSources(t);
    vi.setSystemTime(new Date("2026-10-20T00:00:00Z"));
    await backfill(t);
    await backfill(t);

    expect(await snapshot(t)).toEqual(expected);
  });
});

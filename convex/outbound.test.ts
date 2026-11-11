/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Filter } from "./lib/filters";
import type { LinkSort } from "./lib/outbound";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test-secret";
const OWNER = { subject: "user_1", tokenIdentifier: "clerk|user_1" };
const STRANGER = { subject: "user_2", tokenIdentifier: "clerk|user_2" };
const DOMAIN = "picai.so";

const VID_A = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f7a";
const VID_B = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f7b";
const VID_C = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f7c";
const SID0 = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f70";
const SID1 = "1b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f71";
const SID2 = "2b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f72";
const SID3 = "3b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f73";
const SID9 = "9b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f79";

const WEEK = { from: "2026-10-07", to: "2026-10-13" };
const TABLE: { sort: LinkSort; desc: boolean; search: string; offset: number } = {
  sort: "clicks",
  desc: true,
  search: "",
  offset: 0,
};

type T = ReturnType<typeof convexTest>;
type Owner = ReturnType<T["withIdentity"]>;

/** A pageview at `iso`, then a click on each of `links` from it. */
async function visit(
  t: T,
  iso: string,
  o: { vid: string; sid: string; pvId: string; country?: string; links?: string[] },
) {
  vi.setSystemTime(new Date(iso));
  await t.mutation(api.ingest.pageview, {
    secret: SECRET,
    site: DOMAIN,
    hostname: DOMAIN,
    path: "/",
    referrer: "(direct)",
    unique: true,
    device: "desktop",
    browser: "Chrome",
    os: "Mac OS",
    country: o.country ?? "US",
    pvId: o.pvId,
    visitorId: o.vid,
    sessionId: o.sid,
  });
  for (const url of o.links ?? []) {
    await t.mutation(api.ingest.event, {
      secret: SECRET,
      site: DOMAIN,
      hostname: DOMAIN,
      pvId: o.pvId,
      event: { type: "outbound", url },
    });
  }
}

/**
 * Visitor tracking starts on 20 Sep. 3 Oct (the week before): A clicks github once.
 * 12 Oct (LA): A clicks github and twitter, then github again on a second page; B
 * (Germany) clicks github as http with a trailing slash. 13 Oct: C clicks github.
 */
async function seed() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity(OWNER);
  await owner.mutation(api.sites.create, { domain: DOMAIN, timezone: "America/Los_Angeles" });
  await visit(t, "2026-09-20T17:00:00Z", { vid: VID_A, sid: SID9, pvId: "z1" });
  await visit(t, "2026-10-03T17:00:00Z", { vid: VID_A, sid: SID0, pvId: "p1", links: ["https://github.com/acme"] });
  await visit(t, "2026-10-12T17:00:00Z", {
    vid: VID_A,
    sid: SID1,
    pvId: "a1",
    links: ["https://github.com/acme", "https://twitter.com/acmehq"],
  });
  await visit(t, "2026-10-12T17:05:00Z", { vid: VID_A, sid: SID1, pvId: "a2", links: ["https://github.com/acme"] });
  await visit(t, "2026-10-12T18:00:00Z", {
    vid: VID_B,
    sid: SID2,
    pvId: "b1",
    country: "DE",
    links: ["http://github.com/acme/"],
  });
  await visit(t, "2026-10-13T16:00:00Z", { vid: VID_C, sid: SID3, pvId: "c1", links: ["https://github.com/acme"] });
  return { t, owner };
}

type Range = { from: string; to: string } | { period: "today" | "yesterday" | "24h"; now: number };

async function ok(owner: Owner, opts: { range?: Range; filters?: Filter[] } & Partial<typeof TABLE> = {}) {
  const { range = WEEK, filters = [], ...table } = opts;
  const result = await owner.query(api.outbound.list, { domain: DOMAIN, range, filters, ...TABLE, ...table });
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

test("the links table belongs to the site's owner", async () => {
  const { t } = await seed();
  const args = { domain: DOMAIN, range: WEEK, filters: [], ...TABLE };
  await t.withIdentity(STRANGER).mutation(api.accounts.ensure, {});
  await expect(t.query(api.outbound.list, args)).rejects.toThrow(/Not signed in/);
  await expect(t.withIdentity(STRANGER).query(api.outbound.list, args)).rejects.toThrow(/Site not found/);
});

test("from the rollups: links grouped by host and path, unique visitors, change and the card's totals", async () => {
  const { owner } = await seed();
  const result = await ok(owner);
  expect(result).toMatchObject({ offset: 0, matched: 2, links: 2, comparable: true });
  // http://github.com/acme/ is the same link; A's two github clicks on 12 Oct are one visitor
  expect(result.rows.map((r) => [r.key, r.url, r.clicks, r.visitors, r.visitorsChange])).toEqual([
    ["github.com/acme", "https://github.com/acme", 4, 3, 2],
    ["twitter.com/acmehq", "https://twitter.com/acmehq", 1, 1, null],
  ]);
  // 7 to 13 Oct
  expect(result.rows[0].trend).toEqual([0, 0, 0, 0, 0, 3, 1]);
  expect(result.chart.map((p) => p.clicks)).toEqual([0, 0, 0, 0, 0, 4, 1]);
  expect(result.chart[5].date).toBe("2026-10-12");
  expect(result.totals).toEqual({ clicks: 5, previousClicks: 1, unique: 4, previousUnique: 1, links: 2, previousLinks: 1 });

  // The same numbers as the Analytics Pages card's Outbound list
  const card = await owner.query(api.stats.breakdown, { domain: DOMAIN, ...WEEK, dim: "outbound" });
  expect(card.totalEvents).toBe(result.totals.clicks);
  expect(card.rows.reduce((n, r) => n + r.visitors, 0)).toBe(result.totals.unique);
});

test("sorts, searches and pages over every link", async () => {
  const { owner } = await seed();
  expect((await ok(owner, { sort: "link", desc: true })).rows.map((r) => r.key)).toEqual([
    "twitter.com/acmehq",
    "github.com/acme",
  ]);
  expect((await ok(owner, { sort: "visitors", desc: false })).rows[0].key).toBe("twitter.com/acmehq");
  const search = await ok(owner, { search: "TWITTER" });
  expect(search.rows.map((r) => r.key)).toEqual(["twitter.com/acmehq"]);
  expect(search).toMatchObject({ matched: 1, links: 2 });
  expect(await ok(owner, { offset: 50 })).toMatchObject({ offset: 0 });
});

test("with filters: the matching sessions' clicks, as the filtered Outbound list counts them", async () => {
  const { owner } = await seed();
  const de: Filter[] = [{ dim: "country", value: "DE" }];
  const result = await ok(owner, { filters: de });
  expect(result.rows.map((r) => [r.key, r.url, r.clicks, r.visitors])).toEqual([
    ["github.com/acme", "http://github.com/acme/", 1, 1],
  ]);
  expect(result.totals).toMatchObject({ clicks: 1, unique: 1, links: 1, previousClicks: 0 });
  const card = await owner.query(api.stats.filtered, { domain: DOMAIN, ...WEEK, filters: de });
  if (card.status !== "ok") throw new Error(card.status);
  expect(card.breakdowns.outbound.totalEvents).toBe(1);

  // A filter every session matches gives the rollups' clicks, with distinct visitors
  const all = await ok(owner, { filters: [{ dim: "device", value: "desktop" }] });
  expect(all.rows.map((r) => [r.key, r.clicks, r.visitors, r.visitorsChange])).toEqual([
    ["github.com/acme", 4, 3, 2],
    ["twitter.com/acmehq", 1, 1, null],
  ]);
  expect(all.totals).toEqual({ clicks: 5, previousClicks: 1, unique: 4, previousUnique: 1, links: 2, previousLinks: 1 });
  expect(all.chart.map((p) => p.clicks)).toEqual([0, 0, 0, 0, 0, 4, 1]);

  // Filtering an outbound link keeps the sessions that clicked it
  const twitter = await ok(owner, { filters: [{ dim: "outbound", value: "https://twitter.com/acmehq" }] });
  expect(twitter.totals.clicks).toBe(3); // A's session: github twice and twitter
});

test("hour ranges: clicks per hour, matching the hourly Outbound list", async () => {
  const { owner } = await seed();
  // 13 Oct 10:00 in Los Angeles: Today is 13 Oct, C clicked at 09:00
  const now = Date.parse("2026-10-13T17:00:00Z");
  const result = await ok(owner, { range: { period: "today", now } });
  expect(result.rows.map((r) => [r.key, r.clicks])).toEqual([["github.com/acme", 1]]);
  // Midnight to the end of the current hour
  expect(result.chart).toHaveLength(11);
  expect(result.chart.find((p) => p.clicks > 0)).toEqual({ date: "2026-10-13T09:00", clicks: 1 });
  const card = await owner.query(api.stats.hourly, { domain: DOMAIN, period: "today", now, filters: [] });
  if (card.status !== "ok") throw new Error(card.status);
  expect(card.breakdowns.outbound.totalEvents).toBe(result.totals.clicks);
});

test("filtered ranges past the limit say so", async () => {
  const { owner } = await seed();
  const result = await owner.query(api.outbound.list, {
    domain: DOMAIN,
    range: { from: "2026-01-01", to: "2026-10-13" },
    filters: [{ dim: "country", value: "DE" }],
    ...TABLE,
  });
  expect(result).toEqual({ status: "range" });
});

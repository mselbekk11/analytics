/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Filter } from "./lib/filters";
import type { PageSort } from "./lib/pages";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "test-secret";
const OWNER = { subject: "user_1", tokenIdentifier: "clerk|user_1" };
const STRANGER = { subject: "user_2", tokenIdentifier: "clerk|user_2" };

const VID_A = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f7a";
const VID_B = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f7b";
const VID_C = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f7c";
const SID1 = "1b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f71";
const SID2 = "2b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f72";
const SID3 = "3b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f73";

const WEEK = { from: "2026-10-07", to: "2026-10-13" };
const TABLE: { sort: PageSort; desc: boolean; search: string; offset: number } = { sort: "views", desc: true, search: "", offset: 0 };

type T = ReturnType<typeof convexTest>;
type Owner = ReturnType<T["withIdentity"]>;

async function visit(
  t: T,
  iso: string,
  o: { vid: string; sid: string; pvId: string; path: string; country?: string; title?: string },
) {
  vi.setSystemTime(new Date(iso));
  await t.mutation(api.ingest.pageview, {
    secret: SECRET,
    site: "picai.so",
    hostname: "picai.so",
    path: o.path,
    referrer: "(direct)",
    unique: true,
    device: "desktop",
    browser: "Chrome",
    os: "Mac OS",
    country: o.country ?? "US",
    pvId: o.pvId,
    visitorId: o.vid,
    sessionId: o.sid,
    title: o.title,
  });
}

/**
 * 12 Oct (LA): A reads / then /pricing; B (Germany) reads /pricing twice. 13 Oct: C
 * reads / and /blog/hello.
 */
async function seed() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity(OWNER);
  await owner.mutation(api.sites.create, { domain: "picai.so", timezone: "America/Los_Angeles" });
  await visit(t, "2026-10-12T17:00:00Z", { vid: VID_A, sid: SID1, pvId: "a1", path: "/" });
  await visit(t, "2026-10-12T17:01:00Z", { vid: VID_A, sid: SID1, pvId: "a2", path: "/pricing" });
  await visit(t, "2026-10-12T18:00:00Z", { vid: VID_B, sid: SID2, pvId: "b1", path: "/pricing", country: "DE" });
  await visit(t, "2026-10-12T18:02:00Z", { vid: VID_B, sid: SID2, pvId: "b2", path: "/pricing", country: "DE" });
  await visit(t, "2026-10-13T16:00:00Z", { vid: VID_C, sid: SID3, pvId: "c1", path: "/" });
  await visit(t, "2026-10-13T16:05:00Z", { vid: VID_C, sid: SID3, pvId: "c2", path: "/blog/hello" });
  return { t, owner };
}

async function list(
  owner: Owner,
  opts: { range?: { from: string; to: string } | { period: "today" | "yesterday" | "24h"; now: number }; filters?: Filter[] } & Partial<typeof TABLE> = {},
) {
  const { range = WEEK, filters = [], ...table } = opts;
  return await owner.query(api.pages.list, { domain: "picai.so", range, filters, ...TABLE, ...table });
}

async function ok(owner: Owner, opts: Parameters<typeof list>[1] = {}) {
  const result = await list(owner, opts);
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

test("the pages table belongs to the site's owner", async () => {
  const { t } = await seed();
  const args = { domain: "picai.so", range: WEEK, filters: [], ...TABLE };
  await expect(t.query(api.pages.list, args)).rejects.toThrow(/Not signed in/);
  await expect(t.withIdentity(STRANGER).query(api.pages.list, args)).rejects.toThrow(/Site not found/);
  const filtered = { ...args, filters: [{ dim: "country" as const, value: "DE" }] };
  await expect(t.withIdentity(STRANGER).query(api.pages.list, filtered)).rejects.toThrow(/Site not found/);
});

test("from the rollups: the Pages card's counts, with views per day", async () => {
  const { owner } = await seed();
  const result = await ok(owner);
  expect(result).toMatchObject({ offset: 0, matched: 3, pages: 3, totalPageviews: 6 });
  // Sessions that viewed each page: B's two views of /pricing are one session
  expect(result.rows.map((r) => [r.path, r.views, r.sessions])).toEqual([
    ["/pricing", 3, 2],
    ["/", 2, 2],
    ["/blog/hello", 1, 1],
  ]);
  // 7 to 13 Oct
  expect(result.rows[0].trend).toEqual([0, 0, 0, 0, 0, 3, 0]);
  expect(result.rows[1].trend).toEqual([0, 0, 0, 0, 0, 1, 1]);
  expect(result.rows.every((r) => r.revenueMinor === 0)).toBe(true);

  // The same numbers as the dashboard's Pages card
  const card = await owner.query(api.stats.breakdown, { domain: "picai.so", ...WEEK, dim: "page" });
  expect(card.totalPageviews).toBe(result.totalPageviews);
  for (const r of result.rows) {
    expect(card.rows.find((c) => c.key === r.path)!.pageviews).toBe(r.views);
  }
});

test("sorts, searches and pages over the whole range", async () => {
  const { owner } = await seed();
  expect((await ok(owner, { sort: "path", desc: false })).rows.map((r) => r.path)).toEqual([
    "/",
    "/blog/hello",
    "/pricing",
  ]);
  const search = await ok(owner, { search: "PRIC" });
  expect(search.rows.map((r) => r.path)).toEqual(["/pricing"]);
  expect(search).toMatchObject({ matched: 1, pages: 3 });
  expect(await ok(owner, { offset: 50 })).toMatchObject({ offset: 0 });
});

test("with filters: only the matching sessions' pages, as the filtered dashboard counts them", async () => {
  const { owner } = await seed();
  const filters: Filter[] = [{ dim: "country", value: "DE" }];
  const result = await ok(owner, { filters });
  expect(result.rows.map((r) => [r.path, r.views, r.sessions, r.trend])).toEqual([
    ["/pricing", 2, 1, [0, 0, 0, 0, 0, 2, 0]],
  ]);
  expect(result).toMatchObject({ matched: 1, pages: 1, totalPageviews: 2 });

  const view = await owner.query(api.stats.filtered, { domain: "picai.so", ...WEEK, filters });
  if (view.status !== "ok") throw new Error(view.status);
  expect(view.breakdowns.page.rows.map((r) => [r.key, r.pageviews])).toEqual([["/pricing", 2]]);

  // A page filter keeps the sessions that viewed it, and so their other pages
  const viewed = await ok(owner, { filters: [{ dim: "page", value: "/blog/hello" }] });
  expect(viewed.rows.map((r) => [r.path, r.views])).toEqual([
    ["/", 1],
    ["/blog/hello", 1],
  ]);
});

test("filters on ranges over 90 days get the notice, as the dashboard does", async () => {
  const { owner } = await seed();
  const long = { from: "2026-01-01", to: "2026-10-13" };
  expect(await list(owner, { range: long, filters: [{ dim: "country", value: "DE" }] })).toEqual({ status: "range" });
  expect((await ok(owner, { range: long })).pages).toBe(3);
  await expect(list(owner, { range: { from: "2026-10-13", to: "2026-10-07" } })).rejects.toThrow(/Invalid date range/);
});

test("hour ranges count per hour, as stats.hourly does", async () => {
  const { owner } = await seed();
  // 13 Oct, 10:00 in LA: Today runs from midnight, so C's visit at 09:00 is in it
  const range = { period: "today" as const, now: Date.parse("2026-10-13T17:00:00Z") };
  const result = await ok(owner, { range });
  expect(result.rows.map((r) => [r.path, r.views])).toEqual([
    ["/", 1],
    ["/blog/hello", 1],
  ]);
  expect(result.rows[0].trend).toHaveLength(11);
  expect(result.rows[0].trend[9]).toBe(1);

  const hourly = await owner.query(api.stats.hourly, { domain: "picai.so", period: "today", now: range.now, filters: [] });
  if (hourly.status !== "ok") throw new Error(hourly.status);
  expect(hourly.breakdowns.page.totalPageviews).toBe(result.totalPageviews);
});

test("titles: the latest non-empty one shows over its path, and old paths have none", async () => {
  const { t, owner } = await seed();
  const titles = async () =>
    Object.fromEntries((await ok(owner, { range: { from: "2026-10-07", to: "2026-10-14" } })).rows.map((r) => [r.path, r.title]));
  // The seed's hits sent no titles
  expect(await titles()).toEqual({ "/pricing": null, "/": null, "/blog/hello": null });

  await visit(t, "2026-10-14T16:00:00Z", { vid: VID_A, sid: "s-t1", pvId: "t1", path: "/pricing", title: "  Pricing   — Picai " });
  expect(await titles()).toMatchObject({ "/pricing": "Pricing — Picai", "/": null });

  // A new title replaces it; an empty or missing one leaves it
  await visit(t, "2026-10-14T16:01:00Z", { vid: VID_A, sid: "s-t1", pvId: "t2", path: "/pricing", title: "Plans" });
  await visit(t, "2026-10-14T16:02:00Z", { vid: VID_A, sid: "s-t1", pvId: "t3", path: "/pricing", title: "   " });
  await visit(t, "2026-10-14T16:03:00Z", { vid: VID_A, sid: "s-t1", pvId: "t4", path: "/pricing" });
  expect(await titles()).toMatchObject({ "/pricing": "Plans", "/": null });

  const rows = await t.run((ctx) => ctx.db.query("pageTitles").collect());
  expect(rows.map((r) => [r.path, r.title, r.updatedAt])).toEqual([
    ["/pricing", "Plans", Date.parse("2026-10-14T16:01:00Z")],
  ]);

  // Search matches titles as well as paths
  const search = await ok(owner, { range: { from: "2026-10-07", to: "2026-10-14" }, search: "plan" });
  expect(search.rows.map((r) => [r.path, r.title])).toEqual([["/pricing", "Plans"]]);
});

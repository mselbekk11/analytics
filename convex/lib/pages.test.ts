import { describe, expect, test } from "vitest";
import { emptyPageEntry, pageTable, trendScore, type PageEntry, type PageSort } from "./pages";

function page(key: string, pageviews: number, sessions: number, trend: number[], more: Partial<PageEntry> = {}): PageEntry {
  return { ...emptyPageEntry(key, trend.length), pageviews, sessions, trend, ...more };
}

const PAGES = [
  page("/", 30, 20, [10, 10, 10], { entries: 16, bounces: 4, engagedMs: 90_000, durationCount: 3, previousSessions: 10 }),
  page("/pricing", 12, 9, [0, 4, 8], { revenueMinor: 4900, entries: 2, bounces: 2, engagedMs: 60_000, durationCount: 1 }),
  page("/blog/hello", 12, 11, [8, 4, 0], { entries: 4, bounces: 1, previousSessions: 22 }),
  // Cookieless: time, but no sessions
  page("/blog/post-1", 3, 0, [1, 1, 1], { engagedMs: 5_000, durationCount: 1 }),
  page("/gone", 0, 0, [0, 0, 0], { previousSessions: 4 }),
];

const opts = { sort: "views" as const, desc: true, search: "", offset: 0, comparable: true };

describe("trendScore", () => {
  test("is the slope over the mean: rising is positive, falling negative, flat zero", () => {
    expect(trendScore([1, 2, 3])).toBeCloseTo(0.5);
    expect(trendScore([3, 2, 1])).toBeCloseTo(-0.5);
    expect(trendScore([5, 5, 5])).toBe(0);
    expect(trendScore([0, 0])).toBe(0);
    expect(trendScore([7])).toBe(0);
  });

  test("a small page that doubles outranks a big one growing a little", () => {
    expect(trendScore([1, 2])).toBeGreaterThan(trendScore([100, 110]));
  });
});

describe("pageTable", () => {
  test("defaults to views, largest first, ties by path, and leaves out pages with no views", () => {
    const t = pageTable(PAGES, opts);
    expect(t.rows.map((r) => r.path)).toEqual(["/", "/blog/hello", "/pricing", "/blog/post-1"]);
    expect(t).toMatchObject({ offset: 0, matched: 4, pages: 4 });
    expect(t.rows[2]).toEqual({
      path: "/pricing",
      title: null,
      views: 12,
      sessions: 9,
      sessionsChange: null, // none before
      bounceRate: 1,
      durationMs: 60_000,
      revenueMinor: 4900,
      trend: [0, 4, 8],
    });
  });

  test("bounce is over the sessions that started on the page, duration over pageviews that sent time", () => {
    const rows = pageTable(PAGES, opts).rows;
    expect(rows[0]).toMatchObject({ path: "/", sessions: 20, sessionsChange: 1, bounceRate: 0.25, durationMs: 30_000 });
    expect(rows[1]).toMatchObject({ path: "/blog/hello", sessionsChange: -0.5, bounceRate: 0.25, durationMs: null });
    expect(rows[3]).toMatchObject({ path: "/blog/post-1", sessions: 0, bounceRate: null, durationMs: 5_000 });
    // Visitor tracking started in between: no changes
    expect(pageTable(PAGES, { ...opts, comparable: false }).rows.map((r) => r.sessionsChange)).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  test("sorts by each column, both ways", () => {
    const paths = (sort: PageSort, desc: boolean) =>
      pageTable(PAGES, { ...opts, sort, desc }).rows.map((r) => r.path);
    expect(paths("path", false)).toEqual(["/", "/blog/hello", "/blog/post-1", "/pricing"]);
    expect(paths("path", true)).toEqual(["/pricing", "/blog/post-1", "/blog/hello", "/"]);
    // Numbers in paths sort by value
    const numbered = [page("/p10", 1, 1, [1]), page("/p9", 1, 1, [1])];
    expect(pageTable(numbered, { ...opts, sort: "path", desc: false }).rows.map((r) => r.path)).toEqual(["/p9", "/p10"]);
    expect(paths("trend", true)).toEqual(["/pricing", "/", "/blog/post-1", "/blog/hello"]);
    expect(paths("sessions", true)).toEqual(["/", "/blog/hello", "/pricing", "/blog/post-1"]);
    expect(paths("sessions", false)).toEqual(["/blog/post-1", "/pricing", "/blog/hello", "/"]);
    // Pages without a bounce rate or a duration go last, either way
    expect(paths("bounce", true)).toEqual(["/pricing", "/", "/blog/hello", "/blog/post-1"]);
    expect(paths("bounce", false)).toEqual(["/", "/blog/hello", "/pricing", "/blog/post-1"]);
    expect(paths("duration", true)).toEqual(["/pricing", "/", "/blog/post-1", "/blog/hello"]);
    expect(paths("duration", false)).toEqual(["/blog/post-1", "/", "/pricing", "/blog/hello"]);
    // Equal revenue keeps the views order
    expect(paths("revenue", true)).toEqual(["/pricing", "/", "/blog/hello", "/blog/post-1"]);
  });

  test("search keeps paths containing the text, ignoring case, and counts them", () => {
    const t = pageTable(PAGES, { ...opts, search: "  BLOG " });
    expect(t.rows.map((r) => r.path)).toEqual(["/blog/hello", "/blog/post-1"]);
    expect(t).toMatchObject({ matched: 2, pages: 4 });
    expect(pageTable(PAGES, { ...opts, search: "nothing" })).toMatchObject({ rows: [], matched: 0, pages: 4 });
  });

  test("with titles, search matches them too, and rows carry them", () => {
    const titles = new Map([
      ["/pricing", "Plans and Pricing"],
      ["/blog/hello", "Hello, world"],
    ]);
    const t = pageTable(PAGES, { ...opts, search: "PLANS", titles });
    expect(t.rows.map((r) => [r.path, r.title])).toEqual([["/pricing", "Plans and Pricing"]]);
    expect(pageTable(PAGES, { ...opts, titles }).rows.map((r) => r.title)).toEqual([
      null,
      "Hello, world",
      "Plans and Pricing",
      null,
    ]);
  });

  test("pages through the rows, snapping the offset to a page and back from past the end", () => {
    const many = Array.from({ length: 120 }, (_, i) => page(`/p${String(i).padStart(3, "0")}`, 200 - i, 1, [1]));
    const first = pageTable(many, opts);
    expect(first.rows).toHaveLength(50);
    expect(first.rows[0].path).toBe("/p000");
    expect(first.matched).toBe(120);
    const third = pageTable(many, { ...opts, offset: 100 });
    expect(third).toMatchObject({ offset: 100 });
    expect(third.rows.map((r) => r.path)).toEqual(many.slice(100).map((p) => p.key));
    expect(pageTable(many, { ...opts, offset: 57 }).offset).toBe(50);
    expect(pageTable(many, { ...opts, offset: 500 }).offset).toBe(100);
    expect(pageTable(many, { ...opts, offset: -10 }).offset).toBe(0);
    expect(pageTable([], { ...opts, offset: 50 })).toMatchObject({ offset: 0, rows: [], matched: 0 });
  });
});

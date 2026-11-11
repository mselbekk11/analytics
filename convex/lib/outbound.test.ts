import { expect, test } from "vitest";
import { groupLinks, linkKey, linkTable, linkTiles, splitLinkKey, type RawLink } from "./outbound";

test("links are keyed by host and path, without scheme or trailing slash", () => {
  expect(linkKey("https://github.com/acme/widget")).toBe("github.com/acme/widget");
  expect(linkKey("http://github.com/acme/widget/")).toBe("github.com/acme/widget");
  expect(linkKey("https://docs.stripe.com/")).toBe("docs.stripe.com");
  expect(linkKey("https://docs.stripe.com")).toBe("docs.stripe.com");
  expect(linkKey("https://Status.Acme.dev:8443/x")).toBe("status.acme.dev:8443/x");
  // Subdomains are other links
  expect(linkKey("https://www.github.com/acme")).toBe("www.github.com/acme");
  expect(linkKey("not a url/")).toBe("not a url");
  expect(splitLinkKey("github.com/acme/widget")).toEqual({ host: "github.com", path: "/acme/widget" });
  expect(splitLinkKey("docs.stripe.com")).toEqual({ host: "docs.stripe.com", path: "" });
});

const raw = (url: string, clicks: number, visitors: number, trend: number[]): RawLink => ({
  url,
  clicks,
  visitors,
  previousVisitors: 0,
  trend,
});

test("grouping adds up the URLs of one host and path and keeps the most clicked URL", () => {
  const links = groupLinks([
    raw("http://github.com/acme/", 1, 1, [1, 0]),
    raw("https://github.com/acme", 3, 2, [1, 2]),
    raw("https://twitter.com/acmehq", 2, 2, [0, 2]),
  ]);
  expect(links).toEqual([
    { key: "github.com/acme", url: "https://github.com/acme", clicks: 4, visitors: 3, previousVisitors: 0, trend: [2, 2] },
    { key: "twitter.com/acmehq", url: "https://twitter.com/acmehq", clicks: 2, visitors: 2, previousVisitors: 0, trend: [0, 2] },
  ]);
});

test("the table sorts, searches and pages, with each link's visitors change", () => {
  const links = [
    { key: "b.com/x", url: "https://b.com/x", clicks: 5, visitors: 4, previousVisitors: 2, trend: [5, 0] },
    { key: "a.com", url: "https://a.com/", clicks: 2, visitors: 2, previousVisitors: 0, trend: [0, 2] },
    { key: "c.com", url: "https://c.com/", clicks: 0, visitors: 0, previousVisitors: 3, trend: [0, 0] },
  ];
  const opts = { sort: "clicks" as const, desc: true, search: "", offset: 0, comparable: true };
  const table = linkTable(links, opts);
  // Links without clicks in the range are left out
  expect(table).toMatchObject({ matched: 2, links: 2, offset: 0 });
  expect(table.rows.map((r) => [r.key, r.visitorsChange])).toEqual([
    ["b.com/x", 1],
    ["a.com", null],
  ]);
  expect(linkTable(links, { ...opts, comparable: false }).rows[0].visitorsChange).toBeNull();
  expect(linkTable(links, { ...opts, sort: "link", desc: false }).rows.map((r) => r.key)).toEqual(["a.com", "b.com/x"]);
  // Rising first
  expect(linkTable(links, { ...opts, sort: "trend" }).rows.map((r) => r.key)).toEqual(["a.com", "b.com/x"]);
  expect(linkTable(links, { ...opts, search: "B.COM" })).toMatchObject({ matched: 1, links: 2 });
  expect(linkTable(links, { ...opts, offset: 1, limit: 1 })).toMatchObject({ offset: 1 });
  expect(linkTable(links, { ...opts, offset: 99, limit: 1 })).toMatchObject({ offset: 1 });
});

test("tiles: totals and their change against the period before", () => {
  const totals = { clicks: 6, previousClicks: 4, unique: 4, previousUnique: 2, links: 2, previousLinks: 1 };
  const tiles = linkTiles(totals, true);
  expect(tiles.clicks).toEqual({ value: 6, change: 0.5 });
  expect(tiles.unique).toEqual({ value: 4, change: 1 });
  expect(tiles.links).toEqual({ value: 2, change: 1 });
  // 3 a link now, 4 before
  expect(tiles.perLink).toEqual({ value: 3, change: -0.25 });
  expect(linkTiles(totals, false).unique.change).toBeNull();
  const none = linkTiles({ ...totals, clicks: 0, unique: 0, links: 0, previousLinks: 0, previousClicks: 0 }, true);
  expect(none.perLink).toEqual({ value: null, change: null });
  expect(none.clicks.change).toBeNull();
});

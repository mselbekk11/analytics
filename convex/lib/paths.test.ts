import { describe, expect, test } from "vitest";
import {
  groupPath,
  isExcludedPath,
  isIdSegment,
  matchesNamedPattern,
  matchesPattern,
  parseExcludedPath,
  parseNamedPattern,
  parsePlaceholder,
  type PathGrouping,
} from "./paths";

describe("parseExcludedPath", () => {
  test.each([
    ["/admin/*", "/admin/*"],
    ["  /preview  ", "/preview"],
    ["/preview/", "/preview"],
    ["/blog/**", "/blog/*"],
    ["//admin//*", "/admin/*"],
    ["/", "/"],
    ["/*", "/*"],
  ])("%j -> %j", (input, pattern) => {
    expect(parseExcludedPath(input)).toEqual({ pattern });
  });

  test.each(["", "   ", "admin/*", "/admin page", "/search?q=*", "/top#x", `/${"a".repeat(200)}`])(
    "rejects %j with a message",
    (input) => {
      const result = parseExcludedPath(input);
      expect(result).toHaveProperty("error");
      expect("error" in result && result.error.length > 0).toBe(true);
    },
  );
});

describe("matchesPattern", () => {
  test.each([
    // Exact
    ["/preview", "/preview", true],
    ["/preview/", "/preview", true],
    ["/preview/x", "/preview", false],
    ["/previews", "/preview", false],
    ["/Preview", "/preview", false],
    ["/", "/", true],
    ["/a", "/", false],
    // Trailing wildcard: everything under the prefix, and the prefix itself
    ["/admin/x", "/admin/*", true],
    ["/admin/x/y", "/admin/*", true],
    ["/admin", "/admin/*", true],
    ["/admin/", "/admin/*", true],
    ["/administrator", "/admin/*", false],
    ["/", "/admin/*", false],
    // Wildcards elsewhere
    ["/blog", "/blog*", true],
    ["/blogs/new", "/blog*", true],
    ["/blo", "/blog*", false],
    ["/u/42/edit", "/u/*/edit", true],
    ["/u/42/view", "/u/*/edit", false],
    ["/a.b", "/a.b", true],
    ["/axb", "/a.b", false],
    ["/anything", "/*", true],
    ["/", "/*", true],
  ])("%j against %j is %s", (path, pattern, expected) => {
    expect(matchesPattern(path, pattern)).toBe(expected);
  });
});

describe("isExcludedPath", () => {
  test("any pattern matching excludes; none or no list keeps the path", () => {
    expect(isExcludedPath("/admin/x", ["/preview", "/admin/*"])).toBe(true);
    expect(isExcludedPath("/pricing", ["/preview", "/admin/*"])).toBe(false);
    expect(isExcludedPath("/pricing", [])).toBe(false);
    expect(isExcludedPath("/pricing", undefined)).toBe(false);
  });
});

describe("parsePlaceholder", () => {
  test.each([
    [":id", ":id"],
    ["  :slug ", ":slug"],
    ["record_id", ":record_id"],
    ["", ":id"],
  ])("%j -> %j", (input, placeholder) => {
    expect(parsePlaceholder(input)).toEqual({ placeholder });
  });

  test.each([":", "::id", ":my id", ":1st", "{id}", `:${"a".repeat(41)}`])("rejects %j", (input) => {
    expect(parsePlaceholder(input)).toHaveProperty("error");
  });
});

describe("parseNamedPattern", () => {
  test.each([
    ["/dashboard/:site_id/sites", "/dashboard/:site_id/sites"],
    [" /orders/:order_id/ ", "/orders/:order_id"],
    ["//u//:user", "/u/:user"],
  ])("%j -> %j", (input, pattern) => {
    expect(parseNamedPattern(input)).toEqual({ pattern });
  });

  test.each(["", "orders/:id", "/orders", "/orders/:", "/orders/:1d", "/orders/*", "/a b/:id", "/x?y=:id"])(
    "rejects %j with a message",
    (input) => {
      const result = parseNamedPattern(input);
      expect(result).toHaveProperty("error");
      expect("error" in result && result.error.length > 0).toBe(true);
    },
  );
});

describe("matchesNamedPattern", () => {
  test.each([
    ["/dashboard/abc123/sites", "/dashboard/:site_id/sites", true],
    ["/dashboard/abc123", "/dashboard/:site_id/sites", false],
    ["/dashboard/abc123/sites/x", "/dashboard/:site_id/sites", false],
    ["/dashboard/abc123/settings", "/dashboard/:site_id/sites", false],
    ["/dashboard/:site_id/sites", "/dashboard/:site_id/sites", true],
    ["/u/jo/posts/7", "/u/:user/posts/:post", true],
    ["/", "/:page", false],
  ])("%j against %j is %j", (path, pattern, expected) => {
    expect(matchesNamedPattern(path, pattern)).toBe(expected);
  });
});

describe("isIdSegment", () => {
  test.each([
    // UUIDs, any case
    ["a5f911d6-dc3e-4beb-af4c-d1966b1e2663", true],
    ["A5F911D6-DC3E-4BEB-AF4C-D1966B1E2663", true],
    // Digit runs of 6 or more
    ["123456", true],
    ["98765432101", true],
    ["12345", false],
    ["2026", false],
    // Hex of 16 or more
    ["deadbeefcafebabe", true],
    ["3f2a9c1e7b4d8a6f0e5c", true],
    ["3f2a9c1e7b4d8a6", false],
    // Base64-ish ids: 16 or more letters and digits, both present
    ["jd7f3k2m9x8q1w4e5r6t", true],
    ["Xk9mQ2pL7vN4bR8s", true],
    // Plain slugs and words stay
    ["pricing", false],
    ["internationalization", false],
    ["how-to-install-v2-guide", false],
    ["my_long_page_name_2024", false],
    ["v2", false],
    ["", false],
  ])("%j is %j", (segment, expected) => {
    expect(isIdSegment(segment)).toBe(expected);
  });
});

describe("groupPath", () => {
  const on = (o: Partial<PathGrouping> = {}): PathGrouping => ({
    enabled: true,
    placeholder: ":id",
    patterns: [],
    ...o,
  });

  test("off or missing leaves every path alone", () => {
    expect(groupPath("/orders/123456", undefined)).toBe("/orders/123456");
    expect(groupPath("/orders/123456", on({ enabled: false, patterns: ["/orders/:order"] }))).toBe(
      "/orders/123456",
    );
  });

  test("auto-detection collapses ids and keeps slugs", () => {
    expect(groupPath("/orders/123456", on())).toBe("/orders/:id");
    expect(groupPath("/orders/987654", on())).toBe("/orders/:id");
    expect(groupPath("/u/a5f911d6-dc3e-4beb-af4c-d1966b1e2663/files/deadbeefcafebabe", on())).toBe(
      "/u/:id/files/:id",
    );
    expect(groupPath("/pricing", on())).toBe("/pricing");
    expect(groupPath("/blog/how-to-install-v2", on())).toBe("/blog/how-to-install-v2");
    expect(groupPath("/", on())).toBe("/");
  });

  test("the placeholder is the site's", () => {
    expect(groupPath("/orders/123456", on({ placeholder: ":record" }))).toBe("/orders/:record");
  });

  test("named patterns win over auto-detection, first match first", () => {
    const grouping = on({ patterns: ["/dashboard/:site_id/sites", "/dashboard/:other/sites", "/orders/:order_id"] });
    expect(groupPath("/dashboard/abc/sites", grouping)).toBe("/dashboard/:site_id/sites");
    expect(groupPath("/orders/123456", grouping)).toBe("/orders/:order_id");
    // No pattern matches: auto-detection
    expect(groupPath("/dashboard/123456/settings", grouping)).toBe("/dashboard/:id/settings");
    expect(groupPath("/pricing", grouping)).toBe("/pricing");
  });
});

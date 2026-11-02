import { describe, expect, test } from "vitest";
import { isExcludedPath, matchesPattern, parseExcludedPath } from "./paths";

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

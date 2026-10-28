import { describe, expect, test } from "vitest";
import { canFilter, formatFiltersParam, parseFiltersParam, toggleFilter, type Filter } from "./filters";

describe("parseFiltersParam", () => {
  test("reads dim:value pairs", () => {
    expect(parseFiltersParam("channel:AI,country:US")).toEqual([
      { dim: "channel", value: "AI" },
      { dim: "country", value: "US" },
    ]);
    expect(parseFiltersParam(null)).toEqual([]);
    expect(parseFiltersParam("")).toEqual([]);
  });

  test("keeps colons in values and drops what it can't use", () => {
    expect(parseFiltersParam("outbound:https://github.com/acme")).toEqual([
      { dim: "outbound", value: "https://github.com/acme" },
    ]);
    expect(parseFiltersParam("nope:x,channel:,:AI,page:/a,page:/b")).toEqual([{ dim: "page", value: "/a" }]);
    expect(parseFiltersParam("channel:AI,country:US,device:mobile,os:iOS")).toHaveLength(3);
  });
});

describe("formatFiltersParam", () => {
  test("stays readable and round-trips through the URL", () => {
    const filters: Filter[] = [
      { dim: "channel", value: "Organic Search" },
      { dim: "page", value: "/a,b%c" },
      { dim: "outbound", value: "https://x.com/y?z&w" },
    ];
    const param = formatFiltersParam(filters);
    expect(param.startsWith("channel:Organic%20Search,page:/a")).toBe(true);
    const url = new URL(`https://app.test/?range=7d&f=${param}`);
    expect(parseFiltersParam(url.searchParams.get("f"))).toEqual(filters);
    expect(url.searchParams.get("range")).toBe("7d");
  });
});

describe("toggleFilter", () => {
  const ai: Filter = { dim: "channel", value: "AI" };

  test("adds, replaces within a dim, and removes on a second click", () => {
    expect(toggleFilter([], "channel", "AI")).toEqual([ai]);
    expect(toggleFilter([ai], "channel", "Direct")).toEqual([{ dim: "channel", value: "Direct" }]);
    expect(toggleFilter([ai], "channel", "AI")).toEqual([]);
  });

  test("stops at three dims", () => {
    const three: Filter[] = [ai, { dim: "country", value: "US" }, { dim: "device", value: "mobile" }];
    expect(toggleFilter(three, "os", "iOS")).toBe(three);
    expect(canFilter(three, "os")).toBe(false);
    expect(canFilter(three, "country")).toBe(true);
  });
});

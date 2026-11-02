import { describe, expect, test } from "vitest";
import { formatToolFilters, parseToolFilters, parseToolRange } from "./mcp";

describe("parseToolRange", () => {
  test("presets, with today, yesterday and 24h hourly", () => {
    expect(parseToolRange(undefined, "2026-10-13")).toEqual({
      param: "7d",
      range: { from: "2026-10-07", to: "2026-10-13" },
      hourly: null,
    });
    expect(parseToolRange("30d", "2026-10-13")).toMatchObject({ range: { from: "2026-09-14", to: "2026-10-13" } });
    expect(parseToolRange("yesterday", "2026-10-13")).toMatchObject({
      range: { from: "2026-10-12", to: "2026-10-12" },
      hourly: "yesterday",
    });
    expect(parseToolRange(" 24h ", "2026-10-13")).toMatchObject({ param: "24h", hourly: "24h" });
  });

  test("custom spans, and an error instead of the URL's fallback", () => {
    expect(parseToolRange("2026-09-01_2026-09-30", "2026-10-13")).toEqual({
      param: "2026-09-01_2026-09-30",
      range: { from: "2026-09-01", to: "2026-09-30" },
      hourly: null,
    });
    for (const bad of ["last week", "2026-09-30_2026-09-01", "2024-01-01_2026-01-01", "2026-09-01_2026-09-30_x"]) {
      expect(parseToolRange(bad, "2026-10-13")).toHaveProperty("error");
    }
  });
});

describe("parseToolFilters", () => {
  test("reads the ?f= syntax and refuses what it can't read", () => {
    expect(parseToolFilters(undefined)).toEqual([]);
    expect(parseToolFilters("country:US,page:/pricing")).toEqual([
      { dim: "country", value: "US" },
      { dim: "page", value: "/pricing" },
    ]);
    for (const bad of ["colour:red", "country", "country:US,country:NO", "page:/a,device:mobile,os:iOS,browser:Safari"]) {
      expect(parseToolFilters(bad)).toHaveProperty("error");
    }
  });

  test("echoes filters readably", () => {
    expect(formatToolFilters([{ dim: "page", value: "/a b" }, { dim: "channel", value: "AI" }])).toBe("page:/a b,channel:AI");
  });
});

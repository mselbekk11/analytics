import { describe, expect, test } from "vitest";
import {
  addDays,
  eachDate,
  formatRangeParam,
  isDate,
  isValidRange,
  nextRange,
  parseRangeParam,
  percentChange,
  presetRange,
  previousRange,
  rangeDays,
} from "./ranges";

describe("day arithmetic", () => {
  test("addDays crosses month, year and leap-day boundaries", () => {
    expect(addDays("2026-10-14", -13)).toBe("2026-10-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  test("is unaffected by DST changes (dates are calendar days, not instants)", () => {
    expect(addDays("2026-10-31", 2)).toBe("2026-11-02");
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09");
    expect(rangeDays({ from: "2026-11-01", to: "2026-11-01" })).toBe(1);
    expect(rangeDays({ from: "2026-03-01", to: "2026-03-31" })).toBe(31);
  });

  test("eachDate lists every day, both ends included", () => {
    expect(eachDate({ from: "2026-09-29", to: "2026-10-02" })).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });

  test("isDate rejects malformed and impossible dates", () => {
    expect(isDate("2026-10-14")).toBe(true);
    expect(isDate("2028-02-29")).toBe(true);
    expect(isDate("2027-02-29")).toBe(false);
    expect(isDate("2026-13-01")).toBe(false);
    expect(isDate("2026-1-01")).toBe(false);
    expect(isDate("")).toBe(false);
  });
});

describe("ranges", () => {
  test("a 30d preset ends today and includes it", () => {
    const r = presetRange("30d", "2026-10-14");
    expect(r).toEqual({ from: "2026-09-15", to: "2026-10-14" });
    expect(rangeDays(r)).toBe(30);
    expect(presetRange("7d", "2026-10-14")).toEqual({ from: "2026-10-08", to: "2026-10-14" });
  });

  test("the previous range has equal length and ends the day before", () => {
    expect(previousRange({ from: "2026-09-15", to: "2026-10-14" })).toEqual({
      from: "2026-08-16",
      to: "2026-09-14",
    });
    expect(previousRange({ from: "2026-10-14", to: "2026-10-14" })).toEqual({
      from: "2026-10-13",
      to: "2026-10-13",
    });
    // A whole month whose predecessor is shorter in calendar terms
    expect(previousRange({ from: "2026-03-01", to: "2026-03-31" })).toEqual({
      from: "2026-01-29",
      to: "2026-02-28",
    });
  });

  test("next undoes previous", () => {
    const r = { from: "2026-09-15", to: "2026-10-14" };
    expect(nextRange(previousRange(r))).toEqual(r);
  });

  test("isValidRange enforces order and the 365-day cap", () => {
    expect(isValidRange({ from: "2026-10-01", to: "2026-10-01" })).toBe(true);
    expect(isValidRange({ from: "2026-10-02", to: "2026-10-01" })).toBe(false);
    expect(isValidRange({ from: "2025-10-15", to: "2026-10-14" })).toBe(true); // 365 days
    expect(isValidRange({ from: "2025-10-14", to: "2026-10-14" })).toBe(false); // 366 days
    expect(isValidRange({ from: "nope", to: "2026-10-14" })).toBe(false);
  });
});

describe("parseRangeParam", () => {
  const today = "2026-10-14";

  test("reads presets", () => {
    expect(parseRangeParam("7d", today)).toEqual({
      range: { from: "2026-10-08", to: today },
      preset: "7d",
    });
  });

  test("reads custom spans and round-trips them", () => {
    const range = { from: "2026-09-01", to: "2026-09-30" };
    expect(parseRangeParam(formatRangeParam(range), today)).toEqual({ range, preset: null });
  });

  test.each([null, "", "14d", "2026-09-30_2026-09-01", "2024-01-01_2026-01-01", "garbage"])(
    "falls back to 30d for %j",
    (param) => {
      expect(parseRangeParam(param, today)).toEqual({
        range: { from: "2026-09-15", to: today },
        preset: "30d",
      });
    },
  );
});

describe("percentChange", () => {
  test("is a fraction of the previous value", () => {
    expect(percentChange(150, 100)).toBe(0.5);
    expect(percentChange(50, 100)).toBe(-0.5);
    expect(percentChange(100, 100)).toBe(0);
  });

  test("is null when there is no previous value", () => {
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });
});

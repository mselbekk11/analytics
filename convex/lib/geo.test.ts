import { describe, expect, test } from "vitest";
import { cityKey, parseGeoKey, regionKey } from "./geo";

describe("geo keys", () => {
  test.each([
    ["US", "CA", "US/CA"],
    ["US", undefined, "Unknown"],
  ])("regionKey(%s, %s) -> %s", (country, region, expected) => {
    expect(regionKey(country, region)).toBe(expected);
  });

  test.each([
    ["US", "CA", "San Francisco", "US/CA/San Francisco"],
    ["SG", undefined, "Singapore", "SG//Singapore"],
    ["US", "CA", undefined, "Unknown"],
  ])("cityKey(%s, %s, %s) -> %s", (country, region, city, expected) => {
    expect(cityKey(country, region, city)).toBe(expected);
  });

  test("parseGeoKey reverses both, keeping a slash inside a city name", () => {
    expect(parseGeoKey("US/CA")).toEqual({ country: "US", region: "CA" });
    expect(parseGeoKey("SG//Singapore")).toEqual({ country: "SG", region: "", city: "Singapore" });
    expect(parseGeoKey("XX/1/A/B")).toEqual({ country: "XX", region: "1", city: "A/B" });
    expect(parseGeoKey("Unknown")).toBeNull();
  });
});

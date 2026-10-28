import { describe, expect, test } from "vitest";
import {
  cityLabel,
  countryFlag,
  countryName,
  currencyDigits,
  formatChange,
  formatDate,
  formatDateTime,
  formatDuration,
  formatElapsed,
  formatMoney,
  formatNumber,
  formatShare,
  formatTime,
  outboundLabel,
  referrerLabel,
  regionLabel,
  truncateMiddle,
} from "./format";

describe("format", () => {
  test("numbers get thousands separators", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(12345)).toBe("12,345");
  });

  test.each([
    [0, "0s"],
    [42_000, "42s"],
    [59_600, "1m 0s"],
    [95_000, "1m 35s"],
    [3_700_000, "1h 1m"],
  ])("duration %d ms -> %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });

  test("shares and changes", () => {
    expect(formatShare(0)).toBe("0%");
    expect(formatShare(0.0004)).toBe("<0.1%");
    expect(formatShare(0.006)).toBe("0.6%");
    expect(formatShare(0.0099)).toBe("1%");
    expect(formatShare(0.456)).toBe("46%");
    expect(formatShare(1)).toBe("100%");
    expect(formatChange(0.25)).toBe("+25%");
    expect(formatChange(-0.031)).toBe("-3%");
    expect(formatChange(0)).toBe("0%");
  });

  test("dates read the string without timezone shifts", () => {
    expect(formatDate("2026-10-01")).toBe("Oct 1");
    expect(formatDate("2026-12-31", true)).toBe("Dec 31, 2026");
  });

  test("countries", () => {
    expect(countryName("US")).toBe("United States");
    expect(countryName("NO")).toBe("Norway");
    expect(countryName("Unknown")).toBe("Unknown");
    expect(countryFlag("NO")).toBe("🇳🇴");
    expect(countryFlag("Unknown")).toBe("");
  });

  test("referrers", () => {
    expect(referrerLabel("(direct)")).toBe("(direct)");
    expect(referrerLabel("google.com")).toBe("google.com");
  });

  test("long domains are shortened in the middle", () => {
    expect(truncateMiddle("picai.so", 18)).toBe("picai.so");
    expect(truncateMiddle("advancedortholabsf.com", 22)).toBe("advancedortholabsf.com");
    expect(truncateMiddle("advancedortholabsf.com", 18)).toBe("advancedo…absf.com");
    expect(truncateMiddle("roaminternational.com", 18)).toHaveLength(18);
  });
});

describe("regionLabel and cityLabel", () => {
  test.each([
    ["US/CA", "California"],
    ["DE/BE", "BE, Germany"],
    ["Unknown", "Unknown"],
  ])("regionLabel(%s) -> %s", (key, expected) => {
    expect(regionLabel(key)).toBe(expected);
  });

  test.each([
    ["US/CA/San Francisco", "San Francisco, CA"],
    ["SG//Singapore", "Singapore"],
    ["Unknown", "Unknown"],
  ])("cityLabel(%s) -> %s", (key, expected) => {
    expect(cityLabel(key)).toBe(expected);
  });
});

describe("outboundLabel", () => {
  test.each([
    ["https://github.com/", "github.com"],
    ["https://github.com/acme/repo", "github.com/acme/repo"],
    ["http://example.com/a/", "example.com/a/"],
  ])("%s -> %s", (url, label) => {
    expect(outboundLabel(url)).toBe(label);
  });
});

describe("formatMoney", () => {
  test("uses the currency's smallest unit", () => {
    expect(formatMoney(123456, "USD")).toBe("$1,234.56");
    expect(formatMoney(5000, "EUR")).toBe("€50.00");
    expect(formatMoney(1500, "JPY")).toBe("¥1,500");
    expect(currencyDigits("JPY")).toBe(0);
  });

  test("rounds to whole units for lists, and keeps the sign of refunds", () => {
    expect(formatMoney(123456, "USD", true)).toBe("$1,235");
    expect(formatMoney(-2500, "USD")).toBe("-$25.00");
  });
});

describe("formatDateTime and formatTime", () => {
  // 17:04Z is 10:04 in Los Angeles (UTC-7 in October)
  const ts = Date.parse("2026-10-27T17:04:00Z");
  test("use the site's timezone", () => {
    expect(formatDateTime(ts, "America/Los_Angeles")).toBe("Oct 27, 2026, 10:04 AM");
    expect(formatTime(ts, "America/Los_Angeles")).toBe("10:04 AM");
    expect(formatTime(ts, "Europe/Oslo")).toBe("6:04 PM");
  });
});

describe("formatElapsed", () => {
  test.each([
    [0, "<1m"],
    [59_000, "<1m"],
    [12 * 60_000, "12m"],
    [125 * 60_000, "2h 5m"],
    [3 * 3_600_000, "3h"],
    [(3 * 24 + 4) * 3_600_000, "3d 4h"],
    [2 * 24 * 3_600_000, "2d"],
  ])("%d ms -> %s", (ms, label) => {
    expect(formatElapsed(ms)).toBe(label);
  });
});

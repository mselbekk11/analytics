import { describe, expect, test } from "vitest";
import { isValidTimeZone, localDate } from "./dates";

describe("localDate", () => {
  const la = "America/Los_Angeles";

  test("buckets by the site's timezone, not UTC", () => {
    // 2026-10-14 06:59:59Z is still Oct 13 in LA (UTC-7 during DST)
    expect(localDate(Date.UTC(2026, 9, 14, 6, 59, 59), la)).toBe("2026-10-13");
    expect(localDate(Date.UTC(2026, 9, 14, 7, 0, 0), la)).toBe("2026-10-14");
    expect(localDate(Date.UTC(2026, 9, 14, 6, 59, 59), "UTC")).toBe("2026-10-14");
  });

  test("handles the day DST ends (UTC-7 -> UTC-8)", () => {
    // DST ends 2026-11-01 at 02:00 local. Midnight after it is 08:00Z, not 07:00Z.
    expect(localDate(Date.UTC(2026, 10, 2, 7, 59, 59), la)).toBe("2026-11-01");
    expect(localDate(Date.UTC(2026, 10, 2, 8, 0, 0), la)).toBe("2026-11-02");
  });

  test("handles the day DST starts (UTC-8 -> UTC-7)", () => {
    // DST starts 2026-03-08. Midnight on Mar 8 is 08:00Z; midnight on Mar 9 is 07:00Z.
    expect(localDate(Date.UTC(2026, 2, 8, 7, 59, 59), la)).toBe("2026-03-07");
    expect(localDate(Date.UTC(2026, 2, 8, 8, 0, 0), la)).toBe("2026-03-08");
    expect(localDate(Date.UTC(2026, 2, 9, 6, 59, 59), la)).toBe("2026-03-08");
    expect(localDate(Date.UTC(2026, 2, 9, 7, 0, 0), la)).toBe("2026-03-09");
  });

  test("handles timezones ahead of UTC", () => {
    expect(localDate(Date.UTC(2026, 9, 13, 22, 0, 0), "Europe/Oslo")).toBe("2026-10-14");
  });
});

describe("isValidTimeZone", () => {
  test("accepts IANA names and rejects junk", () => {
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

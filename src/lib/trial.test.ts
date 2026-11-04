import { expect, test } from "vitest";
import { trialDaysLeft, trialLabel } from "./trial";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-11-03T12:00:00Z");

test("counts whole days left, rounded up", () => {
  expect(trialDaysLeft(NOW + 7 * DAY, NOW)).toBe(7);
  expect(trialDaysLeft(NOW + 6 * DAY + 1, NOW)).toBe(7);
  expect(trialDaysLeft(NOW + 6 * DAY, NOW)).toBe(6);
  expect(trialDaysLeft(NOW + 1000, NOW)).toBe(1);
  // Past the end but not yet locked by the job: still the last day
  expect(trialDaysLeft(NOW - 1000, NOW)).toBe(1);
});

test("labels the pill", () => {
  expect(trialLabel(NOW + 7 * DAY, NOW)).toBe("Trial · 7 days left");
  expect(trialLabel(NOW + 3600_000, NOW)).toBe("Trial · 1 day left");
});

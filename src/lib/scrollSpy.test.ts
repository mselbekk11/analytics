import { describe, expect, test } from "vitest";
import { activeSection } from "./scrollSpy";

const at = (...tops: number[]) => tops.map((top, i) => ({ id: `s${i + 1}`, top }));

describe("activeSection", () => {
  test("is undefined with no sections", () => {
    expect(activeSection([], 300)).toBeUndefined();
  });

  test("falls back to the first before any top reaches the line", () => {
    expect(activeSection(at(800, 1600, 2400), 300)).toBe("s1");
  });

  test("picks the last section whose top has passed the line", () => {
    expect(activeSection(at(-900, -100, 700), 300)).toBe("s2");
    expect(activeSection(at(-1600, -800, 120), 300)).toBe("s3");
  });

  test("counts a top exactly on the line", () => {
    expect(activeSection(at(-400, 300, 900), 300)).toBe("s2");
  });

  test("picks the last section when every top has passed", () => {
    expect(activeSection(at(-3000, -2000, -1000), 300)).toBe("s3");
  });

  test("follows the sections in order as the page scrolls", () => {
    const tops = [0, 600, 1200, 1800];
    const seen = [0, 500, 1000, 1500, 2000].map((y) =>
      activeSection(
        tops.map((t, i) => ({ id: `s${i + 1}`, top: t - y })),
        300,
      ),
    );
    expect(seen).toEqual(["s1", "s2", "s3", "s4", "s4"]);
  });
});

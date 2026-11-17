import { describe, expect, test } from "vitest";
import { sectionEntries, sections } from "./content";

describe("sections", () => {
  test("leave out hidden entries, Search among them", () => {
    expect(sections.map((s) => s.id)).toEqual(sectionEntries.filter((s) => !s.hidden).map((s) => s.id));
    expect(sections.some((s) => s.id === "s-search")).toBe(false);
  });

  test("are numbered 01, 02, ... with no gaps", () => {
    expect(sections.map((s) => s.number)).toEqual(sections.map((_, i) => String(i + 1).padStart(2, "0")));
  });

  test("number their figures Fig. 1, 2, ... across the page", () => {
    const numbers = sections.flatMap((s) => s.figures.map((f) => f.n));
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });
});

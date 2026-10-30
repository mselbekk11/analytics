import { describe, expect, test } from "vitest";
import { initials } from "./initials";

describe("initials", () => {
  test("uses the first and last name", () => {
    expect(initials("Morgan", "Selbekk", "m@example.com")).toBe("MS");
    expect(initials(" jo ", " smith ", null)).toBe("JS");
  });

  test("uses one name when only one is set", () => {
    expect(initials("Morgan", null, "m@example.com")).toBe("M");
    expect(initials("  ", "Selbekk", "m@example.com")).toBe("S");
  });

  test("falls back to the first two letters of the email's local part", () => {
    expect(initials(null, null, "mselbekk11@gmail.com")).toBe("MS");
    expect(initials("", "  ", "jo@example.com")).toBe("JO");
  });

  test("gives one letter for a one-letter local part", () => {
    expect(initials(null, null, "m@example.com")).toBe("M");
  });

  test("is empty with nothing to go on", () => {
    expect(initials(null, null, null)).toBe("");
    expect(initials(undefined, undefined, "@example.com")).toBe("");
  });
});

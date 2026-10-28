import { describe, expect, test } from "vitest";
import { displayName, persona } from "./names";

const VID = "0b6f3a52-6c1e-4f7e-9a51-2d3c4b5a6f70";

describe("persona", () => {
  test("is stable for a visitor id", () => {
    expect(persona(VID)).toEqual(persona(VID));
    expect(persona(VID).name).toMatch(/^[a-z]+ [a-z]+$/);
    expect(persona(VID).color).toMatch(/^#[0-9a-f]{6}$/);
  });

  test("spreads visitors over many names", () => {
    const names = new Set<string>();
    for (let i = 0; i < 200; i++) names.add(persona(`visitor-${i}`).name);
    expect(names.size).toBeGreaterThan(100);
  });
});

describe("displayName", () => {
  test("prefers the identify() name, then the email, then the animal name", () => {
    expect(displayName(VID, "Jo Smith", "jo@example.com")).toBe("Jo Smith");
    expect(displayName(VID, null, "jo@example.com")).toBe("jo@example.com");
    expect(displayName(VID, "  ", "jo@example.com")).toBe("jo@example.com");
    expect(displayName(VID)).toBe(persona(VID).name);
  });
});

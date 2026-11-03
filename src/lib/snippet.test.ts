import { afterEach, describe, expect, test, vi } from "vitest";
import { buildOrigin, embedSnippet } from "./snippet";

afterEach(() => vi.unstubAllEnvs());

describe("embedSnippet", () => {
  test("is one async script tag carrying the site", () => {
    expect(embedSnippet("your-site.com", "https://example.app")).toBe(
      '<script async src="https://example.app/script.js" data-site="your-site.com"></script>',
    );
  });

  // The homepage's Setup code block passes buildOrigin(); the dashboard's Snippet uses the default
  test("the homepage's tag matches the dashboard's on a Vercel build", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL", "analytics.example.com");
    expect(embedSnippet("your-site.com", buildOrigin())).toBe(embedSnippet("your-site.com"));
    expect(buildOrigin()).toBe("https://analytics.example.com");
  });

  test("a local build points at the local app", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(buildOrigin()).toBe("http://localhost:3000");
  });
});

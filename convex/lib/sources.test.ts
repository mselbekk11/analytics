import { describe, expect, test } from "vitest";
import { classify, sourceDomain } from "./sources";

describe("classify", () => {
  test.each([
    ["(direct)", "Direct", "Direct"],
    ["google.com", "Google", "Organic Search"],
    ["google.co.uk", "Google", "Organic Search"],
    ["bing.com", "Bing", "Organic Search"],
    ["chatgpt.com", "ChatGPT", "AI"],
    ["perplexity.ai", "Perplexity", "AI"],
    ["gemini.google.com", "Gemini", "AI"],
    ["t.co", "X", "Organic Social"],
    ["l.facebook.com", "Facebook", "Organic Social"],
    ["news.ycombinator.com", "Hacker News", "Organic Social"],
    ["mail.google.com", "Gmail", "Email"],
    ["github.com", "GitHub", "Referral"],
    ["someblog.dev", "someblog.dev", "Referral"],
  ])("referrer %s is %s under %s", (referrer, source, channel) => {
    expect(classify({ referrer })).toEqual({ source, channel });
  });

  test("utm_source wins over the referrer, then ref", () => {
    expect(classify({ referrer: "google.com", utmSource: "chatgpt.com" })).toEqual({
      source: "ChatGPT",
      channel: "AI",
    });
    expect(classify({ referrer: "google.com", refTag: "launch-tweet" })).toEqual({
      source: "launch-tweet",
      channel: "Referral",
    });
    expect(classify({ referrer: "(direct)", utmSource: "test", refTag: "x" })).toEqual({
      source: "test",
      channel: "Referral",
    });
  });

  test("known tags match case-insensitively", () => {
    expect(classify({ referrer: "(direct)", utmSource: "Twitter" }).source).toBe("X");
  });

  test("utm_medium sets Paid and Email over the source's own channel", () => {
    expect(classify({ referrer: "google.com", utmSource: "google", utmMedium: "cpc" })).toEqual({
      source: "Google",
      channel: "Paid",
    });
    expect(classify({ referrer: "(direct)", utmSource: "weekly", utmMedium: "newsletter" })).toEqual({
      source: "weekly",
      channel: "Email",
    });
  });

  test("utm_medium social only applies to unknown sources", () => {
    expect(classify({ referrer: "(direct)", utmSource: "discord", utmMedium: "social" }).channel).toBe(
      "Organic Social",
    );
    expect(classify({ referrer: "(direct)", utmSource: "google", utmMedium: "social" }).channel).toBe(
      "Organic Search",
    );
  });
});

describe("sourceDomain", () => {
  test("known sources use their domain, hostnames themselves, tags none", () => {
    expect(sourceDomain("ChatGPT")).toBe("chatgpt.com");
    expect(sourceDomain("someblog.dev")).toBe("someblog.dev");
    expect(sourceDomain("Newsletter")).toBeNull();
    expect(sourceDomain("test")).toBeNull();
    expect(sourceDomain("Direct")).toBeNull();
  });
});

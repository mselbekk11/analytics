import { describe, expect, test } from "vitest";
import { hostMatchesDomain, normalizeDomain } from "./domain";

describe("normalizeDomain", () => {
  test.each([
    ["picai.so", "picai.so"],
    ["  PicAI.so  ", "picai.so"],
    ["https://www.picai.so/", "picai.so"],
    ["http://picai.so:8080/pricing?x=1#top", "picai.so"],
    ["blog.mselbekk.com", "blog.mselbekk.com"],
    ["www.example.co.uk", "example.co.uk"],
    ["localhost", "localhost"],
    ["http://localhost:3000", "localhost"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  test.each(["", "picai", "pic ai.so", "-picai.so", "https://", "a..b.com"])(
    "rejects %j",
    (input) => {
      expect(normalizeDomain(input)).toBeNull();
    },
  );
});

describe("hostMatchesDomain", () => {
  test("matches the domain and its subdomains", () => {
    expect(hostMatchesDomain("picai.so", "picai.so")).toBe(true);
    expect(hostMatchesDomain("www.picai.so", "picai.so")).toBe(true);
    expect(hostMatchesDomain("WWW.PICAI.SO", "picai.so")).toBe(true);
  });

  test("rejects other hosts, including lookalikes", () => {
    expect(hostMatchesDomain("evil.com", "picai.so")).toBe(false);
    expect(hostMatchesDomain("notpicai.so", "picai.so")).toBe(false);
    expect(hostMatchesDomain("picai.so.evil.com", "picai.so")).toBe(false);
    expect(hostMatchesDomain("", "picai.so")).toBe(false);
  });
});

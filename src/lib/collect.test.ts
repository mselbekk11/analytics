import { describe, expect, test } from "vitest";
import {
  detectDevice,
  normalizePath,
  normalizeReferrer,
  parsePayload,
  requestHostname,
} from "./collect";

describe("normalizeReferrer", () => {
  test.each([
    ["", "picai.so", "(direct)"],
    ["https://www.google.com/search?q=x", "picai.so", "google.com"],
    ["https://news.ycombinator.com/item?id=1", "picai.so", "news.ycombinator.com"],
    ["t.co", "picai.so", "t.co"],
    ["https://picai.so/pricing", "picai.so", "(direct)"],
    ["https://www.picai.so/", "picai.so", "(direct)"],
    ["https://picai.so/", "www.picai.so", "(direct)"],
    ["https://blog.picai.so/", "picai.so", "blog.picai.so"],
    ["not a url at all", "picai.so", "(direct)"],
    ["android-app://com.slack/", "picai.so", "com.slack"],
  ])("%j on %s -> %s", (ref, host, expected) => {
    expect(normalizeReferrer(ref, host)).toBe(expected);
  });
});

describe("normalizePath", () => {
  test.each([
    ["/", "/"],
    ["/pricing/", "/pricing"],
    ["/pricing?utm_source=x", "/pricing"],
    ["/docs/#install", "/docs"],
    ["/a//", "/a"],
    ["?x=1", "/"],
    ["blog", "/blog"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizePath(input)).toBe(expected);
  });
});

describe("detectDevice", () => {
  test("trusts the user agent when it names a type", () => {
    expect(detectDevice("mobile", 1920)).toBe("mobile");
    expect(detectDevice("tablet", 390)).toBe("tablet");
    expect(detectDevice("smarttv", 390)).toBe("desktop");
  });

  test("falls back to screen width", () => {
    expect(detectDevice(undefined, 390)).toBe("mobile");
    expect(detectDevice(undefined, 767)).toBe("mobile");
    expect(detectDevice(undefined, 768)).toBe("tablet");
    expect(detectDevice(undefined, 1023)).toBe("tablet");
    expect(detectDevice(undefined, 1024)).toBe("desktop");
    expect(detectDevice(undefined, undefined)).toBe("desktop");
  });
});

describe("requestHostname", () => {
  test("prefers Origin, then Referer, then the payload host", () => {
    expect(requestHostname("https://www.picai.so", "https://x.com/", "y.com")).toBe("www.picai.so");
    expect(requestHostname(null, "https://picai.so/pricing", "y.com")).toBe("picai.so");
    expect(requestHostname("null", null, "PICAI.so")).toBe("picai.so");
    expect(requestHostname(null, null, undefined)).toBe("");
  });
});

describe("parsePayload", () => {
  const pv = { t: "pv", site: "picai.so", host: "picai.so", path: "/", ref: "", unique: true, pvId: "abc", sw: 390 };

  const VID = "0b7c2a4e-1f3d-4c5b-9a8e-6d7f8091a2b3";
  const SID = "f1e2d3c4-b5a6-4978-8a6b-5c4d3e2f1a0b";

  test("accepts a valid pageview and duration", () => {
    expect(parsePayload(JSON.stringify(pv))).toEqual({ ...pv, nc: false });
    expect(parsePayload(JSON.stringify({ t: "dur", site: "picai.so", pvId: "abc", ms: 5000 }))).toEqual({
      t: "dur",
      site: "picai.so",
      pvId: "abc",
      ms: 5000,
    });
  });

  test("accepts visitor and session ids", () => {
    expect(parsePayload(JSON.stringify({ ...pv, vid: VID, sid: SID }))).toEqual({
      ...pv,
      vid: VID,
      sid: SID,
      nc: false,
    });
  });

  test("reads the cookieless marker", () => {
    expect(parsePayload(JSON.stringify({ ...pv, nc: 1 }))).toMatchObject({ nc: true });
  });

  test("accepts a ping and ignores the ids it carries", () => {
    const ping = { t: "ping", site: "picai.so", pvId: "abc", ms: 60_000 };
    expect(parsePayload(JSON.stringify({ ...ping, vid: VID, sid: SID }))).toEqual(ping);
  });

  test("drops a non-numeric screen width instead of rejecting", () => {
    expect(parsePayload(JSON.stringify({ ...pv, sw: "wide" }))?.t).toBe("pv");
  });

  test.each([
    ["empty body", ""],
    ["not JSON", "{oops"],
    ["JSON null", "null"],
    ["unknown type", JSON.stringify({ ...pv, t: "click" })],
    ["missing site", JSON.stringify({ ...pv, site: "" })],
    ["site too long", JSON.stringify({ ...pv, site: "a".repeat(254) })],
    ["path too long", JSON.stringify({ ...pv, path: "/" + "a".repeat(500) })],
    ["ref too long", JSON.stringify({ ...pv, ref: "a".repeat(1001) })],
    ["unique not boolean", JSON.stringify({ ...pv, unique: "yes" })],
    ["body over 2 KB", JSON.stringify({ ...pv, ref: "a".repeat(990), path: "/" + "b".repeat(499), host: "c".repeat(253), x: "d".repeat(400) })],
    ["duration over 30 min", JSON.stringify({ t: "dur", site: "picai.so", pvId: "abc", ms: 1_800_001 })],
    ["negative duration", JSON.stringify({ t: "dur", site: "picai.so", pvId: "abc", ms: -1 })],
    ["fractional duration", JSON.stringify({ t: "dur", site: "picai.so", pvId: "abc", ms: 1.5 })],
    ["visitor id that is not a UUID", JSON.stringify({ ...pv, vid: "abc", sid: SID })],
    ["session id that is not a UUID", JSON.stringify({ ...pv, vid: VID, sid: 42 })],
    ["visitor id without a session id", JSON.stringify({ ...pv, vid: VID })],
    ["ping over 70 seconds", JSON.stringify({ t: "ping", site: "picai.so", pvId: "abc", ms: 70_001 })],
    ["negative ping", JSON.stringify({ t: "ping", site: "picai.so", pvId: "abc", ms: -1 })],
    ["fractional ping", JSON.stringify({ t: "ping", site: "picai.so", pvId: "abc", ms: 0.5 })],
  ])("rejects %s", (_name, body) => {
    expect(parsePayload(body)).toBeNull();
  });
});

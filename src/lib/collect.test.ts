import { describe, expect, test } from "vitest";
import {
  detectDevice,
  normalizePath,
  normalizeReferrer,
  parseGeo,
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

  test("reads campaign tags, trims them, drops empty ones and maps via to ref", () => {
    const parsed = parsePayload(
      JSON.stringify({
        ...pv,
        c: { utm_source: " test ", utm_campaign: "phase5b", utm_medium: "", via: "launch" },
      }),
    );
    expect(parsed).toMatchObject({ campaign: { utmSource: "test", utmCampaign: "phase5b", refTag: "launch" } });
    expect(parsed?.t === "pv" && parsed.campaign).toEqual({
      utmSource: "test",
      utmCampaign: "phase5b",
      refTag: "launch",
    });
  });

  test("prefers ref over via, and leaves out a campaign with nothing in it", () => {
    const both = parsePayload(JSON.stringify({ ...pv, c: { ref: "a", via: "b" } }));
    expect(both?.t === "pv" && both.campaign).toEqual({ refTag: "a" });
    const empty = parsePayload(JSON.stringify({ ...pv, c: { utm_source: " " } }));
    expect(empty?.t === "pv" && "campaign" in empty).toBe(false);
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
    ["body over 4 KB", JSON.stringify({ ...pv, ref: "a".repeat(990), path: "/" + "b".repeat(499), host: "c".repeat(253), x: "d".repeat(2400) })],
    ["campaign that is not an object", JSON.stringify({ ...pv, c: "utm_source=x" })],
    ["campaign with an unknown parameter", JSON.stringify({ ...pv, c: { gclid: "abc" } })],
    ["campaign tag over 100 characters", JSON.stringify({ ...pv, c: { utm_source: "a".repeat(101) } })],
    ["campaign tag that is not a string", JSON.stringify({ ...pv, c: { utm_source: 5 } })],
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

describe("parseGeo", () => {
  test("keeps country, region and city, and rounds coordinates to one decimal", () => {
    expect(
      parseGeo({
        country: "US",
        countryRegion: "CA",
        city: "San Francisco",
        latitude: "37.7749",
        longitude: "-122.4194",
      }),
    ).toEqual({ country: "US", region: "CA", city: "San Francisco", lat: 37.8, lon: -122.4 });
  });

  test("missing headers give Unknown and nothing else", () => {
    expect(parseGeo({})).toEqual({ country: "Unknown" });
  });

  test("drops malformed regions, out-of-range or half coordinates, and long city names", () => {
    expect(
      parseGeo({ country: "DE", countryRegion: "Berlin!", city: " " + "x".repeat(150), latitude: "52.52" }),
    ).toEqual({ country: "DE", city: "x".repeat(100) });
    expect(parseGeo({ country: "US", latitude: "91", longitude: "0" })).toEqual({ country: "US" });
    expect(parseGeo({ country: "US", latitude: "-0.01", longitude: "abc" })).toEqual({ country: "US" });
  });

  test("never returns negative zero", () => {
    expect(parseGeo({ country: "GH", latitude: "-0.04", longitude: "-0.02" })).toEqual({
      country: "GH",
      lat: 0,
      lon: 0,
    });
  });
});

describe("parsePayload: events", () => {
  const base = { site: "picai.so", pvId: "pv-1", vid: "0b7c2a4e-1f3d-4c5b-9a8e-6d7f8091a2b3", sid: "f1e2d3c4-b5a6-4978-8a6b-5c4d3e2f1a0b" };
  const parse = (body: Record<string, unknown>) => parsePayload(JSON.stringify({ ...base, ...body }));

  test("a goal keeps its trimmed name and drops the ids, which the server takes from the pageview", () => {
    expect(parse({ t: "goal", name: "  signup " })).toEqual({ t: "goal", site: "picai.so", pvId: "pv-1", name: "signup" });
  });

  test("goal names are cut to 100 characters; an empty name is rejected", () => {
    expect((parse({ t: "goal", name: "x".repeat(150) }) as { name: string }).name).toHaveLength(100);
    expect(parse({ t: "goal", name: "   " })).toBeNull();
    expect(parse({ t: "goal" })).toBeNull();
    expect(parse({ t: "goal", name: 42 })).toBeNull();
  });

  test("goal props keep 10 simple keys with scalar values, as strings cut to 200 characters", () => {
    const p: Record<string, unknown> = {
      plan: "pro",
      seats: 3,
      trial: false,
      _private: "x",
      $bad: "x",
      "has space": "x",
      nested: { a: 1 },
      empty: " ",
      long: "y".repeat(300),
    };
    for (let i = 0; i < 12; i++) p[`k${i}`] = "v";
    const goal = parse({ t: "goal", name: "signup", p }) as { props: Record<string, string> };
    expect(Object.keys(goal.props)).toHaveLength(10);
    expect(goal.props).toMatchObject({ plan: "pro", seats: "3", trial: "false" });
    expect(goal.props.long).toHaveLength(200);
    expect(goal.props._private).toBeUndefined();
  });

  test("props that are not an object are dropped, not the goal", () => {
    expect(parse({ t: "goal", name: "signup", p: [1, 2] })).toEqual({ t: "goal", site: "picai.so", pvId: "pv-1", name: "signup" });
  });

  test.each([
    ["https://github.com/acme/repo?tab=1#x", "https://github.com/acme/repo"],
    ["http://example.com", "http://example.com/"],
    ["mailto:jo@example.com", null],
    ["javascript:void(0)", null],
    ["not a url", null],
  ])("outbound %s -> %s", (url, expected) => {
    const parsed = parse({ t: "out", url });
    expect(parsed === null ? null : (parsed as { url: string }).url).toBe(expected);
  });

  test("identify keeps id, email (lower-cased) and name, and accepts a numeric id", () => {
    expect(parse({ t: "identify", u: { id: 42, email: " Jo@Example.com ", name: "Jo", plan: "pro" } })).toEqual({
      t: "identify",
      site: "picai.so",
      pvId: "pv-1",
      userId: "42",
      email: "jo@example.com",
      name: "Jo",
    });
  });

  test("identify drops an invalid email and is rejected when nothing is left", () => {
    expect(parse({ t: "identify", u: { email: "nope", name: "Jo" } })).toMatchObject({ name: "Jo" });
    expect(parse({ t: "identify", u: { email: "nope" } })).toBeNull();
    expect(parse({ t: "identify", u: {} })).toBeNull();
    expect(parse({ t: "identify" })).toBeNull();
  });
});

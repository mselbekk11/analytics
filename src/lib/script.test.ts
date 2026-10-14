// @vitest-environment node
/// <reference types="vite/client" />
import { describe, expect, test, vi } from "vitest";
import source from "../../public/script.js?raw";

type Sent = Record<string, unknown>;
type Listener = () => void;

/** Runs public/script.js against a minimal fake browser and records what it sends. */
function load(opts: {
  hostname?: string;
  pathname?: string;
  referrer?: string;
  navType?: string;
  site?: string;
  webdriver?: boolean;
  ignore?: boolean;
} = {}) {
  const sent: Sent[] = [];
  const winListeners: Record<string, Listener[]> = {};
  const docListeners: Record<string, Listener[]> = {};
  const location = { hostname: opts.hostname ?? "picai.so", pathname: opts.pathname ?? "/" };

  const document = {
    currentScript: {
      src: "https://stats.example.com/script.js",
      getAttribute: (name: string) => (name === "data-site" ? (opts.site ?? "picai.so") : null),
    },
    referrer: opts.referrer ?? "",
    visibilityState: "visible",
    addEventListener: (type: string, fn: Listener) => (docListeners[type] ??= []).push(fn),
  };

  const history = {
    pushState: (_s: unknown, _t: string, url: string) => {
      location.pathname = url;
    },
    replaceState: (_s: unknown, _t: string, url: string) => {
      location.pathname = url;
    },
  };

  const window = {
    location,
    history,
    screen: { width: 1440 },
    navigator: {
      webdriver: opts.webdriver ?? false,
      sendBeacon: (url: string, body: string) => {
        expect(url).toBe("https://stats.example.com/api/collect");
        sent.push(JSON.parse(body));
        return true;
      },
    },
    localStorage: { getItem: (k: string) => (k === "sa_ignore" && opts.ignore ? "true" : null) },
    crypto: { randomUUID: (() => { let i = 0; return () => `pv-${++i}`; })() },
    performance: { getEntriesByType: () => [{ type: opts.navType ?? "navigate" }] },
    addEventListener: (type: string, fn: Listener) => (winListeners[type] ??= []).push(fn),
  };

  new Function("window", "document", source)(window, document);

  return {
    sent,
    history,
    fire: (type: string) => (winListeners[type] ?? []).forEach((fn) => fn()),
    setVisibility(state: "visible" | "hidden") {
      document.visibilityState = state;
      (docListeners.visibilitychange ?? []).forEach((fn) => fn());
    },
    location,
  };
}

describe("unique visit rule", () => {
  test("typed-in visit (no referrer) is unique", () => {
    const { sent } = load();
    expect(sent[0]).toMatchObject({ t: "pv", unique: true, ref: "", path: "/", site: "picai.so", host: "picai.so", sw: 1440 });
  });

  test("visit from another site is unique and sends only the referrer's hostname", () => {
    const { sent } = load({ referrer: "https://www.google.com/search?q=secret" });
    expect(sent[0]).toMatchObject({ unique: true, ref: "www.google.com" });
  });

  test("navigation from the same site is not unique", () => {
    const { sent } = load({ referrer: "https://picai.so/pricing" });
    expect(sent[0]).toMatchObject({ unique: false });
  });

  test("reloads and back/forward are not unique", () => {
    expect(load({ navType: "reload" }).sent[0]).toMatchObject({ unique: false });
    expect(load({ navType: "back_forward", referrer: "https://google.com/" }).sent[0]).toMatchObject({ unique: false });
  });
});

describe("SPA route changes", () => {
  test("send a non-unique pageview and close the previous one with a duration", () => {
    const { sent, history } = load({ referrer: "https://google.com/" });
    history.pushState({}, "", "/pricing");
    expect(sent.map((s) => s.t)).toEqual(["pv", "dur", "pv"]);
    expect(sent[1]).toMatchObject({ t: "dur", pvId: "pv-1" });
    expect(sent[2]).toMatchObject({ t: "pv", path: "/pricing", unique: false, pvId: "pv-2", ref: "picai.so" });
  });

  test("ignore a change that keeps the same path", () => {
    const { sent, history } = load();
    history.replaceState({}, "", "/");
    expect(sent).toHaveLength(1);
  });

  test("popstate counts as a route change", () => {
    const { sent, history, fire, location } = load();
    history.pushState({}, "", "/a");
    location.pathname = "/";
    fire("popstate");
    expect(sent.filter((s) => s.t === "pv").map((s) => s.path)).toEqual(["/", "/a", "/"]);
  });
});

describe("time on page", () => {
  test("counts only visible time and is sent once per pageview", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const page = load();
    vi.setSystemTime(10_000);
    page.setVisibility("hidden"); // sends 10s
    vi.setSystemTime(60_000);
    page.setVisibility("visible");
    vi.setSystemTime(65_000);
    page.fire("pagehide"); // already sent for this pageview
    vi.useRealTimers();

    const durs = page.sent.filter((s) => s.t === "dur");
    expect(durs).toEqual([{ t: "dur", site: "picai.so", pvId: "pv-1", ms: 10_000 }]);
  });
});

describe("opt-outs", () => {
  test.each([
    ["localhost", { hostname: "localhost" }],
    ["an IP address", { hostname: "192.168.1.20" }],
    ["automated browsers", { webdriver: true }],
    ["sa_ignore", { ignore: true }],
  ])("sends nothing on %s", (_name, opts) => {
    expect(load(opts).sent).toHaveLength(0);
  });

  test("localhost is tracked when the site is literally 'localhost'", () => {
    expect(load({ hostname: "localhost", site: "localhost" }).sent).toHaveLength(1);
  });
});

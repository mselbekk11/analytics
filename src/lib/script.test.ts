// @vitest-environment node
/// <reference types="vite/client" />
import { afterEach, describe, expect, test, vi } from "vitest";
import source from "../../public/script.js?raw";

type Sent = Record<string, unknown>;
type Listener = () => void;

// Domains a browser refuses to set cookies on (a tiny stand-in for the public suffix list)
const PUBLIC_SUFFIXES = new Set(["so", "com", "uk", "co.uk"]);

/**
 * A minimal cookie jar: honours Domain (must be the host or a parent, and not a public
 * suffix) and Max-Age=0 deletes. Records every accepted write with its attributes.
 */
class CookieJar {
  values = new Map<string, string>();
  writes: string[] = [];
  blocked = false;
  hostname = "picai.so";

  get cookie(): string {
    return [...this.values].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  set cookie(raw: string) {
    if (this.blocked) return;
    const [pair, ...attrs] = raw.split("; ");
    const [name, value] = pair.split("=");
    const attr = (key: string) =>
      attrs.find((a) => a.startsWith(`${key}=`))?.slice(key.length + 1);
    const domain = attr("Domain");
    if (domain !== undefined) {
      const parent = this.hostname === domain || this.hostname.endsWith(`.${domain}`);
      if (!parent || PUBLIC_SUFFIXES.has(domain)) return;
    }
    this.writes.push(raw);
    if (attr("Max-Age") === "0") this.values.delete(name);
    else this.values.set(name, value);
  }
}

/** Runs public/script.js against a minimal fake browser and records what it sends. */
function load(opts: {
  hostname?: string;
  pathname?: string;
  referrer?: string;
  navType?: string;
  site?: string;
  attrs?: Record<string, string>;
  webdriver?: boolean;
  ignore?: boolean;
  jar?: CookieJar;
  noRandomUUID?: boolean;
} = {}) {
  const sent: Sent[] = [];
  const winListeners: Record<string, Listener[]> = {};
  const docListeners: Record<string, Listener[]> = {};
  const intervals: Listener[] = [];
  const location = {
    hostname: opts.hostname ?? "picai.so",
    pathname: opts.pathname ?? "/",
    protocol: "https:",
  };
  const jar = opts.jar ?? new CookieJar();
  jar.hostname = location.hostname;
  const attrs: Record<string, string> = { "data-site": opts.site ?? "picai.so", ...opts.attrs };

  const document = {
    currentScript: {
      src: "https://stats.example.com/script.js",
      getAttribute: (name: string) => attrs[name] ?? null,
    },
    referrer: opts.referrer ?? "",
    visibilityState: "visible",
    addEventListener: (type: string, fn: Listener) => (docListeners[type] ??= []).push(fn),
    get cookie() {
      return jar.cookie;
    },
    set cookie(raw: string) {
      jar.cookie = raw;
    },
  };

  const history = {
    pushState: (_s: unknown, _t: string, url: string) => {
      location.pathname = url;
    },
    replaceState: (_s: unknown, _t: string, url: string) => {
      location.pathname = url;
    },
  };

  let ids = 0;
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
    crypto: opts.noRandomUUID ? {} : { randomUUID: () => `id-${++ids}` },
    performance: { getEntriesByType: () => [{ type: opts.navType ?? "navigate" }] },
    addEventListener: (type: string, fn: Listener) => (winListeners[type] ??= []).push(fn),
    setInterval: (fn: Listener, ms: number) => {
      expect(ms).toBe(60_000);
      intervals.push(fn);
    },
  };

  new Function("window", "document", source)(window, document);

  return {
    sent,
    jar,
    history,
    fire: (type: string) => (winListeners[type] ?? []).forEach((fn) => fn()),
    tick: () => intervals.forEach((fn) => fn()),
    setVisibility(state: "visible" | "hidden") {
      document.visibilityState = state;
      (docListeners.visibilitychange ?? []).forEach((fn) => fn());
    },
    location,
  };
}

const pings = (sent: Sent[]) => sent.filter((s) => s.t === "ping");

afterEach(() => {
  vi.useRealTimers();
});

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

describe("visitor and session cookies", () => {
  test("a first visit creates both ids, sends them and stores them on the root domain", () => {
    const { sent, jar } = load();
    expect(sent[0]).toMatchObject({ pvId: "id-1", vid: "id-2", sid: "id-3" });
    expect(sent[0]).not.toHaveProperty("nc");
    expect(jar.values.get("_va_vid")).toBe("id-2");
    expect(jar.values.get("_va_sid")).toBe("id-3");
    expect(jar.writes).toContain("_va_vid=id-2; Max-Age=34560000; Path=/; Domain=picai.so; SameSite=Lax; Secure");
    expect(jar.writes).toContain("_va_sid=id-3; Max-Age=1800; Path=/; Domain=picai.so; SameSite=Lax; Secure");
    // The domain probe cleans up after itself
    expect(jar.values.has("_va_t")).toBe(false);
  });

  test("a return within the session reuses both ids", () => {
    const jar = new CookieJar();
    load({ jar });
    const { sent } = load({ jar });
    expect(sent[0]).toMatchObject({ vid: "id-2", sid: "id-3" });
  });

  test("a return after the session cookie expired keeps the visitor and starts a session", () => {
    const jar = new CookieJar();
    load({ jar });
    jar.values.delete("_va_sid"); // Max-Age=1800 ran out
    const { sent } = load({ jar });
    expect(sent[0]).toMatchObject({ vid: "id-2", sid: "id-2" }); // the new page's own counter
    expect(sent[0].sid).not.toBe("id-3");
  });

  test("every send renews the cookies", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { jar, history } = load();
    const before = jar.writes.length;
    history.pushState({}, "", "/pricing");
    expect(jar.writes.slice(before).filter((w) => w.startsWith("_va_sid=id-3; Max-Age=1800"))).toHaveLength(1);
  });

  test.each([
    ["app.picai.so", "picai.so"],
    ["www.example.co.uk", "example.co.uk"],
    ["picai.so", "picai.so"],
  ])("on %s the cookies go on %s", (hostname, domain) => {
    const { jar } = load({ hostname, site: "picai.so" });
    expect(jar.writes.find((w) => w.startsWith("_va_vid="))).toContain(`; Domain=${domain};`);
  });

  test("data-cookie-domain overrides the detected domain", () => {
    const { jar } = load({ hostname: "a.b.picai.so", attrs: { "data-cookie-domain": "b.picai.so" } });
    expect(jar.writes.find((w) => w.startsWith("_va_vid="))).toContain("; Domain=b.picai.so;");
  });

  test("localhost gets host-only cookies", () => {
    const { jar, sent } = load({ hostname: "localhost", site: "localhost" });
    expect(jar.writes.find((w) => w.startsWith("_va_vid="))).not.toContain("Domain=");
    expect(sent[0]).toHaveProperty("vid");
  });

  test("data-cookieless sets no cookies and marks the hit", () => {
    const { jar, sent } = load({ attrs: { "data-cookieless": "" } });
    expect(jar.writes).toEqual([]);
    expect(sent[0]).toMatchObject({ t: "pv", nc: 1 });
    expect(sent[0]).not.toHaveProperty("vid");
    expect(sent[0]).not.toHaveProperty("sid");
  });

  test("a browser that refuses cookies falls back to the cookieless hit", () => {
    const jar = new CookieJar();
    jar.blocked = true;
    const { sent } = load({ jar });
    expect(sent[0]).toMatchObject({ nc: 1 });
    expect(sent[0]).not.toHaveProperty("vid");
  });

  test("ids are UUIDs even without crypto.randomUUID", () => {
    const { sent } = load({ noRandomUUID: true });
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(sent[0].vid).toMatch(uuid);
    expect(sent[0].sid).toMatch(uuid);
    expect(sent[0].pvId).toMatch(uuid);
  });
});

describe("SPA route changes", () => {
  test("send a non-unique pageview and close the previous one with a ping", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { sent, history } = load({ referrer: "https://google.com/" });
    vi.setSystemTime(4_000);
    history.pushState({}, "", "/pricing");
    expect(sent.map((s) => s.t)).toEqual(["pv", "ping", "pv"]);
    expect(sent[1]).toMatchObject({ t: "ping", pvId: "id-1", ms: 4_000 });
    expect(sent[2]).toMatchObject({ t: "pv", path: "/pricing", unique: false, pvId: "id-4", ref: "picai.so" });
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

describe("engaged-time pings", () => {
  test("go every 60 seconds while visible, with the time since the last one", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const page = load();
    vi.setSystemTime(60_000);
    page.tick();
    vi.setSystemTime(120_000);
    page.tick();
    expect(pings(page.sent)).toEqual([
      expect.objectContaining({ t: "ping", site: "picai.so", pvId: "id-1", ms: 60_000, vid: "id-2", sid: "id-3" }),
      expect.objectContaining({ ms: 60_000 }),
    ]);
  });

  test("count only visible time, so time after the tab comes back is kept", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const page = load();
    vi.setSystemTime(10_000);
    page.setVisibility("hidden"); // 10s
    vi.setSystemTime(600_000);
    page.tick(); // hidden: nothing
    page.setVisibility("visible");
    vi.setSystemTime(605_000);
    page.fire("pagehide"); // 5s
    expect(pings(page.sent).map((p) => p.ms)).toEqual([10_000, 5_000]);
  });

  test("send nothing when no visible time has passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const page = load();
    vi.setSystemTime(10_000);
    page.setVisibility("hidden");
    page.fire("pagehide");
    expect(pings(page.sent)).toHaveLength(1);
  });

  test("cap each ping at 70 seconds and each pageview at 30 pings", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const page = load();
    for (let i = 1; i <= 35; i++) {
      vi.setSystemTime(i * 100_000);
      page.tick();
    }
    const sent = pings(page.sent);
    expect(sent).toHaveLength(30);
    expect(sent.every((p) => p.ms === 70_000)).toBe(true);
  });

  test("a new pageview gets a fresh ping budget", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const page = load();
    for (let i = 1; i <= 30; i++) {
      vi.setSystemTime(i * 60_000);
      page.tick();
    }
    page.history.pushState({}, "", "/next");
    vi.setSystemTime(30 * 60_000 + 5_000);
    page.tick();
    expect(pings(page.sent).at(-1)).toMatchObject({ pvId: "id-4", ms: 5_000 });
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

  test("sa_ignore also deletes both cookies", () => {
    const jar = new CookieJar();
    load({ jar });
    expect(jar.values.has("_va_vid")).toBe(true);
    load({ jar, ignore: true });
    expect(jar.values.has("_va_vid")).toBe(false);
    expect(jar.values.has("_va_sid")).toBe(false);
  });

  test("localhost is tracked when the site is literally 'localhost'", () => {
    expect(load({ hostname: "localhost", site: "localhost" }).sent).toHaveLength(1);
  });
});

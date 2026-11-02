// @vitest-environment node
/// <reference types="vite/client" />
import { gzipSync } from "node:zlib";
import { transformSync } from "esbuild";
import { afterEach, describe, expect, test, vi } from "vitest";
import raw from "../script/script.js?raw";

// The tests run the minified script, exactly as `npm run build:script` serves it
const source = transformSync(raw, { minify: true, target: "es5" }).code;

type Sent = Record<string, unknown>;
type Listener = (event?: unknown) => void;

/** Just enough of an Element for the click listener: attributes, href and closest(). */
type FakeElement = {
  tag: string;
  attrs: Record<string, string>;
  parent?: FakeElement;
  href?: string;
  getAttribute: (name: string) => string | null;
  closest: (selector: string) => FakeElement | null;
};

function element(tag: string, attrs: Record<string, string> = {}, parent?: FakeElement): FakeElement {
  const matches = (e: FakeElement, selector: string) =>
    selector === "[data-goal]" ? "data-goal" in e.attrs : selector === "a[href]" && e.tag === "a" && "href" in e.attrs;
  const el: FakeElement = {
    tag,
    attrs,
    parent,
    // Browsers resolve an anchor's href against the page
    href: attrs.href === undefined ? undefined : new URL(attrs.href, "https://picai.so/").href,
    getAttribute: (name) => attrs[name] ?? null,
    closest: (selector) => {
      for (let e: FakeElement | undefined = el; e; e = e.parent) if (matches(e, selector)) return e;
      return null;
    },
  };
  return el;
}

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

/** Runs the minified src/script/script.js against a minimal fake browser and records what it sends. */
function load(opts: {
  hostname?: string;
  pathname?: string;
  search?: string;
  referrer?: string;
  navType?: string;
  site?: string;
  attrs?: Record<string, string>;
  webdriver?: boolean;
  ignore?: boolean;
  jar?: CookieJar;
  noRandomUUID?: boolean;
  analytics?: unknown;
  title?: string;
  /** The collect route's reply to a pageview: "" (a 204), "cookies" or "cookieless" */
  reply?: string;
  /** localStorage, shared across page loads like `jar`; null makes every access throw */
  storage?: Map<string, string> | null;
  /** A browser without fetch, so pageviews go by beacon */
  noFetch?: boolean;
} = {}) {
  const sent: Sent[] = [];
  const beacons: Sent[] = [];
  const winListeners: Record<string, Listener[]> = {};
  const docListeners: Record<string, Listener[]> = {};
  const intervals: Listener[] = [];
  const location = {
    hostname: opts.hostname ?? "picai.so",
    pathname: opts.pathname ?? "/",
    search: opts.search ?? "",
    protocol: "https:",
  };
  const jar = opts.jar ?? new CookieJar();
  const storage = opts.storage === undefined ? new Map<string, string>() : opts.storage;
  jar.hostname = location.hostname;
  const attrs: Record<string, string> = { "data-site": opts.site ?? "picai.so", ...opts.attrs };

  const document = {
    currentScript: {
      src: "https://stats.example.com/script.js",
      getAttribute: (name: string) => attrs[name] ?? null,
    },
    referrer: opts.referrer ?? "",
    title: opts.title ?? "",
    visibilityState: "visible",
    addEventListener: (type: string, fn: Listener, capture?: boolean) => {
      if (type === "click" || type === "auxclick") expect(capture).toBe(true);
      (docListeners[type] ??= []).push(fn);
    },
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
  const window: Record<string, unknown> = {
    analytics: opts.analytics,
    location,
    history,
    screen: { width: 1440 },
    navigator: {
      webdriver: opts.webdriver ?? false,
      sendBeacon: (url: string, body: string) => {
        expect(url).toBe("https://stats.example.com/api/collect");
        sent.push(JSON.parse(body));
        beacons.push(JSON.parse(body));
        return true;
      },
    },
    fetch: opts.noFetch
      ? undefined
      : (url: string, init: { method: string; body: string; keepalive: boolean }) => {
          expect(url).toBe("https://stats.example.com/api/collect");
          expect(init).toMatchObject({ method: "POST", keepalive: true });
          sent.push(JSON.parse(init.body));
          return Promise.resolve({ text: () => Promise.resolve(opts.reply ?? "") });
        },
    localStorage: {
      getItem: (k: string) => {
        if (storage === null) throw new Error("SecurityError");
        return k === "sa_ignore" && opts.ignore ? "true" : (storage.get(k) ?? null);
      },
      setItem: (k: string, v: string) => {
        if (storage === null) throw new Error("SecurityError");
        storage.set(k, v);
      },
      removeItem: (k: string) => {
        if (storage === null) throw new Error("SecurityError");
        storage.delete(k);
      },
    },
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
    beacons,
    storage,
    jar,
    history,
    fire: (type: string) => (winListeners[type] ?? []).forEach((fn) => fn()),
    tick: () => intervals.forEach((fn) => fn()),
    setVisibility(state: "visible" | "hidden") {
      document.visibilityState = state;
      (docListeners.visibilitychange ?? []).forEach((fn) => fn());
    },
    location,
    window,
    document,
    /** A click (button 0) or auxclick (1 = middle, 2 = right) on `target`. */
    click(target: FakeElement, button = 0) {
      const type = button === 0 ? "click" : "auxclick";
      (docListeners[type] ?? []).forEach((fn) => fn({ type, button, target }));
    },
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

// Lets the fake fetch's reply reach the script
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("visitor identity reply", () => {
  test("pageviews go by fetch and everything else by beacon", () => {
    const { sent, beacons, window } = load();
    (window.analytics as (...args: unknown[]) => unknown)("goal", "signup");
    expect(sent.map((s) => s.t)).toEqual(["pv", "goal"]);
    expect(beacons.map((s) => s.t)).toEqual(["goal"]);
  });

  test("without fetch, a pageview goes by beacon", () => {
    const { beacons } = load({ noFetch: true });
    expect(beacons.map((s) => s.t)).toEqual(["pv"]);
  });

  test("cookieless clears both cookies after one hit, and no ids are sent afterwards", async () => {
    const jar = new CookieJar();
    const storage = new Map<string, string>();
    const first = load({ jar, storage, reply: "cookieless" });
    expect(first.sent[0]).toHaveProperty("vid");
    await settle();
    expect([...jar.values.keys()].filter((k) => k.startsWith("_va_"))).toEqual([]);
    expect(storage.get("_va_nc")).toBe("1");
    // The rest of this page load
    first.history.pushState({}, "", "/pricing");
    (first.window.analytics as (...args: unknown[]) => unknown)("identify", { email: "jo@example.com" });
    expect((first.window.analytics as (cmd: string) => unknown)("attribution")).toEqual({});
    expect(first.sent.at(-1)).toMatchObject({ t: "pv", path: "/pricing", nc: 1 });
    expect(first.sent.slice(1).some((s) => "vid" in s || s.t === "identify")).toBe(false);

    // The next page load
    const writes = jar.writes.length;
    const next = load({ jar, storage, reply: "cookieless", search: "?session_id=cs_test_1" });
    expect(next.sent.map((s) => s.t)).toEqual(["pv"]);
    expect(next.sent[0]).toMatchObject({ nc: 1 });
    expect(next.sent[0]).not.toHaveProperty("vid");
    await settle();
    expect(jar.writes.slice(writes)).toEqual([]);
  });

  test("switching back to cookies resumes ids on the next visit", async () => {
    const jar = new CookieJar();
    const storage = new Map([["_va_nc", "1"]]);
    const page = load({ jar, storage, reply: "cookies" });
    expect(page.sent[0]).not.toHaveProperty("vid");
    await settle();
    expect(storage.has("_va_nc")).toBe(false);
    const next = load({ jar, storage, reply: "cookies" });
    expect(next.sent[0]).toHaveProperty("vid");
    expect(jar.values.has("_va_vid")).toBe(true);
  });

  test("an empty reply (an older server, or an error) changes nothing", async () => {
    const storage = new Map([["_va_nc", "1"]]);
    const { jar } = load({ storage, reply: "" });
    await settle();
    expect(storage.get("_va_nc")).toBe("1");
    const cookies = load({ reply: "" });
    await settle();
    expect(cookies.jar.values.has("_va_vid")).toBe(true);
    expect(jar.writes).toEqual([]);
  });

  test("data-cookieless stores nothing, whatever the reply", async () => {
    for (const reply of ["cookieless", "cookies"]) {
      const { jar, storage, sent } = load({ attrs: { "data-cookieless": "" }, reply });
      await settle();
      expect(jar.writes).toEqual([]);
      expect(storage!.size).toBe(0);
      expect(sent[0]).not.toHaveProperty("vid");
    }
  });

  test("without localStorage, cookieless still clears the cookies for this page load", async () => {
    const { jar, sent, history } = load({ storage: null, reply: "cookieless" });
    await settle();
    expect(jar.values.has("_va_vid")).toBe(false);
    history.pushState({}, "", "/next");
    expect(sent.at(-1)).not.toHaveProperty("vid");
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

describe("page titles", () => {
  test("go with the pageview, whitespace collapsed and cut to 200 characters", () => {
    expect(load({ title: "  Pricing \n  — Picai  " }).sent[0]).toMatchObject({ t: "pv", ti: "Pricing — Picai" });
    expect((load({ title: "x".repeat(250) }).sent[0].ti as string).length).toBe(200);
  });

  test("are left out when the page has none", () => {
    expect(load({ title: "   " }).sent[0]).not.toHaveProperty("ti");
  });

  test("after an SPA route change, only once the app has set a new title", () => {
    const { sent, history, document } = load({ title: "Home" });
    history.pushState({}, "", "/stale");
    document.title = "Pricing";
    history.pushState({}, "", "/pricing");
    const pageviews = sent.filter((s) => s.t === "pv");
    expect(pageviews.map((s) => [s.path, s.ti])).toEqual([
      ["/", "Home"],
      ["/stale", undefined],
      ["/pricing", "Pricing"],
    ]);
  });
});

describe("campaign tags", () => {
  test("are sent with the first pageview, and nothing else of the query string", () => {
    const { sent } = load({
      search: "?utm_source=test&utm_campaign=phase5b&gclid=secret&email=a%40b.com&utm_medium=cpc",
    });
    expect(sent[0].c).toEqual({ utm_source: "test", utm_campaign: "phase5b", utm_medium: "cpc" });
    expect(JSON.stringify(sent[0])).not.toMatch(/secret|a@b/);
  });

  test("decode the value, turn + into spaces and cut it to 100 characters", () => {
    const { sent } = load({ search: `?utm_term=red+shoes%21&utm_content=${"x".repeat(150)}` });
    expect(sent[0].c).toEqual({ utm_term: "red shoes!", utm_content: "x".repeat(100) });
  });

  test("include ref and via, and skip empty or malformed values", () => {
    const { sent } = load({ search: "?ref=launch&via=friend&utm_source=&utm_medium=%E0%A4%A&=x" });
    expect(sent[0].c).toEqual({ ref: "launch", via: "friend" });
  });

  test("are left out without tags, and on SPA route changes", () => {
    const { sent, history, location } = load({ search: "?utm_source=test" });
    location.search = "?utm_source=other";
    history.pushState(null, "", "/next");
    expect(sent.filter((s) => s.t === "pv").map((s) => s.c)).toEqual([{ utm_source: "test" }, undefined]);
    expect(load({ search: "?page=2" }).sent[0].c).toBeUndefined();
    expect(load().sent[0].c).toBeUndefined();
  });
});

describe("goals and identify", () => {
  const analytics = (w: Record<string, unknown>) => w.analytics as (...args: unknown[]) => unknown;

  test("analytics('goal') sends the name and props with the current pageview's id", () => {
    const { sent, window } = load();
    analytics(window)("goal", "signup", { plan: "pro" });
    expect(sent[1]).toEqual({
      t: "goal",
      name: "signup",
      p: { plan: "pro" },
      site: "picai.so",
      pvId: sent[0].pvId,
      vid: sent[0].vid,
      sid: sent[0].sid,
    });
  });

  test("a goal after an SPA route change belongs to the new page", () => {
    const { sent, window, history } = load();
    history.pushState(null, "", "/pricing");
    analytics(window)("goal", "signup");
    const pv = sent.filter((s) => s.t === "pv")[1];
    expect(sent.at(-1)).toMatchObject({ t: "goal", pvId: pv.pvId });
  });

  test("identify sends only id, email and name", () => {
    const { sent, window } = load();
    analytics(window)("identify", { id: "u_1", email: "jo@example.com", name: "Jo", plan: "pro" });
    expect(sent[1]).toMatchObject({ t: "identify", u: { id: "u_1", email: "jo@example.com", name: "Jo" } });
    expect((sent[1].u as Record<string, unknown>).plan).toBeUndefined();
  });

  test("cookieless mode sends goals but never identify", () => {
    const { sent, window } = load({ attrs: { "data-cookieless": "" } });
    analytics(window)("identify", { email: "jo@example.com" });
    analytics(window)("goal", "signup");
    expect(sent.map((s) => s.t)).toEqual(["pv", "goal"]);
  });

  test("ignores unknown commands and a goal without a name", () => {
    const { sent, window } = load();
    analytics(window)("goal");
    analytics(window)("track", "x");
    analytics(window)("identify");
    expect(sent).toHaveLength(1);
  });

  test("calls queued by the stub before the script loaded are sent after the pageview", () => {
    const stub = Object.assign(() => {}, {
      q: [
        ["goal", "newsletter"],
        ["identify", { email: "jo@example.com" }],
      ],
    });
    const { sent, window } = load({ analytics: stub });
    expect(sent.map((s) => s.t)).toEqual(["pv", "goal", "identify"]);
    expect(sent[1].pvId).toBe(sent[0].pvId);
    expect(window.analytics).not.toBe(stub);
  });

  test("leaves another tool's analytics object alone", () => {
    const segment = { track: () => {} };
    const { window } = load({ analytics: segment });
    expect(window.analytics).toBe(segment);
  });

  test("a click inside an element with data-goal sends that goal", () => {
    const { sent, click } = load();
    const button = element("button", { "data-goal": "signup" });
    click(element("span", {}, button));
    expect(sent[1]).toMatchObject({ t: "goal", name: "signup", pvId: sent[0].pvId });
  });

  test("a right click on a data-goal element sends nothing", () => {
    const { sent, click } = load();
    click(element("button", { "data-goal": "signup" }), 2);
    expect(sent).toHaveLength(1);
  });
});

describe("outbound links", () => {
  test("a click on a link to another host sends its origin and path only", () => {
    const { sent, click } = load();
    const link = element("a", { href: "https://github.com/acme/repo?tab=readme#top" });
    click(element("img", {}, link));
    expect(sent[1]).toMatchObject({ t: "out", url: "https://github.com/acme/repo", pvId: sent[0].pvId });
  });

  test("a middle click counts, a right click does not", () => {
    const { sent, click } = load();
    const link = element("a", { href: "https://github.com/" });
    click(link, 1);
    click(link, 2);
    expect(sent.filter((s) => s.t === "out")).toHaveLength(1);
  });

  test.each([
    ["a link on the same host", "/pricing"],
    ["a mailto: link", "mailto:jo@example.com"],
    ["a tel: link", "tel:+15551234"],
  ])("ignores %s", (_name, href) => {
    const { sent, click } = load();
    click(element("a", { href }));
    expect(sent).toHaveLength(1);
  });

  test("ignores clicks outside links", () => {
    const { sent, click } = load();
    click(element("div"));
    expect(sent).toHaveLength(1);
  });

  test("a data-goal link to another site sends both the goal and the outbound click", () => {
    const { sent, click } = load();
    click(element("a", { href: "https://cal.com/jo", "data-goal": "book" }));
    expect(sent.slice(1).map((s) => s.t)).toEqual(["goal", "out"]);
  });
});

describe("checkout attribution", () => {
  test("attribution() returns the visitor and session ids for Checkout metadata", () => {
    const { window, jar } = load();
    const api = window.analytics as (cmd: string) => unknown;
    const ids = api("attribution") as Record<string, string>;
    expect(ids).toEqual({ va_vid: jar.values.get("_va_vid"), va_sid: jar.values.get("_va_sid") });
    expect(ids.va_vid).toMatch(/^id-/);
  });

  test("attribution() leaves out an expired session id, and is empty in cookieless mode", () => {
    const a = load();
    a.jar.values.delete("_va_sid");
    expect((a.window.analytics as (cmd: string) => unknown)("attribution")).toEqual({ va_vid: a.jar.values.get("_va_vid") });
    const b = load({ attrs: { "data-cookieless": "" } });
    expect((b.window.analytics as (cmd: string) => unknown)("attribution")).toEqual({});
  });

  test("a Stripe success page sends the Checkout Session id and nothing else from the URL", () => {
    const { sent } = load({ search: "?session_id=cs_test_a1B2c3D4e5&email=jo%40example.com" });
    const pv = sent[0];
    expect(sent[1]).toEqual({ t: "claim", cs: "cs_test_a1B2c3D4e5", site: "picai.so", pvId: pv.pvId, vid: pv.vid, sid: pv.sid });
    expect(JSON.stringify(sent)).not.toContain("example.com");
  });

  test("no claim without a cs_ session id, or in cookieless mode", () => {
    expect(load({ search: "?session_id=abc" }).sent.map((s) => s.t)).toEqual(["pv"]);
    expect(load({ search: "?other=1" }).sent.map((s) => s.t)).toEqual(["pv"]);
    const cookieless = load({ search: "?session_id=cs_test_a1B2c3D4e5", attrs: { "data-cookieless": "" } });
    expect(cookieless.sent.map((s) => s.t)).toEqual(["pv"]);
  });
});

describe("size", () => {
  test("the minified script stays under 3 KB gzipped", () => {
    expect(gzipSync(source).length).toBeLessThan(3 * 1024);
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

  test("?_va_ignore=1 stores the flag, deletes both cookies and sends nothing", () => {
    const jar = new CookieJar();
    const storage = new Map<string, string>();
    load({ jar, storage });
    expect(jar.values.has("_va_vid")).toBe(true);
    const ignored = load({ jar, storage, search: "?utm_source=x&_va_ignore=1" });
    expect(ignored.sent).toHaveLength(0);
    expect(storage.get("_va_ignore")).toBe("1");
    expect(jar.values.has("_va_vid")).toBe(false);
    expect(jar.values.has("_va_sid")).toBe(false);
  });

  test("an ignored browser sends no pageviews, goals, outbound clicks or pings on later loads", () => {
    const storage = new Map([["_va_ignore", "1"]]);
    const stub = Object.assign(() => {}, { q: [["goal", "queued"]] });
    const page = load({ storage, analytics: stub });
    page.click(element("a", { href: "https://other.com/", "data-goal": "signup" }));
    page.history.pushState(null, "", "/next");
    page.tick();
    page.fire("pagehide");
    expect(page.sent).toHaveLength(0);
    expect(page.beacons).toHaveLength(0);
    // The stub stays a stub, so calls are queued and never sent
    expect(page.window.analytics).toBe(stub);
  });

  test("?_va_ignore=0 clears the flag and tracking resumes on the same load", () => {
    const storage = new Map([["_va_ignore", "1"]]);
    const page = load({ storage, search: "?_va_ignore=0" });
    expect(storage.has("_va_ignore")).toBe(false);
    expect(page.sent.map((s) => s.t)).toEqual(["pv"]);
    // Nothing of the query string is sent
    expect(JSON.stringify(page.sent)).not.toContain("_va_ignore");
    expect(load({ storage }).sent).toHaveLength(1);
  });

  test("other _va_ignore values change nothing", () => {
    const storage = new Map<string, string>();
    expect(load({ storage, search: "?_va_ignore=yes" }).sent).toHaveLength(1);
    expect(storage.has("_va_ignore")).toBe(false);
  });

  test("blocked localStorage: the ignore link can't be stored, so the page is tracked", () => {
    expect(load({ storage: null, search: "?_va_ignore=1" }).sent).toHaveLength(1);
  });

  test("localhost is tracked when the site is literally 'localhost'", () => {
    expect(load({ hostname: "localhost", site: "localhost" }).sent).toHaveLength(1);
  });
});

/* Analytics. Sets a first-party visitor and session cookie, unless the snippet has data-cookieless. */
(function (w, d) {
  try {
    var script = d.currentScript;
    var site = script && script.getAttribute("data-site");
    if (!site) return;

    var loc = w.location;
    var nav = w.navigator;
    var host = loc.hostname;
    var cookieless = script.getAttribute("data-cookieless") !== null;
    var VID = "_va_vid";
    var SID = "_va_sid";
    var secure = loc.protocol === "https:" ? "; Secure" : "";
    var cookieDomain = null;

    function readCookie(name) {
      var m = d.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
      return m ? m[1] : null;
    }

    function writeCookie(name, value, maxAge, domain) {
      d.cookie =
        name + "=" + value + "; Max-Age=" + maxAge + "; Path=/" +
        (domain ? "; Domain=" + domain : "") + "; SameSite=Lax" + secure;
    }

    // The widest domain that takes a cookie (example.com for app.example.com), so
    // subdomains share one visitor. Browsers refuse public suffixes such as co.uk.
    function rootDomain() {
      if (cookieDomain !== null) return cookieDomain;
      cookieDomain = script.getAttribute("data-cookie-domain") || "";
      var parts = host.split(".");
      for (var i = 2; !cookieDomain && i <= parts.length; i++) {
        var candidate = parts.slice(-i).join(".");
        writeCookie("_va_t", "1", 10, candidate);
        if (readCookie("_va_t")) {
          writeCookie("_va_t", "", 0, candidate);
          cookieDomain = candidate;
        }
      }
      return cookieDomain;
    }

    // Skip local and IP hosts (unless tracking a site literally called "localhost"),
    // automated browsers, and anyone who opted out with localStorage.sa_ignore = "true"
    var isLocal = host === "localhost" || /^[\d.]+$/.test(host) || host.indexOf(":") !== -1 || host.charAt(0) === "[";
    if (isLocal && site !== "localhost") return;
    if (nav.webdriver) return;
    try {
      if (w.localStorage.getItem("sa_ignore") === "true") {
        writeCookie(VID, "", 0, rootDomain());
        writeCookie(SID, "", 0, rootDomain());
        return;
      }
    } catch (e) {}

    var endpoint = script.src.split("/script.js")[0] + "/api/collect";

    function uuid() {
      try {
        if (w.crypto && w.crypto.randomUUID) return w.crypto.randomUUID();
      } catch (e) {}
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 3) | 8).toString(16);
      });
    }

    // Every send renews the visitor id (400 days) and slides the session (30 minutes).
    // If the browser refuses cookies, count the hit the cookieless way instead.
    function send(data) {
      if (!cookieless) {
        var domain = rootDomain();
        var vid = readCookie(VID) || uuid();
        var sid = readCookie(SID) || uuid();
        writeCookie(VID, vid, 34560000, domain);
        writeCookie(SID, sid, 1800, domain);
        if (readCookie(VID) === vid) {
          data.vid = vid;
          data.sid = sid;
        }
      }
      if (!data.vid) data.nc = 1;
      var body = JSON.stringify(data);
      try {
        if (nav.sendBeacon && nav.sendBeacon(endpoint, body)) return;
      } catch (e) {}
      try {
        w.fetch(endpoint, { method: "POST", body: body, keepalive: true });
      } catch (e) {}
    }

    function hostnameOf(url) {
      try {
        return new URL(url).hostname;
      } catch (e) {
        return "";
      }
    }

    // Campaign tags from the URL (cut to 100 characters); nothing else of the query string is sent
    function campaign() {
      var tags = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "via"];
      var pairs = (loc.search || "").substring(1).split("&");
      var c = null;
      for (var i = 0; i < pairs.length; i++) {
        var eq = pairs[i].indexOf("=");
        if (eq < 1) continue;
        var key = pairs[i].substring(0, eq);
        if (tags.indexOf(key) === -1) continue;
        try {
          var value = decodeURIComponent(pairs[i].substring(eq + 1).replace(/\+/g, " ")).substring(0, 100);
          if (value) (c = c || {})[key] = value;
        } catch (e) {}
      }
      return c;
    }

    function navigationType() {
      try {
        var entry = w.performance.getEntriesByType("navigation")[0];
        return entry ? entry.type : "";
      } catch (e) {
        return "";
      }
    }

    // Visible time on the current page, paused while the tab is hidden
    var pvId = null;
    var lastPath = null;
    var pendingMs = 0;
    var visibleSince = null;
    var pings = 0;

    function now() {
      return Date.now();
    }

    function pause() {
      if (visibleSince !== null) {
        pendingMs += now() - visibleSince;
        visibleSince = null;
      }
    }

    function resume() {
      if (visibleSince === null && d.visibilityState !== "hidden") visibleSince = now();
    }

    // Sends the visible time since the last ping, at most 30 pings per pageview
    function ping() {
      if (!pvId) return;
      pause();
      var ms = Math.min(Math.round(pendingMs), 70000);
      pendingMs = 0;
      resume();
      if (ms > 0 && pings < 30) {
        pings++;
        send({ t: "ping", site: site, pvId: pvId, ms: ms });
      }
    }

    function pageview(isFirst) {
      var path = loc.pathname;
      if (path === lastPath) return;
      if (!isFirst) ping();

      var ref = "";
      var unique = false;
      if (isFirst) {
        ref = d.referrer || "";
        var refHost = hostnameOf(ref);
        var type = navigationType();
        unique = (!refHost || refHost !== host) && type !== "reload" && type !== "back_forward";
        ref = refHost;
      } else {
        ref = host; // SPA route change: internal navigation
      }

      lastPath = path;
      pvId = uuid();
      pendingMs = 0;
      visibleSince = null;
      pings = 0;
      resume();

      var data = {
        t: "pv",
        site: site,
        host: host,
        path: path,
        ref: ref,
        unique: unique,
        pvId: pvId,
        sw: w.screen ? w.screen.width : undefined
      };
      var tags = isFirst && campaign();
      if (tags) data.c = tags;
      send(data);
    }

    function wrapHistory(name) {
      var original = w.history[name];
      if (!original) return;
      w.history[name] = function () {
        var result = original.apply(this, arguments);
        try {
          pageview(false);
        } catch (e) {}
        return result;
      };
    }

    wrapHistory("pushState");
    wrapHistory("replaceState");
    w.addEventListener("popstate", function () {
      try {
        pageview(false);
      } catch (e) {}
    });

    d.addEventListener("visibilitychange", function () {
      if (d.visibilityState === "hidden") {
        ping();
      } else {
        resume();
      }
    });
    w.addEventListener("pagehide", ping);

    // Goals, identify and outbound links, tied to the current pageview
    function track(data) {
      data.site = site;
      data.pvId = pvId;
      send(data);
    }

    function api(cmd, a, b) {
      if (cmd === "goal" && a) track({ t: "goal", name: "" + a, p: b });
      if (cmd === "identify" && a && !cookieless) track({ t: "identify", u: { id: a.id, email: a.email, name: a.name } });
    }

    // Capture phase, so links that stop propagation still count. Left and middle clicks only.
    function onClick(e) {
      try {
        if (e.button > 1) return;
        var goal = e.target.closest("[data-goal]");
        if (goal) api("goal", goal.getAttribute("data-goal"));
        var link = e.target.closest("a[href]");
        var url = link && new URL(link.href);
        if (url && url.hostname !== host && /^http/.test(url.protocol)) track({ t: "out", url: url.origin + url.pathname });
      } catch (x) {}
    }
    d.addEventListener("click", onClick, true);
    d.addEventListener("auxclick", onClick, true);
    w.setInterval(function () {
      try {
        if (d.visibilityState !== "hidden") ping();
      } catch (e) {}
    }, 60000);

    pageview(true);

    // Replay calls queued by the stub before the script loaded. An object here is
    // another tool's `analytics` (Segment's, say), so leave it alone.
    var stub = w.analytics;
    if (!stub || typeof stub === "function") {
      w.analytics = api;
      var queue = (stub && stub.q) || [];
      for (var q = 0; q < queue.length; q++) api.apply(null, queue[q]);
    }
  } catch (e) {}
})(window, document);

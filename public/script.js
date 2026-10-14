/* Cookieless analytics. Stores nothing on the visitor's device. */
(function (w, d) {
  try {
    var script = d.currentScript;
    var site = script && script.getAttribute("data-site");
    if (!site) return;

    var loc = w.location;
    var nav = w.navigator;
    var host = loc.hostname;

    // Skip local and IP hosts (unless tracking a site literally called "localhost"),
    // automated browsers, and anyone who opted out with localStorage.sa_ignore = "true"
    var isLocal = host === "localhost" || /^[\d.]+$/.test(host) || host.indexOf(":") !== -1 || host.charAt(0) === "[";
    if (isLocal && site !== "localhost") return;
    if (nav.webdriver) return;
    try {
      if (w.localStorage.getItem("sa_ignore") === "true") return;
    } catch (e) {}

    var endpoint = script.src.split("/script.js")[0] + "/api/collect";

    function send(data) {
      var body = JSON.stringify(data);
      try {
        if (nav.sendBeacon && nav.sendBeacon(endpoint, body)) return;
      } catch (e) {}
      try {
        w.fetch(endpoint, { method: "POST", body: body, keepalive: true });
      } catch (e) {}
    }

    function randomId() {
      try {
        if (w.crypto && w.crypto.randomUUID) return w.crypto.randomUUID();
      } catch (e) {}
      return Math.random().toString(36).slice(2) + Date.now().toString(36);
    }

    function hostnameOf(url) {
      try {
        return new URL(url).hostname;
      } catch (e) {
        return "";
      }
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
    var visibleMs = 0;
    var visibleSince = null;
    var durationSent = false;

    function now() {
      return Date.now();
    }

    function pause() {
      if (visibleSince !== null) {
        visibleMs += now() - visibleSince;
        visibleSince = null;
      }
    }

    function resume() {
      if (visibleSince === null && d.visibilityState !== "hidden") visibleSince = now();
    }

    function sendDuration() {
      if (!pvId || durationSent) return;
      pause();
      durationSent = true;
      send({ t: "dur", site: site, pvId: pvId, ms: Math.min(Math.round(visibleMs), 1800000) });
    }

    function pageview(isFirst) {
      var path = loc.pathname;
      if (path === lastPath) return;
      if (!isFirst) sendDuration();

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
      pvId = randomId();
      visibleMs = 0;
      visibleSince = null;
      durationSent = false;
      resume();

      send({
        t: "pv",
        site: site,
        host: host,
        path: path,
        ref: ref,
        unique: unique,
        pvId: pvId,
        sw: w.screen ? w.screen.width : undefined
      });
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
        sendDuration();
      } else {
        resume();
      }
    });
    w.addEventListener("pagehide", sendDuration);

    pageview(true);
  } catch (e) {}
})(window, document);

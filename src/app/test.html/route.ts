// Dev-only page that loads the tracking script against this app.
// Add a site with the domain "localhost" first, then open http://localhost:3000/test.html.

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tracking script test</title>
  <style>body{font:16px system-ui;margin:2rem;max-width:40rem;background:#0a0a0a;color:#ededed}a,button{color:#7aa2ff}</style>
</head>
<body>
  <h1>Tracking script test</h1>
  <p>Each load sends a pageview for the site <code>localhost</code>. Switching tabs or closing this one sends the time on page.</p>
  <p><button id="spa">pushState to /test.html/next</button> simulates an SPA route change.</p>
  <p><a href="/test.html">Reload via link</a> (internal navigation, not unique)</p>
  <p><button data-goal="test-signup">data-goal="test-signup"</button> sends a goal on click.</p>
  <p><button id="goal">analytics("goal", "test-code", { plan: "pro" })</button></p>
  <p><button id="identify">analytics("identify", { id: "u_test", email: "test@example.com", name: "Test" })</button></p>
  <p><a href="https://github.com/mselbekk11" target="_blank">github.com/mselbekk11</a> is an outbound link.</p>
  <p><button id="attribution">analytics("attribution")</button> <code id="ids"></code></p>
  <p><a href="/test.html?session_id=cs_test_localclaim0001">Back from Stripe Checkout</a> sends a claim for cs_test_localclaim0001.</p>
  <script>
    window.analytics=window.analytics||function(){(window.analytics.q=window.analytics.q||[]).push(arguments)};
    analytics("goal", "test-queued"); // queued until the script loads
    document.getElementById("spa").onclick = function () {
      history.pushState({}, "", "/test.html/next-" + Date.now());
    };
    document.getElementById("goal").onclick = function () {
      analytics("goal", "test-code", { plan: "pro" });
    };
    document.getElementById("attribution").onclick = function () {
      document.getElementById("ids").textContent = JSON.stringify(analytics("attribution"));
    };
    document.getElementById("identify").onclick = function () {
      analytics("identify", { id: "u_test", email: "test@example.com", name: "Test" });
    };
  </script>
  <script async src="/script.js" data-site="localhost"></script>
</body>
</html>`;

export function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

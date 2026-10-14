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
  <script>
    document.getElementById("spa").onclick = function () {
      history.pushState({}, "", "/test.html/next-" + Date.now());
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

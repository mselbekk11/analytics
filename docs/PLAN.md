# Self-hosted Analytics: Build Plan

Oct 13, 2026 · Morgan Selbekk

## Summary

Build a small, cookieless analytics app that covers exactly the two Simple Analytics (SA) screens you use today, then point your 8 sites at it and cancel SA. Plan: a ~1 KB tracking script posts pageviews to a Next.js route on Vercel, which writes raw events and daily rollups into Convex; the dashboard reads the rollups through Convex queries, gated by Clerk.

**In scope (from the screenshots):**

- **Websites list:** a card per site with a 30-day sparkline (pageviews and visitors) and the 30-day pageview total, a filter box, sort by name, and an Add website button.
- **Site dashboard:** visitors, pageviews and time on page, each with a % change against the previous period; live pageviews; a date range picker defaulting to 30 days; a daily chart with Pageviews and Visitors toggles.
- **Breakdown lists:** Referrals, Pages, Devices (mobile, tablet, desktop), Browsers and Countries, each with counts or percentages and paging.

**Out of scope:** Goals, Events, AI, shared views, trend lines, and anything else SA offers that is not on the screenshots. These can be added later on the same data model.

**Stack:** Next.js (App Router) + TypeScript + Tailwind, Convex for the database and server functions, Clerk for login, Vercel for hosting.

## Instructions for Claude Code

If you are an AI coding agent reading this file, it is your build brief. Build it one phase at a time (see Phased milestones) and stop after each phase so the owner can review and test.

1. **Scope is fixed.** Build only what this document describes. Do not add Goals, Events, UTM tracking, sessions, cookies, `localStorage` visitor ids, IP storage or any feature not listed here. If something seems missing, ask instead of adding it.
2. **Check the docs before writing integration code.** Versions move faster than training data. Before Phase 0, read the current pages for [Convex + Clerk](https://docs.convex.dev/auth/clerk), the [Clerk Next.js quickstart](https://clerk.com/docs/nextjs/getting-started/quickstart) and [Convex on Vercel](https://docs.convex.dev/production/hosting/vercel). Where they disagree with this brief, follow the docs and say so.
3. **Use Convex's AI guidelines.** `npx convex dev` offers to install them on first run; otherwise run `npx convex ai-files install`. This writes `convex/_generated/ai/guidelines.md` and a Convex section in `CLAUDE.md`; follow them (validators on every function, indexes instead of `.filter()`, `internalMutation` for anything not called by the browser).
4. **Conventions:** Next.js App Router, TypeScript strict mode, Tailwind, `src/` directory, npm. Name Convex files by area: `convex/sites.ts`, `convex/ingest.ts`, `convex/stats.ts`, `convex/lib/`.
5. **Test the logic that can silently be wrong.** Use Vitest for the pure helpers: referrer normalisation, device detection, local-date bucketing by timezone, range and previous-range maths, and the unique-visit rule. Use `convex-test` for the ingest mutations and the stats queries.
6. **Done means verified.** At the end of each phase, run `npm run build`, `npx tsc --noEmit`, lint and tests, and report what you checked against the phase's "Done when" line.
7. **Never commit secrets.** Keep keys in `.env.local` (git-ignored) and list every variable name, without values, in `.env.example`.

## Boilerplate review: traffic-source

Use [traffic-source](https://github.com/mddanishyusuf/traffic-source) as a reference, not a starting point: it is MIT-licensed, but almost nothing ports straight across to your stack. It is plain JavaScript on the Pages Router with SASS, SQLite (better-sqlite3), hand-rolled JWT auth and a VPS deploy. Every one of those is replaced by TypeScript, App Router, Tailwind, Convex, Clerk and Vercel. It also carries a lot you do not need: Stripe conversions, affiliates, Google Search Console, visitor journeys, backups and maps.

Its tracking script is also less private than SA. It stores a visitor id in `localStorage` for a year and sets `_ts_vid` and `_ts_sid` cookies, so it would need a cookie banner in the EU. Your version drops both.

| Part of the repo | Verdict | Why |
| --- | --- | --- |
| `public/t.js` (tracking script) | Adapt | Keep the shape: `data-site` attribute, `sendBeacon`, SPA support via `pushState`/`popstate`. Remove ids, cookies, UTM and affiliate code; add the `unique` flag and time-on-page beacon. |
| `src/pages/api/collect.js` (ingest) | Adapt the logic | Reuse its parsing: `ua-parser-js` for browser and device, referrer hostname, screen-width fallback for device type. Rewrite as a Route Handler that calls a Convex mutation. |
| `daily_stats` rollup idea | Keep the idea | Incrementing a per-site, per-day row on ingest is exactly right; extend it to per-dimension counts. |
| `lib/formatters.js`, `iso-countries.js`, `CountryFlag.js` | Port | Small helpers (number and duration formatting, country names, flags); convert to TypeScript. |
| `overview.js` and `realtime.js` APIs | Rewrite | SQL against sessions; replaced by Convex queries over rollups. |
| Charts (Recharts), `MetricCard`, `DataTable` | Borrow patterns | Recharts is a fine choice; restyle with Tailwind. |
| Auth, `withAuth`, `ProtectedRoute`, login/register | Drop | Clerk replaces it. |
| Stripe, affiliates, GSC, journeys, backup, maps | Drop | Not on the screenshots. |

Recommendation: start a fresh `create-next-app` with TypeScript and Tailwind, add Convex and Clerk with their Next.js quickstarts, and copy the handful of pieces marked Adapt or Port above.

## Architecture

One Next.js app on Vercel does two jobs: it serves the tracking script and collect endpoint, and it hosts the dashboard. Convex holds all data and runs every read and write; Clerk only handles sign-in.

```text
Ingest:    site page + script.js --beacon--> Vercel /api/collect --mutation + secret--> Convex ingest.* --> tables (sites, pageviews, dailyStats, dailyDims)
Dashboard: Clerk sign-in --session--> Next.js pages --useQuery--> Convex stats.* (owner-checked) --> tables
```

The top row runs on every pageview of your sites and needs no login. The bottom row is you looking at the dashboard: Clerk signs you in, Convex checks the Clerk token on every query, and results stream to the page whenever new hits land.

## Setup: Clerk, Convex and Vercel

These steps were checked against the official docs on 2026-10-13. Steps marked **(you)** happen in a web dashboard and need the owner; the rest Claude Code can do.

**Before Phase 0 (you):**

- Create free accounts on [Convex](https://www.convex.dev), [Clerk](https://clerk.com) and [Vercel](https://vercel.com), and a GitHub repo for the project.
- Pick a domain for the app, such as `stats.mselbekk.com`. Clerk production instances do not work on `*.vercel.app` domains ([Convex on Vercel](https://docs.convex.dev/production/hosting/vercel)), so a custom domain is required before going live. A subdomain of a domain you already own costs nothing.

**Clerk + Convex** (from [Convex's Clerk guide](https://docs.convex.dev/auth/clerk)):

1. **(you)** Create a Clerk application with email sign-in. In the Clerk Dashboard, activate the **Convex integration** and copy the **Frontend API URL**. You do not need to create a JWT template by hand; the integration does it.
2. **(you)** Under **Access mode**, sign up yourself first, then switch to **Invite-only**. Otherwise anyone who finds the URL can create an account and add sites.
3. `npm install convex @clerk/nextjs`, then `npx convex dev` (creates the dev deployment, writes `NEXT_PUBLIC_CONVEX_URL` to `.env.local`).
4. Create `convex/auth.config.ts`:

```ts
import { AuthConfig } from "convex/server";

export default {
  providers: [
    { domain: process.env.CLERK_JWT_ISSUER_DOMAIN!, applicationID: "convex" },
  ],
} satisfies AuthConfig;
```

5. Set the issuer on the Convex deployment: `npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-instance>.clerk.accounts.dev`.
6. Create `src/proxy.ts` exporting `clerkMiddleware()` with Clerk's default `config.matcher`. Next.js 16 renamed `middleware.ts` to `proxy.ts`; on Next.js 15 or older keep the old name. Protect the dashboard routes with `createRouteMatcher` + `auth.protect()`, and leave `/script.js`, `/api/collect` and the sign-in pages public.
7. In `src/app/layout.tsx`, put `<ClerkProvider>` inside `<body>`, and inside it a client component `ConvexClientProvider` that renders `<ConvexProviderWithClerk client={convex} useAuth={useAuth}>`. ClerkProvider must be the outer one.
8. In client components, gate data on Convex's `<Authenticated>` / `useConvexAuth()`, not Clerk's `useAuth()`, so queries never run before Convex has the token.

**Environment variables:**

| Name | Where it is set | Value |
| --- | --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` (written by `npx convex dev`); set by the build on Vercel | Convex deployment URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local`, Vercel | Clerk API keys page |
| `CLERK_SECRET_KEY` | `.env.local`, Vercel | Clerk API keys page |
| `CLERK_JWT_ISSUER_DOMAIN` | Convex env (dev and prod separately) | Clerk Frontend API URL |
| `INGEST_SECRET` | `.env.local`, Vercel, and Convex env (same value everywhere) | `openssl rand -hex 32` |
| `CONVEX_DEPLOY_KEY` | Vercel only, Production scope | Convex production deploy key |

**Vercel deploy** (from [Convex on Vercel](https://docs.convex.dev/production/hosting/vercel)):

1. **(you)** Import the GitHub repo in Vercel and set the **Build Command** to `npx convex deploy --cmd 'npm run build'`.
2. **(you)** In the Convex dashboard, open the production deployment's settings, generate a **Production Deploy Key**, and add it in Vercel as `CONVEX_DEPLOY_KEY` scoped to Production.
3. **(you)** Add the Clerk keys and `INGEST_SECRET` in Vercel. Set `CLERK_JWT_ISSUER_DOMAIN` and `INGEST_SECRET` on the Convex **production** deployment too (`npx convex env set --prod ...`).
4. **(you)** Before real use, create a Clerk **production** instance for your custom domain, add its DNS records, and swap in its keys and issuer URL.

Each push to `main` then deploys the Convex functions and the Next.js app together.

## Tracking script and ingest

The script stores nothing on the visitor's device and the server never stores an IP address, so no cookie banner is needed. Visitors are counted the way SA counts them: a pageview is a **unique visit** when the visitor arrived from another site or typed the URL, and is not a reload.

**Embed snippet** (one line per site):

```html
<script async src="https://stats.mselbekk.com/script.js" data-site="advancedortholabsf.com"></script>
```

**What `script.js` does** (target under 1.5 KB, plain JS):

1. Exit early when `location.hostname` is `localhost` or an IP, when `navigator.webdriver` is true, or when `localStorage.getItem('sa_ignore') === 'true'` (an opt-in flag you set in your own browser so your visits are not counted; it is never written by the script).
2. On load, and on every SPA route change (`pushState`, `replaceState`, `popstate`), send a pageview: `{ t: 'pv', site, host, path, ref, unique, pvId, sw }`.
    - `unique` follows [SA's rule](https://docs.simpleanalytics.com/explained/unique-visits): true when `document.referrer` is empty or its hostname differs from `location.hostname`, and the navigation type (`performance.getEntriesByType('navigation')[0].type`) is not `reload` or `back_forward`. SPA route changes are always false.
    - `pvId` is a random id (`crypto.randomUUID()` with a `Math.random` fallback) for this one pageview, held in memory only, so the time-on-page beacon can find it.
    - `sw` is `screen.width`, used only as a device fallback. `host` is `location.hostname`.
    - Ignore a route change whose `path` equals the last one sent (hash changes and query-only `replaceState` calls).
3. Track visible time on the page, paused while `document.visibilityState` is hidden. On `pagehide`, on `visibilitychange` to hidden, and just before an SPA route change, send `{ t: 'dur', site, pvId, ms }`. Send it at most once per `pvId`.
4. Send with `navigator.sendBeacon(url, payload)` where `payload` is a plain string (so it goes as `text/plain` and skips the CORS preflight); fall back to `fetch(url, { method: 'POST', body, keepalive: true })`. Wrap everything in `try/catch` so the script can never break the host page.

**Ingest endpoint:** `POST /api/collect`, a Next.js Route Handler on Vercel. It runs on Vercel rather than as a Convex HTTP action because Vercel gives you the visitor's country for free (`x-vercel-ip-country`, or `geolocation()` from `@vercel/functions`) without ever handling the IP yourself.

1. Export `POST` and `OPTIONS` (the `OPTIONS` handler returns `204` with CORS headers, for browsers that preflight the `fetch` fallback). Read the body with `await request.text()`, reject anything over 2 KB, then `JSON.parse` inside `try/catch`.
2. Validate with a small schema (Zod or hand-written): `site` and `host` at most 253 characters, `path` at most 500, `ref` at most 1,000, `ms` an integer from 0 to 1,800,000. Drop bots with the `isbot` package.
3. Derive the dimensions: browser name and device type from the User-Agent with `ua-parser-js` (if it reports no device type, use `sw`: under 768 is mobile, under 1024 tablet, else desktop); country from `geolocation(request).country` in `@vercel/functions` (the `x-vercel-ip-country` header), `"Unknown"` when missing, e.g. in local dev; referrer reduced to a hostname with `www.` stripped, `(direct)` when empty, and dropped when it equals the site's own host; path with query string and hash removed and a trailing slash trimmed (except `/`).
4. Check the request `Origin` header (fall back to `Referer`, then to `host` from the body) and pass that hostname along so Convex can match it to the site.
5. `await` one call to the Convex mutation `ingest.pageview` or `ingest.duration` with `ConvexHttpClient` from `convex/browser`, including `INGEST_SECRET`. Await it rather than fire-and-forget, so the Vercel function does not end first.
6. Always return `204` with `Access-Control-Allow-Origin: *` and `Cache-Control: no-store`, even on errors (log them with `console.error`), so a tracked site never sees a failure.

The mutations are public Convex functions (the route calls them over HTTP) so their first line compares the `secret` argument with `process.env.INGEST_SECRET` and throws on mismatch. They then look up the site by domain with the `by_domain` index and silently ignore the hit if there is no such site or the request hostname is neither the domain nor a subdomain of it (so `www.picai.so` counts for `picai.so`). This stops strangers from writing into your data even though `/api/collect` is public.

## Convex schema and aggregation

Each pageview is written once as a raw row and also added to small per-day counters, so every dashboard query reads at most a few thousand tiny rows no matter how much traffic a site gets. At your current volume (the busiest site is about 733 pageviews a month) this is far more headroom than you need, but it keeps queries fast and cheap as sites grow.

```ts
// convex/schema.ts
export default defineSchema({
  sites: defineTable({
    ownerId: v.string(),        // Clerk user id (identity.subject)
    domain: v.string(),         // "picai.so", no protocol or www
    timezone: v.string(),       // "America/Los_Angeles", sets day boundaries
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_domain", ["domain"]),

  // Raw hits: feeds live pageviews and lets you rebuild rollups later
  pageviews: defineTable({
    siteId: v.id("sites"),
    ts: v.number(),
    path: v.string(),
    referrer: v.string(),       // hostname or "(direct)"
    unique: v.boolean(),
    device: v.string(),         // mobile | tablet | desktop
    browser: v.string(),
    country: v.string(),        // ISO code or "??"
    pvId: v.string(),
    durationMs: v.optional(v.number()),
  })
    .index("by_site_ts", ["siteId", "ts"])
    .index("by_pvId", ["pvId"]),

  // One row per site per day: chart, totals, sparklines, deltas
  dailyStats: defineTable({
    siteId: v.id("sites"),
    date: v.string(),           // "2026-10-13" in the site's timezone
    pageviews: v.number(),
    visitors: v.number(),
    durationSumMs: v.number(),
    durationCount: v.number(),
  }).index("by_site_date", ["siteId", "date"]),

  // One row per site, day, dimension and value: the five lists
  dailyDims: defineTable({
    siteId: v.id("sites"),
    date: v.string(),
    dim: v.union(v.literal("page"), v.literal("referrer"), v.literal("device"),
                 v.literal("browser"), v.literal("country")),
    key: v.string(),
    pageviews: v.number(),
    visitors: v.number(),
  })
    .index("by_site_dim_date", ["siteId", "dim", "date"])
    .index("by_site_date_dim_key", ["siteId", "date", "dim", "key"]),
});
```

**On each pageview** (`ingest.pageview` mutation): insert the raw row; upsert today's `dailyStats` row (`pageviews + 1`, `visitors + 1` if unique); upsert five `dailyDims` rows, one per dimension. Convex mutations are transactions, so the counters never drift from the raw rows.

**On each duration beacon** (`ingest.duration`): find the pageview by its `pvId`, set `durationMs` once, and add it to that day's `durationSumMs` and `durationCount`. Ignore values over 30 minutes. Time on page is then `durationSumMs / durationCount`; SA shows a median, which an average approximates well enough here.

**Details that are easy to get wrong:**

- **Day buckets:** compute the date in the site's timezone with one helper, `localDate(ts, tz)`, using `new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ts)` (gives `2026-10-13`). Unit-test it around midnight and a DST change, and confirm in Phase 1 that a stored row has the expected date. Use the same helper for the dashboard's date ranges.
- **Duration beacon:** match on `pvId` **and** `siteId`, ignore it if `durationMs` is already set, and count it on the pageview's own `date` (not today's), so a tab left open past midnight lands on the right day.
- **Upserts:** read the `dailyStats` or `dailyDims` row through its index with `.unique()`, then `patch` or `insert`. Convex retries a mutation automatically if two hits touch the same row at once, so the counts stay exact.
- **Missing days:** the stats queries fill days with no row as zero, so the chart and sparklines never skip a day.
- **Site domain:** store it lower-case with protocol, `www.` and trailing slash removed, and reject a duplicate on create.
- **Deleting a site:** delete its rows in batches from a scheduled internal mutation (Convex caps a single mutation at 16,000 writes), not in one call.

**How each number is computed:**

| Dashboard number | Source | Calculation |
| --- | --- | --- |
| Visitors, pageviews | `dailyStats` | Sum over the range |
| Time on page | `dailyStats` | Sum of durations ÷ count over the range |
| % change | `dailyStats` | Same sums over the previous range of equal length |
| Daily chart, sparklines | `dailyStats` | One point per day, missing days filled with 0 |
| Pages | `dailyDims`, dim `page` | Pageviews per key |
| Referrals | `dailyDims`, dim `referrer` | Visitors per key (unique visits only, matching SA) |
| Devices, browsers, countries | `dailyDims` | Visitors per key as a % of total visitors |
| Live pageviews | `pageviews` by `by_site_ts` | Rows with `ts` in the last 5 minutes |

Two Convex details to get right: every query first checks `ctx.auth.getUserIdentity()` against `sites.ownerId`; and the live query takes a `since` timestamp from the client (refreshed every 30 seconds), because a Convex query re-runs when its data changes, not when the clock moves.

If counters ever need to scale far beyond this, the [Convex Aggregate component](https://www.convex.dev/components/aggregate) is the drop-in upgrade; it is not needed to start.

## Dashboard pages

Three signed-in pages cover both screenshots, plus a settings page for the embed snippet. All data comes from Convex `useQuery` hooks, so numbers update live without polling.

| Route | What it shows | Convex functions |
| --- | --- | --- |
| `/` | Redirects to `/websites` when signed in, otherwise to `/sign-in`. | none |
| `/websites` | Grid of site cards: sparkline of daily pageviews and visitors (two filled areas), domain, 30-day pageview total. Filter box, sort by name or pageviews, Add website button. Empty state with the Add website form when there are no sites. | `sites.listWithStats` (all of the user's sites with 30 days of `dailyStats`), `sites.create` |
| `/sites/[domain]` | Site switcher in the header. Stat row: visitors, pageviews, time on page with green or red % change, live pageviews. Range picker with arrows to step back a period (7d, 30d, 90d, custom up to 365 days), kept in the URL as `?range=30d`. Daily area chart with Pageviews and Visitors toggles. Four columns: Referrals, Pages, Devices + Browsers, Countries, 10 rows per page. | `stats.summary`, `stats.timeseries`, `stats.breakdown(dim)`, `stats.live` |
| `/sites/[domain]/settings` | Embed snippet with copy button, timezone, delete site. | `sites.get`, `sites.update`, `sites.remove` |
| `/sign-in`, `/sign-up` | Clerk's `<SignIn />` and `<SignUp />` components on catch-all routes (`[[...sign-in]]`). | none |
| `/api/collect`, `/script.js` | Public: the ingest endpoint and the tracking script. | `ingest.pageview`, `ingest.duration` |

**Building blocks:** Recharts `AreaChart` for both the sparkline and the main chart; a `StatTile` (label, value, delta badge); a `BreakdownList` (count or % bar, label, pager) reused for all five lists; country flags from `react-flagpack` or emoji; browser icons from `react-icons`. Dark theme by default to match SA.

**Auth wiring:** set up exactly as in the Setup section above. On top of that, every `sites.*` and `stats.*` function starts with a shared helper, `requireSite(ctx, domain)`, that calls `ctx.auth.getUserIdentity()`, throws if it is null, loads the site by domain and throws unless `site.ownerId === identity.subject`. The proxy protects pages; this helper is what actually protects the data.

Site pages live under `/sites/` rather than at the root (SA uses `/picai.so`) because Clerk's default proxy matcher skips paths that look like files, and a domain such as `foo.zip` would slip past it. Pages render as client components that call `useQuery`; show skeleton tiles while data is `undefined`.

## Phased milestones

Five phases, each ending in something you can see working. Data starts flowing in phase 1, so the longer it runs before the switch-over, the more history you have when you cancel SA.

**Phase 0: Skeleton deployed**

- [x] Project created with `npx create-next-app@latest` (TypeScript, Tailwind, ESLint, App Router, `src/`)
- [x] Convex and Clerk installed and wired exactly as in the Setup section; Convex AI files installed
- [x] `convex/schema.ts` added in full (all four tables) so later phases do not need migrations
- [x] Vitest set up; `.env.example` lists every variable
- [x] **(you)** Vercel project imported with the Convex build command and env vars; Clerk set to Invite-only
- [x] Done when: you can sign in locally and on Vercel, and a test query that returns `identity.subject` shows your Clerk user id

**Phase 1: Tracking live on one site**

- [x] `sites.create` and a bare Add website form (domain + timezone, defaulting to the browser's timezone)
- [x] `public/script.js` (pageview, unique rule, SPA routes, duration beacon), kept as hand-written ES5-safe JS with no build step
- [x] `src/app/api/collect/route.ts` and the `ingest.pageview` / `ingest.duration` mutations
- [x] Unit tests for the helpers and `convex-test` tests for both mutations, including a wrong secret, an unknown site, a foreign hostname and a duplicate duration beacon
- [x] A local test page (`/test.html` in dev only) that loads the script, plus a `curl` example for `/api/collect`
- [ ] Add the snippet to mselbekk.com alongside the SA snippet (advancedortholabsf.com was used instead; mselbekk.com still to do)
- [x] Done when: real pageviews from mselbekk.com appear in the Convex dashboard's data tab with the right date, country, device and a duration

**Phase 2: Site dashboard**

- [x] `stats.summary`, `stats.timeseries`, `stats.breakdown`, `stats.live`
- [x] Stat row with deltas, range picker, daily chart with toggles
- [x] Referrals, Pages, Devices, Browsers, Countries lists with paging
- [x] Done when: `/sites/mselbekk.com` matches the second screenshot's layout (checked on advancedortholabsf.com and localhost; mselbekk.com is not tracked yet)

**Phase 3: Websites list and settings**

- [x] `sites.listWithStats` and the card grid with sparklines, filter and sort
- [x] Settings page with copyable snippet, timezone, delete
- [ ] Add the remaining seven sites and their snippets
- [ ] Done when: `/websites` matches the first screenshot

**Phase 4: Run side by side, then cancel SA**

- [ ] Leave both scripts on all eight sites for two weeks
- [ ] Compare visitors and pageviews per site; expect your numbers within roughly 10% of SA's (ad blockers and bot filtering differ)
- [ ] Remove the SA script from each site and cancel the subscription

## Open questions and risks

- **Historical data:** not imported (decided 2026-10-13). The two-week side-by-side run is the switch-over test.
- **Ad blockers:** some block third-party scripts on known analytics domains. If counts come in low against SA, serve the script and endpoint from each site's own domain with a rewrite (for Next.js sites, a `rewrites()` entry) or rename the paths.
- **Cost:** at roughly 2,100 pageviews a month across all eight sites, the free tiers of Convex (1,000,000 function calls a month), Clerk and Vercel cover it with a wide margin. The app deploys to your existing Vercel Pro account, so the Hobby plan's non-commercial limit does not apply.
- **Visitor accuracy:** referrer-based unique counting (SA's method) slightly overcounts people who come back via a new search the same day. That is the trade-off for no cookies and no IP hashing.
- **Timezone:** day boundaries follow each site's timezone, set when the site is added. Changing it later only affects new data.

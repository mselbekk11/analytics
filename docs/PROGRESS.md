# Build Progress

Last updated: 2026-10-28 (5g live). Read this together with [PLAN.md](PLAN.md) (Phases 0 to 4) and [PHASE5.md](PHASE5.md) (Phases 5 and 6, which replace PLAN.md's scope rule). This file records what has been built, the decisions taken along the way (some differ from PLAN.md), and how the environments are set up.

## Status

| Phase | State |
| --- | --- |
| 0: Skeleton deployed | Done. Signed in on Vercel, and `me.whoami` returned the Clerk user id from Convex production. |
| 1: Tracking live on one site | Done. Real pageviews from advancedortholabsf.com reached Convex production with the right date, country, device, unique flag and duration. |
| 2: Site dashboard | Done. `/sites/[domain]` approved by the owner: SA's layout with the original dark look (see Decisions). |
| 3: Websites list and settings | **Built, awaiting owner review.** `/websites`, settings and the `/` redirect work locally against Convex dev. Still to do by the owner: add the snippet to the other seven sites. |
| 4: Side-by-side run, cancel SA | Not started. The snippet runs next to SA on advancedortholabsf.com since 2026-10-14. |
| 5a: Visitors and sessions | **Live in production since 2026-10-27** (commit `73aa709`, Vercel deploy succeeded, `/script.js` serves the cookie version). Awaiting the owner's phone check from "Done when". |
| 5b: Sources, channels and campaigns | **Live in production since 2026-10-27** (commit `2827448`; `/script.js` sends campaign tags). Backfill run on production: all 8 sessions classified (7 Direct, 1 Google), 316 visitors on old days. Awaiting the owner's "Done when" check on production. |
| 5c: OS, region and city | **Live in production since 2026-10-27** (commit `e672a1a`, Vercel deploy succeeded). No backfill (nothing to recover). Awaiting the owner's "Done when" check on production. |
| 5d: Goals, outbound clicks and identify | **Live in production since 2026-10-27** (commit `8b67da8`; `/script.js` serves the minified build, 1.95 KB gzipped; `ingest.event` and `stats.goals` on Convex prod). Awaiting the owner's "Done when" check on production. |
| 5e: Revenue | **Live in production since 2026-10-27** (commit `ff97cba`, Vercel deploy succeeded; `/script.js` sends the claim, `/api/payments` answers 401 without a key, `payments.*` and the `/stripe/` route are on Convex prod). Every site is still set to None, so nothing changes on the dashboards until one is switched to Stripe or API. Awaiting the owner's "Done when" check (a Stripe test-mode payment). |
| 5f: Customer journeys and visitor profiles | **Live in production since 2026-10-28** (commit `28f1b96`, Vercel deploy succeeded; `visitors.customers` and `visitors.profile` are on Convex prod). No schema change or backfill. Awaiting the owner's "Done when" check (needs 5e's Stripe test payment). |
| 5g: Click to filter | **Live in production since 2026-10-28** (commit `321236c`, Vercel deploy succeeded; `stats.filtered` is on Convex prod). No schema change or backfill. Awaiting the owner's "Done when" check. |
| 5h, 6 | Not started. |

Work one phase at a time and stop after each one for the owner to review (PLAN.md, "Instructions for Claude Code").

## Environments

| Thing | Value |
| --- | --- |
| GitHub | `mselbekk11/analytics`, branch `main`. Each push deploys Convex and Next.js together. |
| Live app | https://analytics-jet-zeta.vercel.app (Vercel project `analytics`, Pro team) |
| Convex project | `analytics` (team `mselbekk11`) |
| Convex dev | `precise-donkey-389`, used by `npx convex dev` and `.env.local` |
| Convex prod | `strong-robin-642`, deployed by Vercel's build command |
| Clerk | Development instance, issuer `https://settling-starling-6439.clerk.accounts.dev`, Invite-only, one user (the owner) |
| Tracked sites | Prod: `advancedortholabsf.com` (America/Los_Angeles). Dev: `localhost`, for `/test.html`. |

Vercel build command: `npx convex deploy --cmd 'npm run build'`.

### Environment variables (names only)

| Name | Where |
| --- | --- |
| `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL` | `.env.local` (written by `npx convex dev`); set by `convex deploy` on Vercel |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | `.env.local`, Vercel |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` | `.env.local`, Vercel |
| `CLERK_JWT_ISSUER_DOMAIN` | Convex dev and prod env (both use the Clerk dev issuer for now) |
| `INGEST_SECRET` | `.env.local` + Convex dev (one value); Vercel Production + Convex prod (a different value) |
| `CONVEX_DEPLOY_KEY` | Vercel only (production deploy key) |
| `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL` | Set by Vercel automatically; used to build embed snippets |

`.env.example` lists them all.

## What exists

```text
convex/
  schema.ts          PLAN.md's four tables, plus visitors and sessions (5a), events (5d), and payments,
                     checkouts and siteSecrets (5e)
  auth.config.ts     Clerk issuer from CLERK_JWT_ISSUER_DOMAIN, applicationID "convex"
  me.ts              whoami test query (Phase 0 check)
  sites.ts           sites.create (normalises the domain, rejects duplicates, validates the timezone),
                     sites.get (null if missing or not yours), sites.list (feeds the site switcher),
                     sites.listWithStats (30 zero-filled days per site), sites.update (timezone),
                     sites.goalNames + sites.setKeyGoal (5d), sites.revenueSettings, setRevenue,
                     setStripeSecret, createApiKey (action) + internal storeApiKeyHash (5e),
                     sites.remove + internal deleteSiteData (batched, self-rescheduling)
  visitors.ts        visitors.customers (paying or key-goal visitors), visitors.profile (journey timeline) (5f)
  stats.ts           stats.summary, stats.timeseries, stats.breakdown, stats.goals, stats.conversions, stats.live,
                     stats.online, stats.filtered (5g) (all behind requireSite)
  ingest.ts          ingest.pageview / ingest.ping / ingest.event / ingest.duration (legacy) (public, guarded by INGEST_SECRET),
                     internal ingest.retryEvent
  payments.ts        payments.recordApi (public, INGEST_SECRET + key hash), internal recordStripe and stripeSecret
  http.ts            Stripe webhook POST /stripe/{siteId} (Convex HTTP action, Stripe SDK signature check)
  migrations.ts      backfillSources (5b, run once per deployment) + backfillSite batches
  lib/auth.ts        requireOwnerId(ctx) -> identity.tokenIdentifier; requireSite / findOwnedSite(ctx, domain)
  lib/ranges.ts      date-range maths on "YYYY-MM-DD": presets, previous/next range, ?range= parsing (shared with the page)
  lib/dates.ts       localDate(ts, tz), isValidTimeZone
  lib/domain.ts      normalizeDomain, hostMatchesDomain (shared with the collect route)
  lib/rollups.ts     bumpDailyStats, bumpDailyDim, bumpSessionDim, bumpEventDim upserts
  lib/dims.ts        dimValidator (every dailyDims dim), dimMetric (which count a list ranks by), rankEntries
  lib/filters.ts     click-to-filter: Filter validator, ?f= parse/format, toggleFilter (shared with the page)
  lib/filtered.ts    the filtered view: one bounded read of sessions, pageviews, events, payments (5g)
  lib/statsShapes.ts return validators of the stats queries, shared by the rollup and filtered views
  lib/sources.ts     source/channel classifier (adapted from minilytics, MIT), sourceDomain for favicons
  lib/attribution.ts campaign validator, countSession / countCookielessVisit (session dims)
  lib/geo.ts         regionKey / cityKey ("US/CA", "US/CA/San Francisco") and parseGeoKey
  lib/stripe.ts      parseStripeEvent: verified Stripe events -> payment / refund / checkout records
  lib/revenue.ts     recordPayment, the four matching rules, credited session, late linking, rollup credit
  lib/secret.ts      checkSecret (INGEST_SECRET), shared by ingest and payments
  *.test.ts          convex-test suites
src/
  proxy.ts           clerkMiddleware; everything protected except /sign-in, /sign-up, /api/collect, /script.js
  app/layout.tsx     ClerkProvider (outer) > ConvexClientProvider
  app/page.tsx       redirects to /websites (the proxy sends signed-out visitors to /sign-in first)
  app/websites/page.tsx         card grid (client Websites)
  app/sites/[domain]/page.tsx   site dashboard (Suspense > client SiteDashboard)
  app/sites/[domain]/settings/page.tsx   snippet, timezone, delete (Suspense > client SiteSettings)
  app/sites/[domain]/customers/page.tsx  customers list (Suspense > client Customers)
  app/sites/[domain]/visitors/[visitorId]/page.tsx  visitor profile (Suspense > client VisitorProfile)
  app/sign-in, sign-up   Clerk components inside <Suspense>
  app/api/collect/route.ts   ingest endpoint
  app/api/payments/route.ts  payments API (Bearer key, real status codes)
  app/test.html/route.ts     dev-only page that loads the script for the "localhost" site
  components/        ConvexClientProvider, AddWebsiteForm (+ Snippet), CopyButton, TimezoneSelect
  components/dashboard/   SiteHeader (favicon, switcher, Visitors/Settings tabs), SiteDashboard, SiteSwitcher,
                          RangePicker, StatTile, TrafficChart, Breakdowns, BreakdownList, GoalsPanel, FilterBar, useNow
  components/websites/    Websites (header, filter, sort, Add website), SiteCard (sparkline card)
  components/settings/    SiteSettings
  components/customers/   Customers (+ Source), VisitorProfile, VisitorAvatar
  lib/format.ts      number, duration, share, date, country name and flag formatting, truncateMiddle
  lib/snippet.ts     appOrigin, embedSnippet
  lib/collect.ts     parsePayload, normalizeReferrer, normalizePath, detectDevice, requestHostname, parseGeo
  lib/payments.ts    bearerKey, parsePaymentBody
  lib/names.ts       persona ("brown fox", emoji, colour) and displayName (adapted from minilytics, MIT)
  lib/*.test.ts      unit tests, including script.test.ts, which runs the minified script in a fake browser
  script/script.js   hand-written ES5 tracking script (the source; see 5d decisions)
public/script.js     minified copy, built by `npm run build:script` before dev and build; git-ignored
                     (2.05 KB gzipped after 5e; limit 3 KB)
docs/PRIVACY.md      privacy-policy text for the tracked sites (with cookies, and for data-cookieless)
```

Checks at the end of Phase 1: `npm run build`, `npx tsc --noEmit`, `npm run lint` clean, `npm test` 89 tests passing.
Checks at the end of Phase 2: the same four clean, `npm test` 128 tests passing.
Checks at the end of Phase 3: the same four clean, `npm test` 134 tests passing; add, settings and delete clicked through locally.
Checks at the end of Phase 5a: the same four clean, `npm test` 182 tests passing; curl hits through local `/api/collect` into Convex dev gave 1 visitor, 2 sessions, 1 bounce and the ping's 42 s on the session.
Checks at the end of Phase 5b: the same four clean, `npm test` 219 tests passing. On Convex dev: the backfill filled source/channel for old days and 5a sessions; a curl hit with `utm_source=test&utm_campaign=phase5b` showed under Campaigns (and as source "test", channel Referral), and one from chatgpt.com as ChatGPT under AI, both seen on the local dashboard.
Checks at the end of Phase 5c: the same four clean, `npm test` 239 tests passing. A curl hit through local `/api/collect` with Vercel's `x-vercel-ip-*` headers and an iPhone UA stored `iOS`, region `CA`, city `San Francisco` and 37.8 / -122.4 on the session, and `os`/`region`/`city` dim rows on Convex dev.
Checks at the end of Phase 5d: the same four clean, `npm test` 288 tests passing. On Convex dev: curl hits stored a goal with props, an outbound click (query string dropped) and identify (email lower-cased on the visitor, `goals: 1` on the session); on `/test.html` in Chrome, `data-goal`, `analytics("goal")`, a stub-queued goal and goals fired before their pageview landed all showed in the Goals panel and Outbound links list.
Checks at the end of Phase 5f: the same four clean, `npm test` 354 tests passing. On Convex dev in Chrome: `/sites/localhost/customers` listed the 5e test visitor (dev@example.com, first source Direct, credited source test, $64.00, 1h 7m to convert); clicking it opened the profile with both sessions, the second marked "credited $64.00" with campaign phase5e, and the two payments linked by checkout metadata and return page. No console errors.
Checks at the end of Phase 5g: the same four clean, `npm test` 366 tests passing. On Convex dev in Chrome (`/sites/localhost?range=7d`): clicking AI under Channels set `?f=channel:AI` and changed every tile (9 → 1 visitor, $64 → $0), the chart and every list; removing the chip brought back the rollup view. Referral showed the $64 credited to it; adding `/landing` from Pages combined the two (`f=channel:Referral,page:/landing`). A 150-day range with a filter showed the 90-day notice. No console errors.
Checks at the end of Phase 5e: the same four clean, `npm test` 337 tests passing. On Convex dev, for the `localhost` site: Settings → Revenue set to Stripe in Chrome, a throwaway signing secret saved; a visit to `/test.html?utm_source=test&utm_campaign=phase5e`; then events signed with the Stripe SDK posted to the dev webhook URL. A payment with that visitor's `va_vid` in metadata was stored with `matchedBy: metadata` (its retry counted once, a bad signature got 400); a second without metadata was Unattributed until `/test.html?session_id=cs_test_localclaim0001` sent the claim, which moved it to `return_page`. The dashboard showed revenue $64.00, conversion rate, revenue per visitor, the bars and $64 on Referral / test / phase5e.

## Decisions and differences from PLAN.md

- **Owner id is `identity.tokenIdentifier`**, not `identity.subject` (Convex guideline, approved by the owner). Store and compare `tokenIdentifier` in `requireSite` for Phase 2. Moving to a Clerk production instance changes the issuer part, so `sites.ownerId` will need a one-off update then.
- **No `users` table.** Clerk is the user list. The owner chose to keep the plan as written.
- **`ua-parser-js` is pinned to v1 (MIT)**, with `@types/ua-parser-js`. v2 is AGPL-3.0; do not upgrade.
- **The script sends only the referrer's hostname**, never the full URL, so query strings and search terms stay in the browser.
- **The script skips localhost** unless `data-site` is literally `localhost`, which is what makes `/test.html` work against a dev site called `localhost`.
- **`ingest.pageview` ignores a repeated `pvId`**, so a retried beacon is not counted twice.
- **The duration beacon is sent once per pageview** (as the plan says), so time after a hidden tab comes back is lost and time on page reads a little low. Replaced by pings in 5a (see below).
- **Country is `"Unknown"`** when Vercel gives none, e.g. in local dev. The plan's schema comment said `"??"`, but its ingest section says "Unknown".
- **Embed snippets use `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL`**, falling back to `window.location.origin` locally. Deployment-specific `*.vercel.app` URLs sit behind Vercel's login and broke the first install.
- **`INGEST_SECRET` is read with `process.env`**, not Convex's typed `env` from `defineApp`, because that API is marked beta and unstable.
- **`@types/node` is ^22**, because Vitest 5 needs it.
- **Phase 2 adds `sites.get` and `sites.list`.** The page needs the site's timezone to work out "today" (queries cannot read the clock), and the header's site switcher needs the domain list. `sites.listWithStats` is still Phase 3.
- **Stats queries take `from`/`to` dates**, not `?range=30d`. The page turns the URL into dates with `parseRangeParam` in the site's timezone; the server validates them (at most 365 days) and works out the previous range itself.
- **`?range=` is `7d`, `30d`, `90d` or `YYYY-MM-DD_YYYY-MM-DD`.** Presets include today. The arrows step by the range's length; a step that lands back on a preset ending today shows as the preset again.
- **"Live pageviews" counts the last 5 minutes**, with `since` snapped to 30-second steps so the subscription only changes every 30 s.
- **Referrals, Devices, Browsers and Countries leave out keys with zero visitors** (only repeat pageviews), because they count unique visits. Pages counts pageviews and keeps them.
- **Country names and flags come from `Intl.DisplayNames` and emoji**, so no country list or flag package. Browser and device icons are from `react-icons`.
- **Layout from Simple Analytics, look from the original dark theme** (owner's choice, 2026-10-14). The arrangement follows `public/SA-website.png` and `public/SA-websites.png` (local only, deliberately not committed: anything in `public/` is served by the live site, and they show the owner's browser): header band with favicon and a large domain switcher, a stat row of lowercase labels over large numbers with % badges, the dates over a large "‹ 30d ›" that opens a preset/custom menu, the chart with its toggles bottom right, then four list columns. Referrals and Pages show a blue count then the label; Devices, Browsers and Countries show an icon or flag and a bar holding the percentage (one decimal under 1%). The look is near-black zinc with Geist, bordered cards for the chart and lists, and smooth (monotone) blue and pink gradient areas with both series on. Colours are theme tokens in `globals.css` (`panel`, `line`, `muted`, `strong`, `accent`, `bar`, `up`, `down`); use the same for `/websites` in Phase 3.
- **The header shows the site's own `/favicon.ico`**, loaded straight from the site, with the first letter as a fallback.
- **Time-on-page % change** compares the two averages; it shows "–" when either period has no duration beacons.
- **`sites.listWithStats` takes `now`** from the page (snapped to the minute) and works out each site's 30-day window in that site's own timezone, today included.
- **`/websites` sorts by pageviews by default**; the "sort by" link toggles to name. Filter and sort are plain component state, not in the URL. The 30-day total is shown in the accent blue (SA uses red), matching the dashboard's counts.
- **Cards:** the whole card opens the dashboard, the gear (top right) opens settings. Long domains are shortened in the middle, as SA does. Sparklines use the dashboard's blue/pink series.
- **Settings is a tab in the site header** (Visitors | Settings | All sites), and the site switcher stays on the same tab. "All sites" now goes to `/websites`.
- **Deleting a site** needs the domain typed to confirm (no browser `confirm()`). The `sites` row is deleted at once, so ingest and the dashboard stop seeing it; `deleteSiteData` then removes pageviews, dailyDims and dailyStats 1,000 rows per table per run and reschedules itself until done. Re-adding the same domain later starts fresh.
- **Changing the timezone** affects only new hits; stored days keep their dates (as PLAN.md says).
- **Removed the Phase 0/1 placeholders** (`WhoAmI`, `SiteLinks`, the old home page). `convex/me.ts` (`me.whoami`) is still deployed and tested but no longer used by the UI.

### Phase 5a (visitors and sessions)

- **How ids flow:** `script.js` reads `_va_vid` (400 days) and `_va_sid` (30 minutes, sliding) on every send, creates any that are missing, writes both back on the root domain (found by probing parent domains with a test cookie; `data-cookie-domain` overrides) and adds `vid` and `sid` to every payload. `ingest.pageview` then upserts the session and visitor; pings carry the ids only to slide the cookies, and the server uses the pageview's own `sessionId`.
- **`trackingStartedAt` is per site:** set by the first pageview that carries ids, not a global launch date. Its local day is the "visitor tracking on" chart marker and the cut-over for the Visitors tile. Sites added later get it from their first hit.
- **Visitors tile:** SA-style `dailyStats.visitors` for days before that day, plus distinct `visitorId`s from `sessions` on and after it (read through `by_site_started` with a widened window, then filtered on the stored `date`). Over 10,000 sessions it falls back to the sum of daily visitors and shows "≈".
- **"–" instead of a % change** on visitors, sessions, bounce rate and session time while the previous range starts before that day. Pageviews and time on page keep their changes (definitions unchanged).
- **Daily visitors and the lists use one rule:** with ids, a hit counts as a visitor when it is the visitor's first pageview of that local day (`visitors.lastSeenDate`). This feeds `dailyStats.visitors` (the chart) and the `visitors` column of the existing dims, so list percentages match. Cookieless and old-script hits still use the script's `unique` flag.
- **Session-level counters go on the session's start day:** `sessions`, `bounces` (+1 at start, −1 on the second pageview) and `sessionEngagedMs`. Pageview counters and time on page stay on the pageview's own day.
- **"Online now" reads `sessions` through a new index `by_site_lastSeenAt`**, not `visitors.lastSeen`. Pings move `sessions.lastSeenAt`, so someone reading one page stays online, while visitor rows only change on pageviews (Convex's guidance: keep heartbeats off profile documents). Cookieless sites (no `trackingStartedAt`) keep "live pageviews", and the session tiles are hidden for them.
- **Pings:** every 60 s while visible, on hidden, on `pagehide` and before an SPA route change, only when there is visible time to send; at most 30 per pageview. The script caps a ping at 70 s and the parser rejects more; `ingest.ping` caps again and stops at 30 minutes per pageview. Time on page counts each pageview once, on its first ping.
- **Cookieless mode:** `data-cookieless` on the snippet sends `nc: 1` and no ids. If a browser refuses cookies, the script sends the same cookieless hit rather than a new visitor on every page.
- **Old cached scripts:** hits with neither ids nor `nc` are stored the old way until 7 days after the site's `trackingStartedAt`, then dropped. `ingest.duration` stays for their `dur` beacons; both can be removed once 5a has been live for a week.
- **Deferred to their sub-phase:** `sessions.source`/`channel` are optional for now (5b fills them and backfills 5a sessions from `referrer`); `sites.currency` and the revenue fields on `dailyStats` come with 5e; the new `dailyDims` fields and `dim` values come with 5b to 5d. Entry and exit are kept on the session (`entryPath`, `exitPath`) but not yet as dims.
- **`deleteSiteData`** now also deletes `sessions` and `visitors`.
- **Settings copy** no longer says the snippet sets no cookies; it names the two cookies and `data-cookieless`.

### Phase 5b (sources, channels and campaigns)

- **Tags beat the referrer.** Precedence is `utm_source`, then `ref` (or `via`), then the referrer host, as PHASE5.md says. minilytics lets a known referrer win over an unknown tag; we don't (`?ref=launch` from Google is "launch").
- **Source names:** known sources use their name ("Google", "ChatGPT", "X"); unknown referrers are their hostname; unknown tags are the tag as sent (case kept); no referrer and no tags is "Direct". Channels: Direct, Organic Search, Organic Social, AI, Referral, Email, Paid.
- **Script:** the first pageview of a page load sends `c: { utm_source, …, ref, via }` with only those parameters present, each cut to 100 characters. The parser accepts only those keys (`via` maps to `refTag`, `ref` wins if both). `MAX_BODY_BYTES` went from 2 KB to 4 KB for room.
- **Session dims** (`source`, `channel`, `utm_*`, `ref`, `entry`, `exit`) count `sessions` and `visitors` on the session's start day; their `pageviews` stays 0. A visitor counts once per key and day (checked against the visitor's earlier sessions that day), so lists of sources show visitors. Entry and Exit count sessions. Each pageview moves the session's exit row from the old path to the new one.
- **Cookieless and old-script hits** count a visitor on source/channel/tag dims when `unique`, with no sessions and no entry/exit.
- **Lists rank by `dimMetric`:** pageviews for Pages, sessions for Entry/Exit, visitors for everything else; keys with 0 of that are left out. `stats.breakdown` now also returns `sessions` and `totalSessions`.
- **Dashboard:** the first column has tabs Channels | Sources | Campaigns | Referrers (Referrers is the old Referrals list). Campaigns has a small select for campaign, source, medium, term, content and ref/via. Pages has Pages | Entry | Exit. Sources show the source's own `/favicon.ico` (a globe for tags), like the header does. Tab choice is component state, kept across range changes.
- **`sites.sourcesStartedAt`** is set by the first pageview the 5b code handles; it is the backfill's cut-off. `sites.sourcesBackfilled` stops the backfill running twice.
- **Backfill** (`npx convex run migrations:backfillSources [--prod]`): days before visitor tracking come from the `referrer` dim rows (visitors per referrer → source and channel); 5a sessions get `source`/`channel` and are counted exactly as ingest counts new sessions (entry and exit included), and their visitors get `firstSource`; unique hits without ids between the tracking day and the cut-off are counted as ingest now does. A test replays the same traffic both ways and gets identical rows. `utm_*` and `ref` can't be recovered for old data.
- **Hydration warning on the dashboard** comes from Clerk's `UserButton` in the header (was there before 5b), not from the lists.

### Phase 5c (OS, region and city)

- **OS, region and city are pageview dims**, like device, browser and country: they count pageviews and visitors (with ids, a visitor's first pageview of the day), not sessions. The OS tab sits next to Devices and the Regions/Cities tabs next to Countries, which all show each key's share of visitors, so they use the same rule. PHASE5.md also lists country, device, browser and OS among the session dims; that is left out until something (5e's revenue by country, say) needs a per-session count.
- **Region is Vercel's `countryRegion`** (ISO 3166-2 code such as `CA`), not `geolocation().region`, which is Vercel's data-centre region (`iad1`). Codes are kept as sent; the dashboard names US states and shows other codes as "BE, Germany". No subdivision name table beyond the US.
- **Keys:** region `US/CA`, city `US/CA/San Francisco` (empty region part when Vercel gives a city but no region, e.g. `SG//Singapore`). A missing region or city counts under `Unknown`, as country does. Built and parsed in `convex/lib/geo.ts`.
- **OS is ua-parser's `os.name`** without the version ("Mac OS", "iOS", "Windows", "Android", "Chromium OS"); `Unknown` when it has none.
- **Raw rows:** `sessions` get `os`, `region`, `city`, `lat`, `lon` at session start. `parseGeo` in the route rounds the coordinates to one decimal and drops a pair with one half missing or out of range. `pageviews` don't get the new fields (not in PHASE5.md), so cookieless hits count in the lists but no location is stored for them.
- **No backfill:** old pageviews stored no user agent, region or city, so the new lists start on the day 5c is deployed.
- **Script unchanged.**

### Phase 5d (goals, outbound clicks and identify)

- **The script is now minified for serving.** The source moved to `src/script/script.js` (still hand-written ES5). `npm run build:script` (esbuild, `--target=es5`, which also fails on non-ES5 syntax) writes `public/script.js`, and runs automatically as `predev` and `prebuild`, so Vercel builds it too. `public/script.js` is git-ignored. Reason: with 5d the raw file was 3.13 KB gzipped (3.11 KB even without comments), over the 3 KB limit, and 5e still has to add `attribution()` and the claim. Minified it is 1.95 KB. `script.test.ts` runs the minified output and checks the size.
- **API:** `window.analytics("goal", name, props?)`, `window.analytics("identify", { id?, email?, name? })`, and `data-goal="name"` on any element (a click on it or inside it). Calls made before the script loads are queued by a one-line stub (shown in Settings) and replayed right after the first pageview. If `window.analytics` is already an object (Segment uses that name), the script leaves it alone and the API is unavailable on that site.
- **Outbound links:** a capture-phase `click` and `auxclick` listener (left and middle button) sends origin + path for `<a href>` links to another hostname. Subdomains count as other hostnames. The parser rebuilds the URL and drops non-http links.
- **Events read the visitor, session and path from their pageview** (by `pvId`), so the payload never carries them. A repeat of the same goal (or link) on one pageview is dropped; at most 50 events per pageview.
- **Events can arrive before their pageview** (separate beacons, e.g. a queued goal sent right after load). `ingest.event` then schedules `ingest.retryEvent` once, 5 s later, keeping the original time. An unknown `pvId` after the retry is dropped.
- **`events.visitorId` and `sessionId` are optional** (the brief has them required): goals and outbound clicks from cookieless pageviews are stored and counted without them. `identify` on a cookieless pageview is dropped, and the script doesn't send it in cookieless mode.
- **New `dailyDims.events` field** (optional) holds completions or clicks for the `goal` and `outbound` dims; `visitors` counts each visitor once per key and day (without ids, every completion counts). `dimMetric` is `events` for both, and `stats.breakdown` returns `events` and `totalEvents`.
- **Conversion rate in the Goals panel** is goal visitors ÷ the site's visitors, both summed per day (`stats.goals`), so it is the share of daily visitors who completed the goal. It can differ slightly from goal visitors ÷ the Visitors tile, which counts distinct ids over the range.
- **Bounce:** the first goal in a session takes its bounce off (on the session's start day), as a second pageview does; outbound clicks don't. Goals and outbound clicks move `sessions.lastSeenAt` (online now).
- **Identify** writes `userId`, `email` (lower-cased, must contain `@`) and `name` onto the visitor; fields left out are kept. One `identify` event per pageview is stored for 5f's timeline, without the values.
- **Goal names** are kept as sent (trimmed, at most 100 characters, case kept). Props: up to 10 keys matching `[A-Za-z][A-Za-z0-9_-]{0,39}`, values string, number or boolean stored as strings of at most 200 characters; anything else is dropped, not the goal.
- **Key goal** (`sites.keyGoal`) is set in Settings → Goals: any name, with recorded goals offered as suggestions. The Goals panel marks it and always lists it. Its conversion-rate tile comes with 5e.
- **Settings → Goals** shows the stub and examples, a Copy button, and "Copy AI prompt" (instructions for a coding agent in the site's own codebase, including the key goal).
- **`/test.html`** (dev only) gained buttons for `data-goal`, `analytics("goal")`, `identify`, an outbound link and a queued goal.
- **`deleteSiteData`** now also deletes `events`.

### Phase 5e (revenue)

- **Stripe webhook** is a Convex HTTP action at `{CONVEX_SITE_URL}/stripe/{siteId}` (Settings shows the exact URL), verified with the Stripe SDK's `Stripe.webhooks.constructEventAsync` and `createSubtleCryptoProvider()`. The SDK runs in Convex's default runtime and in convex-test, so no `"use node"` action. Unknown site or no secret → 404, bad signature → 400, everything else 200 (unused events too, so Stripe does not retry them).
- **Events:** `checkout.session.completed` (mode `payment`, `payment_status: paid`), `checkout.session.async_payment_succeeded` (added: bank debits and other delayed methods complete there; same id, so never counted twice), `invoice.paid` (`renewal` on `subscription_cycle`; zero-amount trial invoices skipped) and `charge.refunded`. A subscription Checkout records no money, only a `checkouts` row. The parser (`lib/stripe.ts`) reads both invoice shapes: the subscription under `parent.subscription_details` (API 2025+) or the older top-level `subscription`.
- **New `checkouts` table** (not in the brief): a subscription's invoices don't carry the Checkout Session, so this row links them to its metadata `va_vid` and its return-page claim. Payments also gained `checkoutSessionId`, `subscriptionId`, `paymentIntentId` and `invoiceId` with indexes, for late linking and refunds.
- **`providerId`:** the Checkout Session id for one-off payments, the invoice id for invoices, `<charge id>#<total refunded>` for refunds. `charge.refunded` carries the running total, so each refund row is the difference from the ones already stored for that charge.
- **Matching** (in order): metadata `va_vid` (or `client_reference_id` when it is a UUID; on invoices the subscription's metadata or its Checkout's), return-page claim, an earlier linked payment of the same customer, a visitor whose `identify()` email matches (most recently seen wins). A `va_vid` that is not a known visitor falls through to the next rule. `va_sid` is not used: the credited session always follows the brief's rule (last non-Direct session before the payment, else the last one).
- **Late linking:** a claim, or a subscription Checkout, that arrives after its payment links a still-unattributed payment and moves its revenue from "Unattributed" to the session's keys. Refunds are not re-linked when their payment is linked later.
- **Refunds** go to the session their payment was credited to (found by payment intent, then invoice), else through the matching rules.
- **Rollups:** `dailyStats.revenueMinor` is net of refunds, `payments` counts payments, `refundsMinor` is positive; all on the payment's own day. The new `dailyDims.revenueMinor` is credited on the payment's day to the session's source, channel, UTM and ref tags, referrer, country, region and city. Unattributed payments go to source and channel "Unattributed". Lists keep keys that have revenue but no visitors.
- **Currency:** one per site (default USD), set in Settings. Payments in another currency are stored and linked but left out of totals, dims and the visitor's `revenueMinor`, and the dashboard says how many. Changing the currency only affects new payments.
- **Payments API:** `POST /api/payments` (Next route, as the brief says) with `Authorization: Bearer va_<48 hex>`. The route hashes the key with SHA-256 and calls `payments.recordApi` with `INGEST_SECRET`; the hash finds the site (`siteSecrets.by_apiKeyHash`). `amount` is an integer in cents, `ts` seconds or milliseconds, `refund: true` needs its own `id`. A `sessionId` without `visitorId` finds its visitor. Answers 200 (`duplicate: true` on a repeat), 400 with a message, 401, 413. The key is made in an action (mutations have no real randomness), shown once; a new key replaces the old.
- **Payments are recorded whenever a secret or key is set**; `revenueSource` only decides what the dashboard shows. Switching to None keeps the secrets.
- **Dashboard:** with revenue on, tiles Revenue (refunds and payment count in its tooltip), Conversion rate and Revenue / visitor; revenue bars on the chart on a hidden scale capped to the lower half, with a Revenue toggle; a green revenue amount at the end of the rows of Channels, Sources, Campaigns, Referrers, Countries, Regions and Cities (rounded to whole units, hidden when 0). A site set to None with a key goal gets the Conversion rate tile on that goal (5d's deferred tile).
- **Conversion rate** = distinct visitors with a payment (or the key goal) in the range ÷ the Visitors tile, read from raw `payments`/`events` by `stats.conversions` (up to 10,000 rows, else "–"). Its % change follows the visitors rule ("–" across the tracking start).
- **Script:** `analytics("attribution")` returns `{ va_vid, va_sid }` (only what is set; `{}` in cookieless mode or before the script loads, because the stub returns nothing). On load, `?session_id=cs_...` sends `{ t: "claim", cs }` with nothing else from the URL; not in cookieless mode. Claims are stored as `events` of type `claim` (name = the Checkout Session id, new index `by_site_type_name`).
- **Settings → Revenue:** None / Stripe / Payments API and the currency; for Stripe the webhook URL, the events to select, a password field for the signing secret (only "saved" is ever shown back), the checkout snippet and "Copy AI prompt"; for the API the key, a curl example and its own AI prompt.
- **`deleteSiteData`** also deletes `payments`, `checkouts` and `siteSecrets`.
- **Dev data:** the dev `localhost` site is set to Stripe with a throwaway signing secret and holds two test payments (`cs_test_devmeta0001` $49, `cs_test_localclaim0001` $15).

### Phase 5f (customer journeys and visitor profiles)

- **Customers tab** in the site header (Visitors | Customers | Settings). The current tab is now a link too, so a profile can go back to the list.
- **Who is a customer:** on a site with revenue, every visitor with `firstPaidAt` (a payment in the site's currency), read newest first through `visitors.by_site_firstPaid`. On a site without revenue, every visitor who completed the key goal, from `events.by_site_type_name` (newest 5,000 completions, each visitor at their first). A site with both shows revenue by default and a "Key goal" toggle (`?by=goal`). A site with neither gets a pointer to Settings. At most 500 customers, with "+" when there are more.
- **Columns:** name, first source (`visitors.firstSource`), credited source (the session the first payment was credited to, or the session of the first key-goal completion), total paid (lifetime, net of refunds), first payment or conversion time, and time to convert (from `firstSeen`). Unattributed payments have no visitor, so they never appear here.
- **Names:** `src/lib/names.ts`, adapted from minilytics (MIT, credited): FNV-1a hash of the visitor id → colour + animal and an emoji avatar. The identify() name wins, then the email (from identify() or a payment), then the animal name. Computed in the browser; nothing new is stored.
- **Profile** (`visitors.profile`): header with name, email/user id, total paid, location, device, first source, first and last seen and session count (location and device from the latest session). The journey shows the latest 50 sessions oldest first, each with source, channel and campaign tags, and its pageviews (with engaged time), goals (key goal marked), outbound clicks, identify, checkout returns and payments, in time order. Up to 100 pageviews per session.
- **Where a payment shows:** in the session that was open when it was made (the last one that started before it), labelled with how it was linked and which source it was credited to. The credited session gets a green "credited" badge with its revenue. Usually that is a different session from the one where the visitor paid.
- **"Clicking a visitor anywhere":** for now that is the customers list. The live feed comes in 5h and will link to the same `/sites/[domain]/visitors/[visitorId]`.
- **`SourceIcon`, `DEVICE_ICONS`, `browserIcon` and `osIcon`** are now exported from `Breakdowns.tsx` for the profile.

### Phase 5g (click to filter)

- **A filter picks sessions.** Source, channel, campaign tags, referrer, entry and exit page, device, browser, OS, country, region and city match the session's own value (the same keys the lists use); a page filter matches sessions that viewed the page, a goal or outbound filter sessions that had it. Filters on different lists combine with AND. Clicking another row of a filtered list replaces its filter; clicking the active row (outlined) removes it. At most 3 lists; with 3, rows of other lists stop being clickable.
- **What a filtered view counts:** the matching sessions on the day each started, and everything in them: visitors (distinct over the range, where the rollup lists sum per day), sessions, pageviews, bounces, session time and time on page. With a page filter, Pages lists every page those sessions viewed, not only the filtered one. Revenue is the payments credited to a matching session, on each payment's day, as in the rollups; a credited session that started before the range is read on its own (with its pageviews and events), so a ChatGPT visitor who pays a week later still counts under AI.
- **`stats.filtered`** returns summary, timeseries, every list, goals and conversions in one query, in the rollup queries' shapes (validators now in `lib/statsShapes.ts`), so the components only choose where their data comes from. It reads `sessions`, `pageviews` and `events` through their time indexes (`by_site_started`, `by_site_ts`) for the range and the previous one (for the % changes), plus `payments` on sites with revenue, and joins them in memory. Rows without a session id (cookieless and old-script hits) are not in filtered views.
- **Limits:** ranges of at most 90 days (`status: "range"`), and at most 12,000 documents read across the tables (`status: "tooMany"`); the dashboard shows a notice in place of the data for both. The busiest site reads ~7,500 for 90 days and its previous period.
- **URL:** `?f=channel:AI,page:/pricing`, kept readable; a comma or `%` inside a value is escaped as `%2C`/`%25`. A hard load may come back with `:` as `%3A` (Next/Clerk re-encode it); both parse.
- **Cookieless sites** (no `trackingStartedAt`) have no sessions, so their rows are not clickable and `?f=` is ignored. When the range starts before visitor tracking did, the dashboard says filtered numbers count from that day.
- **Online now** stays unfiltered.
- **Referrer and outbound rows** no longer link from their label (the row is a filter button); a small ↗ icon next to them opens the site.
- **Not tested at scale:** the `tooMany` path has no test (it needs 12,000 rows); the budget check is a few lines in `lib/filtered.ts`.

## Gotchas

- **Cache Components is on** (`cacheComponents: true` in `next.config.ts`). Client components that read the URL (Clerk's `<SignIn>`, for example) must sit inside `<Suspense>`, or the build fails with "usePathname() outside of Suspense". Expect the same with `useSearchParams` for the `?range=` picker in Phase 2.
- **Server components cannot import from `convex/react`.** Use `<Authenticated>` and the other hooks inside `"use client"` components only. Importing them into `page.tsx` broke the build once.
- **Gate data on Convex auth**, with `<Authenticated>` or `useConvexAuth()`, not Clerk's `useAuth()`.
- **Queries must not read the clock.** `stats.live` takes `since` from the client (refreshed every 30 s), as the plan says.
- **Run `npx convex dev` (or `npx convex codegen`) after adding Convex functions**, so `convex/_generated/api.d.ts` picks them up before `tsc`.
- **Preview deployments on Vercel fail**, because there is no Preview `CONVEX_DEPLOY_KEY`. That is expected; add a Preview deploy key if previews are ever wanted.
- **The dev `localhost` site had a mistyped `ownerId`** (one `r` short of the real Clerk id) and was invisible to the owner. Fixed on 2026-10-14 by copying the owner from the dev `advancedortholabsf.com` row. The dev copy of `advancedortholabsf.com` also holds ~70 seeded test hits from Phase 2 checks.
- **Favicons that fail before hydration** never fire React's `onError`, so `Favicon` also checks `img.complete && naturalWidth === 0` in a ref callback (fixed in Phase 3; domains without a favicon showed a broken image).
- **`npx convex codegen` does not push functions** to the dev deployment; run `npx convex dev --once` (or keep `npx convex dev` running) or the browser gets "Could not find public function".
- **If the dev page reloads itself non-stop** (stuck on "Connecting…", the dev log full of `GET` lines), stop `next dev`, delete `.next` and start it again. A stale dev cache caused this once.
- **curl hits need a browser User-Agent**, or `isbot` drops them silently (curl's default UA counts as a bot).
- **The session tiles stay hidden until a site's first hit with ids** (that hit sets `trackingStartedAt`). A site with only old-script or cookieless hits looks exactly as before 5a, so "nothing changed" right after a deploy is expected.
- **Next.js 16.4.0 has a known security vulnerability.** `npm run build` and `npm run dev` each stopped once (2026-10-27) with a "SecurityFatalError" upgrade notice and passed on retry. Not upgraded yet; see Open items.
- **Edit the script in `src/script/script.js`**, not `public/script.js` (generated and git-ignored). A running `next dev` keeps serving the old copy until you run `npm run build:script` or restart dev.
- **Clicks from the Claude in Chrome extension don't reach the page's click listeners** (0 events on a test listener), so test `data-goal` and outbound links by clicking yourself or with `element.click()` in the console.
- **Read `convex/_generated/ai/guidelines.md`** before writing Convex code, and the Next.js docs in `node_modules/next/dist/docs/` (AGENTS.md).

## How to test locally

1. `npm run dev`, then sign in at http://localhost:3000.
2. The `localhost` site already exists in dev. Open http://localhost:3000/test.html, then look in the Convex dashboard (dev) → Data → `pageviews`.
3. Or send a hit with curl:

```bash
curl -X POST http://localhost:3000/api/collect -H 'Origin: http://localhost:3000' \
  -H 'User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' \
  --data '{"t":"pv","site":"localhost","host":"localhost","path":"/","ref":"","unique":true,"pvId":"test-1","sw":390}'
```

That hit has no ids, so it is stored the old way. To test 5a, add `"vid"` and `"sid"` (two lowercase UUIDs, e.g. from `uuidgen | tr A-Z a-z`) to the body, and send pings as `{"t":"ping","site":"localhost","pvId":"<the pageview's pvId>","ms":30000}`. The dev `localhost` site holds 5a test sessions from 2026-10-26 and 2026-10-27.

Read production data with `npx convex data <table> --prod`.

## Open items for the owner

- In Vercel, check that `CONVEX_DEPLOY_KEY` is scoped to Production only.
- Before real use: create a Clerk production instance on a custom domain, swap in its keys and issuer, and update `sites.ownerId` (see the first decision above).
- Add the snippet to mselbekk.com and the other six sites (planned for Phase 3).
- Decide whether to upgrade Next.js for the security notice (`next upgrade --agent=security`, ideally in a separate worktree).
- Optional tooling updates: Vercel CLI 29.0.2 is far behind (65.x), Convex 1.48.0 is available, and `npx convex ai-files update` refreshes the Convex AI files.

## Next: check 5g on production, then 5h

Pushed to `main` on 2026-10-28 (commit `321236c`) and live. Owner:

1. "Done when" on production: filtering by `channel:AI` changes every tile, the chart and every list, and removing the chip brings back the rollup view.

Then 5h.

## Earlier: check 5f on production, then 5g

Pushed to `main` on 2026-10-28 (commit `28f1b96`) and live. Owner:

1. "Done when" on production: after the Stripe test payment from 5e's check, the customer appears under Customers, and their profile shows the journey from the `?utm_source=test` visit to the payment.

Then 5g.

## Earlier: check 5e on production, then 5f

Pushed to `main` on 2026-10-27 (commit `ff97cba`) and live. The production webhook URL for a site is `https://strong-robin-642.convex.site/stripe/<siteId>`; Settings → Revenue shows it. Owner:

1. "Done when" on production, in Stripe test mode: in a tracked site's Settings → Revenue choose Stripe, add the webhook URL in the Stripe Dashboard (test mode) with the four events, and paste its signing secret. Visit the site with `?utm_source=test`, start a Checkout Session there with `metadata: analytics("attribution")`, and pay with card 4242 4242 4242 4242. The payment shows under Sources → test, and `npx convex data payments --prod` shows `matchedBy: "metadata"`. (Or `stripe login` again and let Claude drive it with `stripe listen` against dev.)
2. Add `attribution()` to each paying site's checkout (Settings → Revenue → Copy AI prompt), and paste the updated `docs/PRIVACY.md` text (the purchases paragraph) on sites with revenue.

Then 5f.

## Earlier: check 5d on production, then 5e

Pushed to `main` on 2026-10-27 (commit `8b67da8`) and live. The dev `localhost` site holds test events (goals `phase5d-test`, `test-*`, `race-*`, `early-*`, `probe-*`, one outbound click to github.com, and an identified visitor `u_5d` / test@example.com). Owner:

1. "Done when" on production: on advancedortholabsf.com, run `analytics("goal", "test")` in the browser console and click a link to another site; both show within seconds. Then run `analytics("identify", { email: "you@example.com" })` and check the email with `npx convex data visitors --prod`.
2. Add goals to the sites (Settings → Goals → Copy AI prompt), pick each site's key goal, and paste the updated text from `docs/PRIVACY.md` (goals, outbound links, and identify where used).

Then 5e.

## Earlier: check 5c on production, then 5d

Pushed to `main` on 2026-10-27 (commit `e672a1a`) and live. The dev `localhost` site holds one test hit from San Francisco on iOS. Owner:

1. "Done when" on production: visit a tracked site yourself and check that your city shows under Countries → Cities and your OS under Devices → OS. The lists only hold hits from after the deploy.
2. Paste the updated text from `docs/PRIVACY.md` (it now mentions OS, region, city and the rough position).

Then 5d.

## Earlier: check 5b on production, then 5c

Reviewed locally, pushed and backfilled on production on 2026-10-27. Owner:

1. "Done when" on production: visit a tracked site with `?utm_source=test&utm_campaign=phase5b` (it shows under Campaigns), and click through to it from a chatgpt.com chat (it shows as ChatGPT under AI).
2. Paste the updated text from `docs/PRIVACY.md` (it now mentions campaign tags).

Then 5c.

## Earlier: check Phase 5a on production

5a was pushed to `main` on 2026-10-27 and is live. Owner:

1. Phone check ("Done when"): visit a tracked site on your phone and leave after one page, come back after 40+ minutes and do the same. `/sites/[domain]` should show 1 visitor, 2 sessions and a bounce rate of 100% for those visits. The new tiles appear only after the site's first hit from the new script (browsers may keep the old cached script for up to a day).
2. Paste the text from `docs/PRIVACY.md` into each site's privacy policy (the sites now set two cookies).
3. Seven days after a site's `trackingStartedAt` (check with `npx convex data sites --prod`), remove the old-script fallback in `ingest.pageview` and `ingest.duration`, with its `dur` payload in `src/lib/collect.ts`.

Then 5b.

## Earlier: finish Phase 3, then Phase 4

Owner: review `/websites` and the settings page against `public/SA-websites.png`, then add each remaining site under Add website (production) and paste its snippet (Settings → Embed snippet) into mselbekk.com and the other six sites, next to the SA snippet. Phase 4 is then the two-week side-by-side run.

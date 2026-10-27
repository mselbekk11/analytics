# Build Progress

Last updated: 2026-10-27. Read this together with [PLAN.md](PLAN.md) (Phases 0 to 4) and [PHASE5.md](PHASE5.md) (Phases 5 and 6, which replace PLAN.md's scope rule). This file records what has been built, the decisions taken along the way (some differ from PLAN.md), and how the environments are set up.

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
| 5c: OS, region and city | **Built, awaiting owner review** (local, against Convex dev). Not pushed yet. |
| 5d to 5h, 6 | Not started. |

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
  schema.ts          PLAN.md's four tables, plus visitors and sessions (5a) with PHASE5.md's fields
  auth.config.ts     Clerk issuer from CLERK_JWT_ISSUER_DOMAIN, applicationID "convex"
  me.ts              whoami test query (Phase 0 check)
  sites.ts           sites.create (normalises the domain, rejects duplicates, validates the timezone),
                     sites.get (null if missing or not yours), sites.list (feeds the site switcher),
                     sites.listWithStats (30 zero-filled days per site), sites.update (timezone),
                     sites.remove + internal deleteSiteData (batched, self-rescheduling)
  stats.ts           stats.summary, stats.timeseries, stats.breakdown, stats.live, stats.online (all behind requireSite)
  ingest.ts          ingest.pageview / ingest.ping / ingest.duration (legacy) (public, guarded by INGEST_SECRET)
  migrations.ts      backfillSources (5b, run once per deployment) + backfillSite batches
  lib/auth.ts        requireOwnerId(ctx) -> identity.tokenIdentifier; requireSite / findOwnedSite(ctx, domain)
  lib/ranges.ts      date-range maths on "YYYY-MM-DD": presets, previous/next range, ?range= parsing (shared with the page)
  lib/dates.ts       localDate(ts, tz), isValidTimeZone
  lib/domain.ts      normalizeDomain, hostMatchesDomain (shared with the collect route)
  lib/rollups.ts     bumpDailyStats, bumpDailyDim, bumpSessionDim upserts
  lib/dims.ts        dimValidator (every dailyDims dim) and dimMetric (which count a list ranks by)
  lib/sources.ts     source/channel classifier (adapted from minilytics, MIT), sourceDomain for favicons
  lib/attribution.ts campaign validator, countSession / countCookielessVisit (session dims)
  lib/geo.ts         regionKey / cityKey ("US/CA", "US/CA/San Francisco") and parseGeoKey
  *.test.ts          convex-test suites
src/
  proxy.ts           clerkMiddleware; everything protected except /sign-in, /sign-up, /api/collect, /script.js
  app/layout.tsx     ClerkProvider (outer) > ConvexClientProvider
  app/page.tsx       redirects to /websites (the proxy sends signed-out visitors to /sign-in first)
  app/websites/page.tsx         card grid (client Websites)
  app/sites/[domain]/page.tsx   site dashboard (Suspense > client SiteDashboard)
  app/sites/[domain]/settings/page.tsx   snippet, timezone, delete (Suspense > client SiteSettings)
  app/sign-in, sign-up   Clerk components inside <Suspense>
  app/api/collect/route.ts   ingest endpoint
  app/test.html/route.ts     dev-only page that loads the script for the "localhost" site
  components/        ConvexClientProvider, AddWebsiteForm (+ Snippet), CopyButton, TimezoneSelect
  components/dashboard/   SiteHeader (favicon, switcher, Visitors/Settings tabs), SiteDashboard, SiteSwitcher,
                          RangePicker, StatTile, TrafficChart, Breakdowns, BreakdownList, useNow
  components/websites/    Websites (header, filter, sort, Add website), SiteCard (sparkline card)
  components/settings/    SiteSettings
  lib/format.ts      number, duration, share, date, country name and flag formatting, truncateMiddle
  lib/snippet.ts     appOrigin, embedSnippet
  lib/collect.ts     parsePayload, normalizeReferrer, normalizePath, detectDevice, requestHostname, parseGeo
  lib/*.test.ts      unit tests, including script.test.ts, which runs public/script.js in a fake browser
public/script.js     hand-written ES5 tracking script (2.59 KB gzipped after 5b; limit 3 KB)
docs/PRIVACY.md      privacy-policy text for the tracked sites (with cookies, and for data-cookieless)
```

Checks at the end of Phase 1: `npm run build`, `npx tsc --noEmit`, `npm run lint` clean, `npm test` 89 tests passing.
Checks at the end of Phase 2: the same four clean, `npm test` 128 tests passing.
Checks at the end of Phase 3: the same four clean, `npm test` 134 tests passing; add, settings and delete clicked through locally.
Checks at the end of Phase 5a: the same four clean, `npm test` 182 tests passing; curl hits through local `/api/collect` into Convex dev gave 1 visitor, 2 sessions, 1 bounce and the ping's 42 s on the session.
Checks at the end of Phase 5c: the same four clean, `npm test` 239 tests passing. A curl hit through local `/api/collect` with Vercel's `x-vercel-ip-*` headers and an iPhone UA stored `iOS`, region `CA`, city `San Francisco` and 37.8 / -122.4 on the session, and `os`/`region`/`city` dim rows on Convex dev.
Checks at the end of Phase 5b: the same four clean, `npm test` 219 tests passing. On Convex dev: the backfill filled source/channel for old days and 5a sessions; a curl hit with `utm_source=test&utm_campaign=phase5b` showed under Campaigns (and as source "test", channel Referral), and one from chatgpt.com as ChatGPT under AI, both seen on the local dashboard.

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

## Next: review 5c, push, then 5d

5c is built and checked locally. Owner:

1. Review the dashboard locally (`npm run dev`): Devices has a Devices | OS tab, Countries has Countries | Regions | Cities. The dev `localhost` site has one test hit from San Francisco on iOS (2026-10-27).
2. Push to `main` (deploys Convex and Next.js together), then "Done when" on production: visit a tracked site yourself and check that your city shows under Cities and your OS under OS.
3. Paste the updated text from `docs/PRIVACY.md` (it now mentions OS, region, city and the rough position).

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

# Build Progress

Last updated: 2026-10-29 (design v3, Phase 1 built). Design v3 is planned in [plans/dashboard-design-v3-plan.md](../plans/dashboard-design-v3-plan.md) (PRD: `plans/dashboard-design-v3.md`, owner's brief `plans/dashboard-design-v3-brief.md`, screenshots in `public/design-v3/`). Design v2 is planned in [plans/dashboard-design-v2-plan.md](../plans/dashboard-design-v2-plan.md) (PRD: `plans/dashboard-design-v2.md`). Read this together with [PLAN.md](PLAN.md) (Phases 0 to 4) and [PHASE5.md](PHASE5.md) (Phases 5 and 6, which replace PLAN.md's scope rule). This file records what has been built, the decisions taken along the way (some differ from PLAN.md), and how the environments are set up.

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
| 5h: Live map | **Live in production since 2026-10-28** (commit `a1b7c72`, Vercel deploy succeeded; `/maplibre-gl-worker.js` is served and `stats.liveFeed` is on Convex prod). No schema change or backfill. Awaiting the owner's "Done when" check. |
| 6 | Not started. |
| Design v2, Phase 1: shadcn foundation and theme | **Pushed, awaiting owner review.** shadcn/ui, light and dark tokens, next-themes with a temporary toggle, theme-aware live map. |
| Design v2, Phase 2: sticky top bar | **Pushed, awaiting owner review.** One sticky `TopBar` on every signed-in page: logo, site switcher menu, "N online", theme toggle, user button, and Analytics / Live / Customers / Settings tabs. |
| Design v2, Phase 3: page header and day ranges | **Pushed, awaiting owner review.** "Analytics" header with the range in words, Today \| 24h \| 7d \| 30d, a menu with every preset and a two-month Custom range calendar, a disabled Filter button, filter chips as badges. Default range is now 7d. |
| Design v2, Phase 4: joined stat tiles | **Pushed, awaiting owner review.** One bordered block of tiles on top of the chart: Visitors, Pageviews, Revenue, Conv. rate, the key goal, Bounce rate, Visit duration, each hidden where it doesn't apply. Sessions, time on page, refunds, payments and revenue per visitor moved into tooltips; the online tile is gone (the top bar has it). |
| Design v2, Phase 5: monochrome chart driven by the tiles | **Pushed, awaiting owner review.** shadcn Chart: Visitors and Pageviews areas, Revenue and key-goal bars, dashed Conv. rate, Bounce rate and Visit duration lines, each extra series on its own hidden scale. The tiles are toggles, remembered per browser. The timeseries gained the key goal and per-day rates. |
| Design v2, Phase 6: card grid and rows | **Pushed, awaiting owner review.** One bordered block of four cards in two columns: Sources, Pages (with Outbound), Countries, Devices. Text tabs with a More ▾ menu, the metric on the right, bar rows with the number on the right, 7 rows then "View all N →". |
| Design v2, Phase 7: AI tab and Revenue ⇅ | **Pushed, awaiting owner review.** Sources has an AI tab (only sources the classifier puts in AI, server-side in the rollup and filtered paths). On revenue sites the Sources and Countries headers read "Visitors ⇅" and switch to "Revenue ⇅". |
| Design v2, Phase 8: Events and Funnels cards | **Pushed, awaiting owner review.** The grid's bottom row: Events (goals by completions, a "Key goal" badge, a tooltip with completions, visitors and conversion, click to filter) and a "Funnels are coming soon" placeholder. The old Goals panel is gone. |
| Design v2, Phase 9: Map tab | **Pushed, awaiting owner review.** The Countries card has a Map tab: a monochrome SVG world map (110m outlines, loaded when the tab opens) shaded by visitors, or revenue on "Revenue ⇅", with a hover tooltip and click to filter. |
| Design v2, Phase 10: hourly ranges | **Pushed, awaiting owner review.** Today, Yesterday and Last 24 hours work: `stats.hourly` reads the raw rows of the window and the one before it and returns the standard shapes, one chart point per hour in the site's timezone, with filters. Cookieless pageviews count toward pageviews and the pageview lists. |
| Design v3, Phase 1: public homepage and sign-out landing | **Built, awaiting owner review.** `/` is a public, static splash page (logo and "Analytics", Log in top right; headline, one line and a Log in button in the centre). Signed-in visitors are redirected from `/` to `/websites` by the proxy. Clerk signs out to `/` and falls back to `/websites` after sign-in. |

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
                     stats.online, stats.filtered (5g), stats.liveFeed (5h) (all behind requireSite)
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
  proxy.ts           clerkMiddleware; everything protected except /, /sign-in, /sign-up, /api/collect, /api/payments, /script.js; signed-in visitors on / go to /websites
  app/layout.tsx     ThemeProvider (outer) > ClerkProvider (afterSignOutUrl /, sign-in fallback /websites) > ConvexClientProvider
  app/page.tsx       public splash page (static server component, no Convex); LogoMark is shared with TopBar
  app/websites/page.tsx         card grid (Suspense > client Websites; ?add=1 opens the add form)
  app/sites/[domain]/page.tsx   site dashboard (Suspense > client SiteDashboard)
  app/sites/[domain]/settings/page.tsx   snippet, timezone, delete (Suspense > client SiteSettings)
  app/sites/[domain]/customers/page.tsx  customers list (Suspense > client Customers)
  app/sites/[domain]/visitors/[visitorId]/page.tsx  visitor profile (Suspense > client VisitorProfile)
  app/sites/[domain]/live/page.tsx       live map and feed (Suspense > client Live)
  app/sign-in, sign-up   Clerk components inside <Suspense>
  app/api/collect/route.ts   ingest endpoint
  app/api/payments/route.ts  payments API (Bearer key, real status codes)
  app/test.html/route.ts     dev-only page that loads the script for the "localhost" site
  components/        ConvexClientProvider, ThemeProvider (next-themes), ThemeToggle, AddWebsiteForm (+ Snippet),
                     CopyButton, TimezoneSelect, TopBar (sticky bar + tabs, sitePath, SiteSection),
                     SiteSwitcher (shadcn Dropdown Menu), SiteFavicon
  components/ui/     shadcn/ui components, added with `npx shadcn@latest add` (components.json: base-nova,
                     Base UI, neutral, lucide)
  lib/utils.ts       shadcn's cn()
  components/dashboard/   SiteDashboard, RangePicker, StatRow, StatTile, TrafficChart, series, Breakdowns, StatsCard, FilterBar, RangeControls, useNow
  components/websites/    Websites (page header, Add website), SiteCard (monochrome sparkline card)
  components/settings/    SiteSettings
  components/customers/   Customers (+ Source), VisitorProfile, VisitorAvatar
  components/live/        Live (online count + feed), LiveMap (MapLibre, one dot per visitor)
  lib/format.ts      number, duration, share, date, country name and flag formatting, truncateMiddle
  lib/snippet.ts     appOrigin, embedSnippet
  lib/collect.ts     parsePayload, normalizeReferrer, normalizePath, detectDevice, requestHostname, parseGeo
  lib/payments.ts    bearerKey, parsePaymentBody
  lib/names.ts       persona ("brown fox", emoji, colour) and displayName (adapted from minilytics, MIT)
  lib/*.test.ts      unit tests, including script.test.ts, which runs the minified script in a fake browser
  script/script.js   hand-written ES5 tracking script (the source; see 5d decisions)
public/script.js     minified copy, built by `npm run build:script` before dev and build; git-ignored
                     (2.05 KB gzipped after 5e; limit 3 KB)
public/maplibre-gl-worker.js  MapLibre's web worker, copied by `npm run build:map-worker` before dev and build;
                     git-ignored
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
Checks at the end of Phase 5h: the same four clean, `npm test` 368 tests passing. On Convex dev in Chrome (`/sites/localhost/live`): a curl hit with Vercel's geo headers for Oslo put one marker ("rose peacock", Oslo, ChatGPT, the page) on the map, the feed listed it with the older test goals and payments, and clicking the marker opened `/sites/localhost/visitors/<id>`. No console errors. The automation tab stayed in the background (`document.hidden`), so the tiles never painted there; the style, tile and worker requests all returned 200.
Checks at the end of design v2 Phase 1: the same four clean, `npm test` 368 tests passing. On a local production build (`next start -p 3001`, Convex dev) in Chrome: `/websites`, the dashboard, settings, customers, a visitor profile and Live all read correctly in light and dark; the toggle switched the theme, which survived a full reload and showed no console errors; the theme script is the first thing in `<body>` of the server HTML (no flash); Clerk's user menu matched both themes; the live map loaded `positron` in light mode and switched to `dark` live when toggled. The signed-in owner can't see the sign-in page (Clerk redirects), so sign-in was not looked at.
Checks at the end of design v2 Phase 2: the same four clean, `npm test` 368 tests passing. On a local production build (`next start -p 3001`, Convex dev) in Chrome: the bar stayed on top while the dashboard scrolled; "0 online" matched the old "online now" tile on `localhost` and was missing on the cookieless `advancedortholabsf.com`; the switcher menu listed both sites with a check on the current one; switching from `localhost/settings?range=30d` opened `advancedortholabsf.com/settings?range=30d`; "Add site" opened `/websites?add=1` with the form open; `/websites` shows "All sites" in the switcher and no tabs; a visitor profile kept Customers active; light and dark both read well. In a 375px iframe the bar is one 56px row plus the tabs, the domain truncates and the page doesn't scroll sideways. No console errors.
Checks at the end of design v2 Phase 3: the same four clean, `npm test` 384 tests passing. On a local production build (`next start -p 3001`, Convex dev) in Chrome: `/sites/localhost` with no `?range=` opened on Last 7 days with 7d lit; clicking 30d set `?range=30d` and lit only 30d; the menu listed every preset with a check on the current one and Today, Yesterday and Last 24 hours greyed out; Custom range… opened the two-month calendar under the menu, 14 Sep – 3 Oct applied as `?range=2026-09-14_2026-10-03` with "14 Sep – 3 Oct 2026" under the title and no segment lit; `?range=today` opened Last 7 days; `?range=12m` with two filters showed both badges and the 90-day notice in its bordered block, and removing a badge updated `?f=`; the Filter tooltip showed "Coming soon"; light and dark both read well. Not yet looked at on a phone.
Checks at the end of design v2 Phase 4: the same four clean, `npm test` 388 tests passing. On a local production build (`next start -p 3001`, Convex dev) in Chrome: `localhost` (revenue, no key goal) showed six tiles; with the key goal temporarily set to `phase5d-test` it showed all seven with "Phase5d Tests" and the key-goal tooltip (the key goal was cleared again afterwards); the cookieless `advancedortholabsf.com` showed Visitors, Pageviews and Visit duration; Pageviews showed a red -8.0% for 20–28 Oct and the session tiles showed "–" (tracking started in the range); the Revenue and Visit duration tooltips showed payments, revenue per visitor, sessions and time on page; `f=device:mobile` changed every tile; light and dark both read well; in a 375px iframe the tiles wrap into two columns with the odd last tile full width and no sideways scroll. "≈" on Visitors was not seen (no site has enough sessions to fall back).
Checks at the end of design v2 Phase 5: the same four clean, `npm test` 391 tests passing. On `next dev` with Convex dev in Chrome, `localhost` (revenue, no key goal), 30d: Visitors, Pageviews and Revenue on by default; switching on Conv. rate, Bounce rate and Visit duration drew three dashed/dotted lines, and the tooltip listed all six (Revenue $64.00, Pageviews 17, Visitors 8, 12.5%, 44.4%, 26s on 27 Oct); turning series off stopped at the last one; the choice survived a reload; light and dark both read well; `f=device:mobile` redrew the chart; no console errors. The key-goal bars were not seen (no dev site has a key goal) and the chart was not looked at on a phone.
Checks at the end of design v2 Phase 6: the same four clean, `npm test` 391 tests passing. On `next dev` with Convex dev in Chrome, `localhost`, 30d: four cards in two columns with dividers; Sources showed Direct (neutral icon), Google, Hacker News, ChatGPT, test ($64 revenue beside it) and X with favicons; "View all 17 →" on Pages expanded in place and "Show less" collapsed it; More ▾ → Campaign and → UTM source replaced "More" as the tab label; clicking Mobile set `f=device:mobile`, outlined the row and kept every card's tab; light and dark both read well. Not looked at on a phone, and the 3-filter limit was not clicked through (its logic, `canFilter`, is unchanged).
Checks at the end of design v2 Phase 8: the same four clean, `npm test` 394 tests passing (no backend changes). On `next dev` with Convex dev in Chrome, `localhost`, 30d: Events listed test-queued 6, test-signup 3 and nine goals at 1 ("View all 11"), the same counts the old panel's `stats.goals` gives; hovering test-signup showed "3 completions · 1 visitor · 3% conversion"; clicking it set `f=goal:test-signup` and outlined the row; with test-signup set as a temporary key goal (cleared afterwards) its row showed the badge in both themes; Funnels sat beside Events at the same height. Not looked at on a phone.
Checks at the end of design v2 Phase 10: the same four clean, `npm test` 405 tests passing (`convex/hourly.test.ts` covers ownership, today's hours, the previous window, Yesterday, 24h, a timezone change, filters, cookieless pageviews and the read budget; `dates.test.ts` covers the hour helpers, including Kolkata's half-hour offset). On `next dev` with Convex dev in Chrome, `localhost` (LA time, 13:44 on 28 Oct): Yesterday showed 24 hourly points with the same tiles as the custom range 27 Oct–27 Oct from the rollups (8 visitors, 17 pageviews, $64, 12.5%, 44.4%, 26s) and the same lists; Today ran 00:00–13:00 and 24h 14:00–13:00; `f=device:mobile` on Yesterday gave 6 visitors, matching the Devices list; the tooltip read "Oct 27, 13:00". The visitor changes on Yesterday show "–" because tracking started partway through 26 Oct, inside the comparison window (the day view counts the whole of 26 Oct as tracked, so it shows them). The budget notice was only checked in tests. Not looked at on a phone.
Checks at the end of design v2 Phase 9: the same four clean, `npm test` 394 tests passing (no backend changes). On `next dev` with Convex dev in Chrome, `localhost`, 90d: the Countries tab listed Unknown 27, Norway 1 and United States 1, and the Map shaded exactly Norway and the US; hovering showed "United States · 1 visitor" (and "Canada · 0 visitors" on an unlisted country); clicking the US set `f=country:US`, the Visitors tile went to 1 and the map stayed open with the US outlined; on Revenue ⇅ nothing was shaded, matching the list (only Unknown has revenue); light and dark both read well. Opening the tab fetched one more JS chunk, and in the production build the outlines' chunk (~114 KB) is only listed in the dynamic-import manifests. Not looked at on a phone.
Checks at the end of design v3 Phase 1: the same four clean, `npm test` 405 tests passing (no backend changes); `/` builds as static (○). On a local production build (`next start -p 3001`, Convex dev): curl without cookies got 200 and the splash for `/`, and 307 to `/sign-in?redirect_url=…` for `/websites`, `/billing` and `/sites/localhost`; in Chrome, signed in, `/` landed on `/websites`. The splash (fetched without cookies and rendered in the tab) read well in light and dark, both Log in links point to `/sign-in`, and in 375px frames it had no sideways scroll in either theme. Not checked: signing out and signing in for real (the automation browser holds the owner's session).
Checks at the end of design v2 Phase 7: the same four clean, `npm test` 394 tests passing. On `next dev` with Convex dev in Chrome, `localhost`, 30d: the AI tab listed only ChatGPT (2) while Sources listed six; clicking it set `f=source:ChatGPT` and the AI tab (now from the filtered view) showed it outlined; "Visitors ⇅" on Sources and Countries switched to "Revenue ⇅" with just the rows that have revenue (test $64, Unknown $64), while Pages and Devices kept plain labels; the cookieless `advancedortholabsf.com` (no revenue) had no ⇅ button.
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
- **Dashboard design v2 replaces the Simple Analytics layout** (owner's brief `docs/DESIGN-V2.md`, plan `plans/dashboard-design-v2-plan.md`, screenshots in `public/design-v2/`, local only). shadcn/ui on Tailwind v4 in light and dark (following the system), one sticky top bar (logo, site switcher, "N online", theme toggle, Clerk's button; tabs Analytics | Live | Customers | Settings), an "Analytics" header with Today | 24h | 7d | 30d, a preset menu and Custom range…, joined stat tiles that switch a monochrome shadcn chart's series, then a grid of cards (Sources with AI, Pages, Countries with Map, Devices, Events, Funnels). Every signed-in page and the top bar share one container, `max-w-[1200px]` with 16/24/32px side padding (`px-4 sm:px-6 lg:px-8`) and `pt-10 pb-20` on the page, to match the owner's other apps (2026-10-28). The old colour names (`panel`, `line`, `muted`, `strong`, `accent`, `bar`, `up`, `down`) remain as aliases of the shadcn tokens for the pages not yet restyled. See the "Design v2" decision sections below.
- **The header shows the site's own `/favicon.ico`**, loaded straight from the site, with the first letter as a fallback.
- **Time-on-page % change** compares the two averages; it shows "–" when either period has no duration beacons.
- **`sites.listWithStats` takes `now`** from the page (snapped to the minute) and works out each site's 30-day window in that site's own timezone, today included.
- **`/websites` uses the design v2 styling** (after Phase 10). It has a page header like the dashboard's ("Websites", "Last 30 days", an outline "Add website" button), and the filter box and "sort by" toggle were removed at the owner's request. Sites are always sorted by 30-day pageviews, then by name. Each card has the favicon, domain and gear on top, the 30-day pageview total in the tiles' number style, and a monochrome Visitors/Pageviews sparkline that uses the dashboard chart's colours and gradients. The add form's input, timezone select and submit button now use the shadcn styling, which also changes the timezone select on Settings.
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

### Phase 5h (live map)

- **Live tab** in the site header (Visitors | Live | Customers | Settings) at `/sites/[domain]/live`: the "N online now" count, a MapLibre map (`maplibre-gl` 6.14, BSD-3) on OpenFreeMap's `dark` style (no key), and a feed beside it on wide screens, under it on phones.
- **`stats.liveFeed`** takes two times from the page, both moved every 30 s like `stats.live`: `onlineSince` (5 minutes, the dashboard's "online now") for the dots, and `since` for the feed. Dots come from `sessions.by_site_lastSeenAt`, one per visitor from their latest session (position, city, device, source, last page). The feed merges the newest pageviews, goals and (on sites with revenue) payments and refunds through each table's `by_site_ts`, at most 200 rows, with names from the visitor rows and city from the session. Outbound clicks, identify and claims stay out of the feed.
- **The feed goes back 24 hours**, not 5 minutes: on sites with a few hundred pageviews a month a 5-minute feed is nearly always empty. Payments show no place, because the credited session can be days old.
- **Dots:** the visitor's emoji on their colour, with name, place, source and page as the tooltip; a click opens their profile, as do names in the feed (cookieless rows show "Anonymous" and don't link). Visitors in the same rounded cell are spread on a small circle. The map zooms to the first visitors once, then stays where it was moved. Visitors without a position count in the header and say they're not on the map.
- **MapLibre's worker** is not emitted by Turbopack (maplibre-gl 6 finds it with `new URL(name, import.meta.url)`), so `npm run build:map-worker` copies `maplibre-gl-worker.mjs` to `public/maplibre-gl-worker.js` before dev and build, and `LiveMap` calls `setWorkerUrl`. The `.js` name keeps it outside the Clerk proxy's matcher. It is 0.5 MB (loaded only on the Live tab).
- **Markers go on as soon as the map exists**, not on its `load` event, which waits for the first tiles.
- **Cookieless sites** have no sessions, so their map stays empty (the page says so); the feed still lists their pageviews.

### Design v2, Phase 1 (shadcn foundation and theme)

- **shadcn/ui** initialised with `npx shadcn@latest init --defaults` (style `base-nova`, which uses Base UI rather than Radix, so custom triggers use `render`, not `asChild`; neutral base colour; lucide icons). It adds `shadcn` itself as a dependency (for `shadcn/tailwind.css`), `cn` (shadcn's replacement for clsx + tailwind-merge), `class-variance-authority`, `tw-animate-css` and `@base-ui/react`.
- **Tokens:** shadcn's neutral light set on `:root` and dark set on `.dark` in `globals.css`. `--chart-1` is the foreground and `--chart-2..5` are greys in both themes (for the monochrome chart in Phase 5).
- **Old colour names:** `panel`, `bar`, `up` and `down` are now per-theme variables, and `line` and `strong` point at `--border` and `--foreground`. **`muted` and `accent` could not stay as aliases**, because shadcn uses both names for background colours (its components use `bg-muted` and `bg-accent`). So every `text-muted` became `text-muted-foreground` (99 uses), and the old blue `accent` became **`link`** (`text-link`, `bg-link/15` and so on). The light `link`, `up` and `down` are darker shades so they stay readable on white. Buttons that hard-coded `text-zinc-900` on `bg-strong` now use `bg-primary text-primary-foreground`. The chart grid, axes and tooltip use `var(--border)`, `var(--muted-foreground)` and `var(--popover)`. The blue, pink and green series colours stay until Phase 5.
- **Theme:** `next-themes` with the class strategy, following the system until the owner picks one (stored in `localStorage` as `theme`). Its inline script sets the class before the page paints. `suppressHydrationWarning` is on `<html>`. The toggle (sun in dark, moon in light) sits next to the user button in the top bar.
- **Clerk follows the theme without an `appearance` theme**, because next-themes sets `color-scheme` on `<html>` and Clerk's default theme reads it. The plan said `@clerk/themes`. That package is now `@clerk/ui/themes`, and its `shadcn` theme froze the page as soon as the owner was signed in (renderer unresponsive, plus a React #418 hydration error). It also pulled `@clerk/shared` 4.40 → 4.43. Both were removed, and the lockfile keeps Clerk's earlier versions.
- **Live map:** OpenFreeMap `positron` in light mode and `dark` in dark mode. `LiveMap` calls `setStyle` when the theme changes, and the markers (DOM elements) stay put.

### Design v2, Phase 2 (sticky top bar)

- **`TopBar`** (`src/components/TopBar.tsx`) replaces `SiteHeader` and the websites list's own header. It takes `site={{ domain, section }}` on a site's pages and nothing on `/websites` (switcher shows "All sites", no tabs, no online count). It's `sticky top-0` with a translucent, blurred background, so content scrolls under it. The bar's row is 56px; the tabs sit on its bottom border (`-mb-px`) and scroll sideways on narrow screens. The content width stays `max-w-5xl` to line up with the pages; the example is a little wider, which can change when the dashboard content is rebuilt.
- **The section `visitors` is now `analytics`** (`sitePath(domain, "analytics")` is still `/sites/[domain]`). Tabs no longer have icons and "All sites" left the tab row (it's in the switcher and the logo).
- **Switching sites keeps the section and `?range=` only.** `?f=` filters are dropped, because they name pages, goals and sources of the old site.
- **"N online"** uses the same 5-minute window and 30-second refresh as before (`stats.online`), and needs `sites.get` to know whether the site has visitor ids; both queries are shared with the page's own subscriptions. The dashboard's "online now" tile stays until the stat row is replaced in Phase 4.
- **The add form on `/websites` follows `?add=1`** (the button toggles the parameter with `router.replace`), so "Add site" opens it from anywhere, including from `/websites` itself. The page now renders inside `<Suspense>` because it reads the URL.
- **Menu items navigate with `router.push` in `onClick`**, not links, so middle-click doesn't open a new tab from the switcher. `Menu.LinkItem` exists in Base UI 1.9 if that's wanted later.

### Design v2, Phase 3 (page header and day ranges)

- **Presets** are `today`, `yesterday`, `24h`, `7d`, `30d`, `90d`, `6m` (183 days) and `12m` (365 days), plus the custom `YYYY-MM-DD_YYYY-MM-DD`. `DEFAULT_PRESET` is `7d`. `presetGranularity` says `hour` for today, yesterday and 24h (custom ranges are `day`), and `PRESET_LABELS` holds the names ("Last 7 days"). `presetRange("24h")` is yesterday and today, the calendar days the window touches; its exact hours come with Phase 10.
- **Hour presets are switched off by `HOURLY_RANGES = false`** in `SiteDashboard`: they show disabled in the segmented control and the menu, and a `?range=today` (or `yesterday`, `24h`) URL opens Last 7 days without rewriting the URL. Phase 10 flips the flag.
- **`RangeControls`** replaces `RangePicker` (the ‹ › arrows are gone). The segmented control is a shadcn Toggle Group; clicking the lit segment again does nothing. Custom range… opens a Popover anchored under the menu button (`PopoverContent` gained an `anchor` prop) with a two-month range Calendar (`react-day-picker` 10, added by the shadcn CLI with `date-fns`); days after the site's today are disabled, and Apply needs a span of at most 365 days. A custom range equal to a day preset ending today is written back as the preset's name.
- **The range in words** under the title is the preset's label, or `formatRangeLabel` for custom ranges: day first as the PRD shows ("1 Oct – 14 Oct 2026"), unlike the rest of the app's "Oct 1".
- **The Filter button** is a disabled outline Button with `focusableWhenDisabled`, so it still gets hover and focus for its "Coming soon" tooltip. `TooltipProvider` (300 ms delay) wraps the app in `layout.tsx`.
- **Filter chips are outline Badges** under the header ("Clear all" with two or more). The 90-day and "too many" notices sit in a muted bordered block in place of the stats.

### Design v3, Phase 1 (homepage)

- **The signed-in redirect on `/` lives in the proxy, not the page.** The PRD had the page call `auth()`, but with `cacheComponents` that needs a Suspense boundary and the splash would stream first and then redirect on the client. In the proxy it is a plain 307 before any HTML, and `/` stays a static page.
- **Clerk's redirects are set on `ClerkProvider`**: `afterSignOutUrl="/"` (the current `UserButton` and Phase 3's menu both use it) and `signInFallbackRedirectUrl="/websites"`. A `redirect_url` from a protected page still wins.
- **The copy avoids "no cookies"**: the default script sets a visitor id, so the line says no personal data is sold or shared. Edit it in `src/app/page.tsx`.
- **`LogoMark`** (`src/components/LogoMark.tsx`) is the ring-on-square mark, now used by the homepage and `TopBar`.

### Design v2, Phase 10 (hourly ranges)

- **One aggregation for filtered and hourly views.** `lib/filtered.ts` now takes a `ViewWindow`: the current and previous periods, the chart's points and which point a row lands on. `dayWindow` (stats.filtered) counts rows on their stored site-local `date`, as before; `hourWindow` (stats.hourly) counts on timestamps, [start, end) and the window of equal length before it, one point per hour from `start`, named `YYYY-MM-DDTHH:00` in the site's timezone. Sessions count at their start, payments at their own time.
- **The window comes from the server, the clock from the page.** `stats.hourly` takes `period` (today, yesterday, 24h), `now` and the filters, and `dates.hourWindow` works out the bounds: Today runs from local midnight to the end of the current local hour, 24h is the 24 hours ending there, Yesterday is the whole local day. Today therefore compares against the same number of hours before midnight, not all of yesterday. The page passes `now` snapped to 5 minutes (`HOURLY_STEP_MS`): every timezone's hours start on a 15-minute grid, so the snapped time is always in the right hour, and the arguments change at most every 5 minutes.
- **Session-less pageviews** (cookieless sites, the old script) count toward pageviews, time on page and the page, referrer, device, browser and country lists when nothing is filtered, with their unique visits as visitors (as the rollups count them). Session numbers come from sessions only, so a cookieless site's bounce rate and session time are null ("–"). A filter picks sessions, so they drop out then.
- **`comparable` on hours** is false when `trackingStartedAt` falls inside the window or the one before it, so visitor-based changes show "–".
- **The dashboard** treats an hour range like a filtered one: `View.raw` makes the cards read the view's lists instead of the rollup queries. The `HOURLY_RANGES` flag and the `hourly` prop of `RangeControls` are gone. The chart's ticks and tooltip use `formatPoint` ("14:00", "Oct 27, 14:00"). Over the 12,000-read budget the page says to pick a day range.

### Design v2, Phase 9 (Map tab)

- **The outlines are pre-built, not computed in the browser.** `npm run build:world-map` (`scripts/build-world-map.mjs`, dev dependencies `world-atlas`, `topojson-client`, `d3-geo`, `i18n-iso-countries`) projects world-atlas's 110m countries with Equal Earth (Antarctica dropped) and writes SVG paths keyed by ISO alpha-2 to `src/components/dashboard/world-110m.json` (committed, 174 countries). Kosovo maps to `XK`, Northern Cyprus joins `CY` and Somaliland joins `SO`. The page needs no map library.
- **`WorldMap` is loaded with `next/dynamic`** (`ssr: false`), so the outlines (~114 KB, ~110 KB of JSON) only download when the Map tab opens; a pulsing block fills the card meanwhile.
- **Shading**: `fill-foreground` with opacity 0.25 + 0.75 × √(count ÷ top), and countries with nothing at `foreground/10`, so it works in both themes without new tokens. Only countries with an outline set the top, so "Unknown" (often the biggest row) doesn't wash the map out. Small countries the 110m set doesn't have (Singapore, Malta, Bahrain, ...) are in the list but not on the map.
- **The Map tab is `country:map`** and reads the `country` list (the filtered view's lists are now looked up by `breakdownKey(dim, channel)`, not the tab id). `StatsCard` gained a `body` that replaces the rows once they've loaded, with no "View all". The active filter's country is outlined and drawn last. The tooltip is one floating element that follows the pointer, not a Tooltip per country. Countries can't be focused by keyboard; the Countries tab is the accessible list.

### Design v2, Phase 8 (Events and Funnels cards)

- **Events is a `StatsCard`** with one tab, fed by `stats.goals` (or the filtered view's `goals`), so the rows are the old panel's: sorted by completions, the key goal always listed (even at 0). Visitors and conversion (goal visitors ÷ the site's daily visitors, as before) moved into a row tooltip. The panel's paging is replaced by "View all N →".
- **`StatsRow` gained `badge` and `tooltip`, and `StatsCard` an `empty` node and an optional `metric`.** The key-goal badge is an outline Badge on the background colour, since the secondary one disappears into the bar in light mode. Clicking the badge still filters (it sits under the row's stretched button).
- **Funnels is the same card with no rows** and the empty text "Funnels are coming soon". The empty state is `flex-1`, so it fills the grid row and matches Events' height when that expands.

### Design v2, Phase 7 (AI tab and Revenue ⇅)

- **The AI limit is by source name:** `stats.breakdown` takes an optional `channel` (only `"AI"`, and only with `dim: "source"`) and keeps the sources `KNOWN_SOURCES` puts in AI (`inChannel` in `lib/sources`), with totals over just those. The filtered view returns the same list under the extra key `source:AI` (`breakdownKey`). Going by name, not by each session's channel, keeps both paths the same: a ChatGPT visit tagged `utm_medium=cpc` (channel Paid) still shows under AI. Only AI is allowed because Referral and the other channels also hold unknown hostnames and tags.
- **Card tabs are keyed by list**, not by dim (`source` and `source:AI` are both the `source` dim). Clicking an AI row adds the ordinary `source` filter.
- **Revenue ⇅ re-sorts on the client**, not server-side as the PRD suggests: the rows already carry `revenueMinor`, so the switch needs no second query. In Revenue mode the card lists only rows with revenue (refunds can make an amount negative; those sort last), largest first, with the bar relative to the top amount. The catch: a list cut at 500 keys by visitors could miss a paying key beyond that, which no site comes near. The choice is per card and not remembered. The muted amounts Phase 6 added to rows are gone.
- **⇅ shows on the Sources and Countries cards** (every tab of those is credited revenue) on sites with a currency. Pages and Devices keep a plain label.

### Design v2, Phase 6 (card grid and rows)

- **`StatsCard`** replaces `BreakdownList`: header (text tabs, More ▾, the metric on the right), bar rows and "View all N →" / "Show less". `Breakdowns` holds the four cards in a `gap-px` grid on `bg-border` inside one bordered block, one column below `md`. The Goals panel stays below the grid, unchanged, until Phase 8.
- **Every list now shows counts** (Devices, Browsers, OS and locations used to show a share %). Bars are relative to the top row, as in the example. The header names the count: Visitors, Pageviews (Pages), Sessions (Entry, Exit) or Clicks (Outbound).
- **Revenue stays visible until Phase 7's ⇅:** on revenue sites, source, campaign and location rows show their amount muted before the number.
- **The campaign items under More ▾ are "Campaign", "UTM source", "UTM medium", "UTM term", "UTM content" and "ref / via"** (the PRD says "Source", "Medium" and so on), because the chosen item becomes the tab label and "Source" next to "Sources" read badly.
- **A filterable row's label is a button stretched over the whole row** (`after:inset-0`), so the ↗ link can sit on top without nesting a link in a button. The bar sits under the content in an `isolate` stacking context.
- **Each card keeps its tab** across range and filter changes; switching tabs collapses "View all". The expanded state is kept across range changes.
- **Empty and loading states**: "No data for this range" centred in the height of 7 rows, and 7 skeleton rows.

### Design v2, Phase 5 (monochrome chart)

- **The timeseries gained five fields** on both the rollup and filtered paths: `goal` (key-goal completions; from the key goal's `dailyDims` rows), `bounceRate`, `sessionTimeMs`, `timeOnPageMs` (per day, null with nothing to divide by) and `conversionRate`. Conversion rate per day is converted visitors ÷ that day's visitors, capped at 100%: paying visitors on each payment's own day on a revenue site (the rollup path reads `payments`, null past 10,000 rows), otherwise the key goal's visitors. A payment on a day with no (matching) visits gives null, not a rate.
- **Visit duration's series** is session time on sites with visitor ids and time on page on cookieless ones, matching the tile.
- **`series.ts`** holds the series keys, colours (`--chart-1` for Visitors and Revenue, greys for the rest) and `useChartSeries`. The choice is stored in `localStorage` under `dashboard.chartSeries` and keeps keys the current site lacks, so another site's Revenue choice survives. With nothing stored, or nothing the site has, the defaults show.
- **Hidden scales:** bars go up to two thirds of the height (max × 1.5), lines to about nine tenths (max × 1.1). The left axis shows only while Visitors or Pageviews is on. Lines and areas are straight segments, as in the example.
- **Dash patterns:** Conv. rate `4 4`, Bounce rate dotted `1 3`, Visit duration `8 4`.
- **The tooltip** lists bars, then areas, then lines (Recharts' order), which differs a little from the tile order.
- **The tracking marker** is a faint dashed line with a small label on whichever side has room.
- **`npx shadcn add chart`** also wrote `ui/card.tsx` (deleted, unused) and lowered the `recharts` range in `package.json` to `^3.8.0` (put back to `^3.10.1`).

### Design v2, Phase 4 (joined stat tiles)

- **`StatRow`** holds the tiles in a `gap-px` grid on `bg-border` (inner dividers), inside one bordered block with the chart under a top border. Two columns on phones (an odd last tile spans both), one row of equal columns from `sm`. With six or seven tiles the side padding drops from 24px to 16px so "Bounce rate" and "Visit duration" fit the 5xl page; longer key-goal names still truncate.
- **The dots are static for now**: `DEFAULT_SERIES` (Visitors, Pageviews, Revenue, key goal) shows lit, the rest dim. Phase 5 makes the tiles toggles.
- **The key-goal tile counts completions**, from `stats.goals` (the same query the Goals panel makes, so it's shared) or the filtered view. `goalsResult` gained `keyGoalPrevious`, the key goal's completions in the previous period (from `dailyDims` on the rollup path, from matching sessions on the filtered path), for its % change. The label is `goalLabel`: split on `_ - :` and spaces, title-cased, last word pluralised unless it ends in "s" or "ed".
- **Number formats follow the example**: `formatChange` now has one decimal ("+50.4%"), rates use `formatRate` (two decimals below 1%, "0.80%", one above, "41.6%"), and Revenue shows whole units ("$552") with the exact amount in its tooltip.
- **"–" replaces the % change** whenever there's nothing to compare: no previous data, or a session-based tile when tracking started inside the comparison window. Pageviews, Revenue and the key goal are never marked incomparable.
- **Cookieless sites' Visit duration** is the average time on page, as before.

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
- **Don't pass Clerk's `shadcn` theme (`@clerk/ui/themes`) to `ClerkProvider`**: with Clerk 7.9 and React 19.3 it froze every signed-in page (see the design v2 Phase 1 decisions).
- **A running `next dev` can hang after new packages are installed** (pages never finish loading). Restart it, and delete `.next` if that isn't enough.
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

## Next: review design v3 Phase 1, then Phase 2

Owner:

1. Signed out (a private window), open `/`: the splash page in light and dark and on your phone. Both Log in buttons open the sign-in page, and signing in lands on `/websites`.
2. Signed in, open `/`: it goes straight to `/websites`.
3. Sign out from the user button: you land on `/`.

Then build Phase 2 (account tabs and the Billing and Settings pages).

## Earlier: review design v2 Phases 4 to 10 on production

Design v2 is complete. Phases 4 to 10 and the 1200px page width were pushed to `main` together on 2026-10-28 and deploy with it (the Convex functions include the new `stats.hourly`). Owner:

1. On production, look at the tiles, chart and cards on a site in both themes and on your phone. Click the tiles to switch series, and try the card tabs (including AI and Map), More ▾, View all, Visitors ⇅ Revenue, clicking rows and countries on the map, and the Events card (hover a goal, click it). Set a key goal in Settings to see the seventh tile, the goal bars and the Key goal badge.
2. Try Today, Yesterday and 24h, with and without a filter, and on a cookieless site.
3. Check the other pages (Websites, Live, Customers, Settings) at the new width.

## Earlier: review design v2 Phases 4 to 10

Superseded by the section above.

## Earlier: review design v2 Phases 4 to 9, then Phase 10

Superseded by the section above.

## Earlier: review design v2 Phases 4 to 8, then Phase 9

Superseded by the section above.

## Earlier: review design v2 Phases 4 to 7, then Phase 8

Superseded by the section above.

## Earlier: review design v2 Phases 4 and 5, then Phase 6

Superseded by the section above.

## Earlier: review design v2 Phases 1 to 3, then Phase 4

All three pushed to `main` on 2026-10-28 and deployed. Owner:

1. Restart `npm run dev` if it was running before the new packages were installed (Phase 3 added `react-day-picker` and `date-fns`), then check each page in both themes, the switcher menu, "N online", the bar, and the new range header (segments, menu, Custom range…) on your phone too.
2. `public/design-v2/` is git-ignored (anything in `public/` is served by the live site), so the screenshots stay local.

## Earlier: check 5h on production, then Phase 6

Pushed to `main` on 2026-10-28 (commit `a1b7c72`) and live. Owner:

1. Check that the map's tiles draw on the Live tab (the automated check couldn't see them; see the 5h checks).
2. "Done when" on production: open one of your sites on your phone; a named dot appears near you on its Live tab within 30 seconds.

Then Phase 6 (open sign-ups).

## Earlier: check 5g on production, then 5h

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

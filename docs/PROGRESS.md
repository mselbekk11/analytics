# Build Progress

Last updated: 2026-11-02 (design v4, Phases 1 to 17 built; the plan is complete). Design v4 is planned in [plans/dashboard-design-v4-plan.md](../plans/dashboard-design-v4-plan.md) (PRD: `plans/dashboard-design-v4.md`, owner's brief `plans/dashboard-design-v4-brief.md`, screenshots in `public/design-v4/`). Design v3 is planned in [plans/dashboard-design-v3-plan.md](../plans/dashboard-design-v3-plan.md) (PRD: `plans/dashboard-design-v3.md`, owner's brief `plans/dashboard-design-v3-brief.md`, screenshots in `public/design-v3/`). Design v2 is planned in [plans/dashboard-design-v2-plan.md](../plans/dashboard-design-v2-plan.md) (PRD: `plans/dashboard-design-v2.md`). Read this together with [PLAN.md](PLAN.md) (Phases 0 to 4) and [PHASE5.md](PHASE5.md) (Phases 5 and 6, which replace PLAN.md's scope rule). This file records what has been built, the decisions taken along the way (some differ from PLAN.md), and how the environments are set up.

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
| Design v4, Phase 1: theme tokens and dashboard clean-up | **Built, awaiting owner review.** piqo's near-black dark palette (`#0a0a0a` page and cards). One `--line` token (`#1f1f1f` dark, `#e5e5e5` light) behind every border and card ring. Series tokens for visitors, pageviews, revenue and the key goal, and a `--bar` tint for row share bars. The dashboard no longer shows the Filter button or the Events and Funnels cards (code kept behind flags). The user button is the initials circle only. |
| Design v4, Phase 2: bar-and-line chart | **Built, awaiting owner review.** Visitors are blue bars in every bucket, Pageviews a light-blue line with a soft fill, and Revenue (green) and the key goal (purple) bars beside Visitors. The rates and duration stay as grey dashed lines. Tile dots use the series colours. The tooltip lists the series in tile order. Hours and days share the same chart. The monochrome `--chart-*` tokens are gone. |
| Design v4, Phase 3: card metric toggle | **Built, awaiting owner review.** One metric for every card in `?metric=` (Visitors by default, Pageviews, Revenue on sites with payments), switched from any card's top-right label. Rows rank, number and bar by it and zero rows drop out, with rollups or filters, and on the Map. Lists without the chosen count show their own and say so. Convex functions changed (breakdown rows), no schema change. |
| Design v4, Phase 4: dotted world map | **Built, awaiting owner review.** The Map tab is a dot-matrix world (one SVG path of land dots) with a blue bubble per country at its centre, sized by the square root of the card metric. Hover shows flag · country · count, click filters and the filtered country is outlined. Unknown stays off the map. Still lazy-loaded, now 24 KB instead of ~114 KB. No backend change. |
| Design v4, Phase 5: Pages tab, first cut | **Built, awaiting owner review.** `/sites/[domain]/pages`: "Pages" header with the range controls, and an All pages table (path, trend sparkline, views with share, visitors, revenue on sites with payments) with sorting on every column, search by path and 50 rows a page. `?range=` and `?f=` carry between the Analytics and Pages tabs, which now have icons. New Convex query `pages.list`, no schema change. |
| Design v4, Phase 6: per-page rollups and backfill | **Built, awaiting owner review.** Page rows count sessions that viewed the page, entries, bounces (on the entry page) and engaged time, at ingest from each site's `pageStatsStartedAt`, and `migrations:backfillPageStats` fills in everything before it (run on dev). The Pages tab has tiles (Pages viewed, Pageviews with change, Sessions, Avg. bounce, Avg. duration), and the table has Sessions (with change), Bounce and Duration in place of Visitors. Schema change (optional fields only); **the backfill must be run once on prod after deploy.** |
| Design v4, Phase 7: page titles | **Built, awaiting owner review.** The script sends `document.title` (whitespace collapsed, 200 characters) with each pageview, and ingest keeps the latest non-empty one per path in a new `pageTitles` table. The Pages table shows the title over the path (the path alone when none was ever sent), and search matches titles too. Script 2,079 bytes gzipped (was 2,029). New table, nothing to backfill. |
| Design v4, Phase 8: page drawer | **Built, awaiting owner review.** Clicking a Pages row (or Enter on its page cell) opens a drawer from the right, full width on phones, kept in `?page=<path>` so reloading or sharing the URL opens it again. It shows the title, the live URL (new tab), Visitors, Pageviews, Bounce and Avg. time tiles, a pageviews bar chart per day (per hour on Today, Yesterday and 24h) and Sources / Countries / Devices / Browsers by visitors. Escape, ✕ or a click outside close it and focus goes back to the row. New Convex query `pages.detail` (the filtered view with `page:<path>`), no schema change. Added shadcn `sheet`. |
| Design v4, Phase 9: Users tab and visitor table | **Built, awaiting owner review.** Users replaces Customers in the tabs (Analytics \| Pages \| Users \| Live \| Settings), and `/sites/[domain]/customers` redirects to `/users?kind=customers`. `visitors` gained optional totals (pageviews, engaged time) and the latest session's location, device, browser, entry and exit, kept at ingest; `migrations:backfillVisitorTotals` fills them in (run on dev: all 73 dev visitors match their sessions). The All visitors table lists everyone seen in the range, latest seen first, 50 a page, with an All \| Customers toggle (`?kind=`), revenue on customers, and search by name, email, id, persona, country, city or page. Cookieless sites get an explanation. New query `visitors.list`. Schema change (optional fields only); **the backfill must be run once on prod after deploy.** |
| Design v4, Phase 10: Users header | **Built, awaiting owner review.** Above the visitor table, the Users tab has Visitors, Pageviews, Views per visitor and Avg. time on site tiles with their change, a visitors bar chart per day (per hour on Today, Yesterday and 24h), and a Sources / Countries / Devices card by visitors, side by side with the tiles and chart on desktop and stacked on phones. Built from the Analytics tab's own queries, so they honour `?f=` and match its tiles and lists; clicking a list row filters. The page drawer's chart is now the shared `CountChart`. No Convex change. |
| Design v4, Phase 11: visitor drawer | **Built, awaiting owner review.** Clicking a Users row (or Enter on its name) opens a drawer from the right, full width on phones, kept in `?visitor=<id>`. It shows the avatar, name and "N sessions · N pageviews · time on site" (plus email / user id and total paid when known), Time on site, Sessions, Pages and Events tiles, a First visit block (landing page, source, date and time) and the Journey: the latest 50 sessions, newest first, each with its number, date, source, location · browser · device · duration · pages · events, campaign tags, and its pageviews (Entry and Exit marked), goals with their properties, outbound clicks, identify, checkout returns and payments with times. `/sites/[domain]/visitors/<id>` redirects to `/users?visitor=<id>` (next.config), and the old profile page is deleted. `visitors.profile` gained totals, `firstVisit`, per-session `events` and goal `props`; no schema change. |
| Design v4, Phase 12: settings sidebar layout | **Built, awaiting owner review.** Site Settings is a "Settings" header (with the domain) over two columns: a grouped sidebar (Install: Tracking code, Timezone; Attribution: Goals & conversions, Revenue attribution; Danger zone, in red) and one section on the right with its title, description and a bordered card. `?section=` picks it (`tracking` by default) and survives a reload. On phones the sidebar is a grouped select. Every setting moved over unchanged in behaviour. The Goals card's "Set up goals" link opens `?section=goals` and the Users "Customers" hint `?section=revenue`. No Convex change. |
| Design v4, Phase 13: excluded paths | **Built, awaiting owner review.** Settings → Filtering → Excluded paths holds up to 50 glob patterns (`/admin/*`, `/preview`), added and removed in a list and saved with Save changes (disabled until something changes). Invalid patterns are refused with a message, in the form and in `sites.setExcludedPaths`. Ingest drops a pageview whose path matches before anything is stored, so its pings and events find no pageview; goals and outbound clicks on a pageview stored before its path was excluded are dropped too. New optional `sites.excludedPaths`; matching lives in `convex/lib/paths.ts`. Applies to new hits only. |
| Design v4, Phase 14: page path grouping | **Built, awaiting owner review.** Settings → Filtering → Page paths has a "Group dynamic path IDs" switch (off by default), a placeholder name (`:id` by default) and an ordered list of named patterns like `/dashboard/:site_id/sites`, with a live preview of what an example path is stored as, all saved with Save changes. With grouping on, ingest rewrites each pageview's path after the excluded-paths drop: the first matching named pattern wins, otherwise UUIDs, runs of 6+ digits and 16+ character hashes become the placeholder. The grouped path is what's stored, rolled up, titled and used as entry and exit. New optional `sites.pathGrouping`, `sites.pathGrouping` / `sites.setPathGrouping`; the pure functions are in `convex/lib/paths.ts`. Applies to new hits only. |
| Design v4, Phase 15: visitor identity | **Built, awaiting owner review.** Settings → Privacy → Visitor identity offers "Cookies (visitor and session ids)" or "Cookieless", saved as the optional `sites.cookieless` (`sites.setCookieless`; `sites.get` reports it), and says what each mode loses. With Cookieless, ingest stores every pageview without visitor or session ids, even from a snippet that sends them, so its pings, goals and identify calls get none either. `/api/collect` now answers a pageview of a known site with `200 cookieless` or `200 cookies`; the script sends pageviews by fetch to read that, deletes both `_va_` cookies and keeps a `_va_nc` flag in localStorage, so later page loads send no ids. A `cookies` reply clears the flag and the next page load sets cookies again. `data-cookieless` works as before. Script 2,200 bytes gzipped (was 2,087). |
| Design v4, Phase 16: ignore my visits | **Built, awaiting owner review.** Settings → Filtering → Ignore my visits (first in the group) shows two links built from the domain, `https://<domain>/?_va_ignore=1` and `?_va_ignore=0`, each with Copy, and explains that the switch is per browser and per site. The script reads `?_va_ignore=1` / `=0` on any page load, sets or clears a `_va_ignore` flag in localStorage, and while it is set deletes both `_va_` cookies and sends nothing at all (no pageview, ping, goal, identify, outbound click or claim; `window.analytics` is never installed, so stub calls stay queued). The undo link clears the flag and that same page load is tracked. The old `localStorage.sa_ignore = "true"` still works. No Convex change. Script 2,259 bytes gzipped (was 2,191 by the same measure, `gzipSync` of the minified file as `script.test.ts` does). |
| Design v4, Phase 17: MCP server | **Built, awaiting owner review.** `/api/mcp` is a stateless Streamable HTTP MCP endpoint (official SDK `@modelcontextprotocol/server` 2.4, Node.js runtime, public in the proxy) with eight read-only tools: `list_sites`, `get_summary`, `get_timeseries`, `get_breakdown`, `get_pages`, `get_visitors`, `get_visitor_journey`, `get_live`. They take a domain, the `?range=` grammar and the `?f=` filter syntax and return compact JSON echoing the range, timezone and filters. Account Settings has an MCP server card: create a named key (shown once, with Copy), list keys (name, prefix, created, last used), revoke, and setup for Claude Code, Claude Desktop and Cursor. Site Settings → Integrations → MCP server shows the setup with the domain and links to the keys. New `apiKeys` table (hashed keys); the stats queries were split into site-taking helpers that the `mcp.*` functions share. New dependencies `@modelcontextprotocol/server` and `zod`. |
| Design v3, Phase 1: public homepage and sign-out landing | **Built, awaiting owner review.** `/` is a public, static splash page (logo and "Analytics", Log in top right; headline, one line and a Log in button in the centre). Signed-in visitors are redirected from `/` to `/websites` by the proxy. Clerk signs out to `/` and falls back to `/websites` after sign-in. |
| Design v3, Phase 6: onboarding redirect | **Built, awaiting owner review.** When the site list loads empty, `/websites` replaces itself with `/websites/new`. That covers a new account and deleting the last site. The skeleton stays up until then, and the old empty state is gone. On `/websites/new`, Cancel only shows when you have at least one site. |
| Design v3, Phase 5: add website, step 2 and first-hit detection | **Built, awaiting owner review.** Step 2 of `/websites/new` shows the site with a "Created" badge, the snippet in a code block labelled "HTML · paste in `<head>`" with Copy, and a live status row. "Waiting for your first event…" flips to "First pageview received" through the new `sites.hasPageview` query, with no polling. Then "Go to dashboard →" replaces "Skip to dashboard", and the stepper and panel tick every step. Site Settings uses the same snippet block. |
| Design v3, Phase 4: add website, step 1 | **Built, awaiting owner review.** `/websites/new` has the stepper, an "Add your website" card with one Domain field, and a "How it works" panel. As you type, the card previews "We'll track …" using the server's normaliser and shows the browser's timezone. Create site stores the site and replaces the URL with `?site=<domain>`. Step 2 for now is the snippet and "Go to dashboard"; Phase 5 fills in the rest. "Add website" and the switcher's "Add site" link here, and `?add=1` and the old inline form are gone. |
| Design v3, Phase 3: shadcn user menu | **Built, awaiting owner review.** Clerk's `UserButton` is gone from the bar. In its place is an initials circle plus the email (from `sm` up), opening a shadcn menu: "Signed in as" and the email, Websites / Billing / Settings, and a red Sign out to `/`. It appears in both modes of the bar. |
| Design v3, Phase 2: account tabs and placeholder pages | **Built, awaiting owner review.** The top bar has an account mode on `/websites`, `/billing` and `/settings`: logo and "Analytics", no switcher, Websites \| Billing \| Settings tabs that share one tab strip with the site tabs. `/billing` is a "coming soon" card; `/settings` has the account email with Manage account (Clerk's profile), Light / Dark / System, and Sign out. |

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
  visitors.ts        visitors.list (Users table, design v4), visitors.customers (paying or key-goal visitors),
                     visitors.profile (journey timeline, 5f; the visitor drawer, design v4)
  stats.ts           stats.summary, stats.timeseries, stats.breakdown, stats.goals, stats.conversions, stats.live,
                     stats.online, stats.filtered (5g), stats.liveFeed (5h) (all behind requireSite)
  ingest.ts          ingest.pageview / ingest.ping / ingest.event / ingest.duration (legacy) (public, guarded by INGEST_SECRET),
                     internal ingest.retryEvent
  payments.ts        payments.recordApi (public, INGEST_SECRET + key hash), internal recordStripe and stripeSecret
  apiKeys.ts         MCP keys (design v4): apiKeys.list, apiKeys.create (action, returns the key once), apiKeys.revoke
  mcp.ts             the MCP server's reads (public, INGEST_SECRET + key hash): mcp.authenticate (mutation, lastUsedAt),
                     mcp.sites / summary / timeseries / breakdown / pages / visitors / journey / live
  http.ts            Stripe webhook POST /stripe/{siteId} (Convex HTTP action, Stripe SDK signature check)
  migrations.ts      backfillSources (5b, run once per deployment) + backfillSite batches; backfillPageStats
                     (design v4 Phase 6); backfillVisitorTotals (design v4 Phase 9)
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
  lib/secret.ts      checkSecret (INGEST_SECRET), shared by ingest, payments and mcp
  lib/keys.ts        newKey, sha256Hex (payments and MCP keys), MCP_KEY_PREFIX
  lib/mcp.ts         strict parsing of the MCP tools' range and filters arguments
  *.test.ts          convex-test suites
src/
  proxy.ts           clerkMiddleware; everything protected except /, /sign-in, /sign-up, /api/collect, /api/payments, /api/mcp, /script.js; signed-in visitors on / go to /websites
  app/layout.tsx     ThemeProvider (outer) > ClerkProvider (afterSignOutUrl /, sign-in fallback /websites) > ConvexClientProvider
  app/billing/page.tsx          account mode, "Billing is coming soon" card (static)
  app/settings/page.tsx         account mode > client AccountSettings (email, Manage account, theme, Sign out)
  app/page.tsx       public splash page (static server component, no Convex); LogoMark is shared with TopBar
  app/websites/page.tsx         card grid (Suspense > client Websites; ?add=1 opens the add form)
  app/sites/[domain]/page.tsx   site dashboard (Suspense > client SiteDashboard)
  app/sites/[domain]/settings/page.tsx   sidebar of sections in ?section= (Suspense > client SiteSettings)
  app/sites/[domain]/users/page.tsx  Users tab (Suspense > client UsersView, with the visitor drawer); /customers and
                                     /visitors/<id> redirect here (next.config)
  app/sites/[domain]/live/page.tsx       live map and feed (Suspense > client Live)
  app/sign-in, sign-up   Clerk components inside <Suspense>
  app/api/collect/route.ts   ingest endpoint
  app/api/payments/route.ts  payments API (Bearer key, real status codes)
  app/api/mcp/route.ts       MCP endpoint (Bearer vamcp_ key, 401s, then the SDK's createMcpHandler); server.ts has the tools
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
  components/customers/   VisitorProfile, VisitorAvatar, Source
  components/users/       UsersView (All visitors table)
  components/live/        Live (online count + feed), LiveMap (MapLibre, one dot per visitor)
  lib/format.ts      number, duration, share, date, country name and flag formatting, truncateMiddle
  lib/snippet.ts     appOrigin, embedSnippet
  lib/collect.ts     parsePayload, normalizeReferrer, normalizePath, detectDevice, requestHostname, parseGeo
  lib/payments.ts    bearerKey, parsePaymentBody
  lib/names.ts       re-exports convex/lib/names.ts: persona ("brown fox", emoji, colour) and displayName
                     (adapted from minilytics, MIT); in convex/lib so the Users search can match personas
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
Checks at the end of design v4 Phase 7: the same four clean, `npm test` 449 tests passing (7 new: `script.test.ts` for the title on a page load, whitespace and the 200-character cut, no title, and an SPA change before and after the app sets its title; `collect.test.ts` for reading and dropping titles; `pages.test.ts` for a new title, a replacement, a blank and a missing one not overwriting, the stored row and search by title; `lib/pages.test.ts` for title search and rows). The minified script is 2,079 bytes gzipped. On `next dev` (Convex dev, `npm run build:script` run first):
- Curl hits through `/api/collect` to `localhost`: `/v4p7/titled` with "  First   title " stored "First title"; `/v4p7/renamed` with "Old name", then "New name", then a blank title and then none kept "New name" (`npx convex data pageTitles`: two rows, `updatedAt` from the "New name" hit); `/v4p7/untitled` without a title got no row. These pageviews are now in the dev data.
- Loading `/test.html` in Chrome sent its real title through the script.
- The Pages tab on Today: "New name" over `/v4p7/renamed`, "Tracking script test" over `/test.html`, and older pages (`/`, `/v4p5/page-…`) with the path alone. Searching "TRACKING" gave only `/test.html`, and "first" only `/v4p7/titled`. In a 375px frame (dark): titles and paths truncate in the first column, no sideways scroll, and the table scrolls in its card (760 px in 341).
Not checked: light mode with titles, a real phone, and an SPA site's titles on a real route change (covered by `script.test.ts`).
Checks at the end of design v4 Phase 6: the same four clean, `npm test` 442 tests passing (9 new: `pageStats.test.ts` for a bounce, a multi-page session, a goal, pings across midnight and a cookieless ping at ingest; the backfill against live ingest across the cutoff (a session and a ping that straddle it), entries and bounces against the daily stats, a second run and a site with no new traffic; `pages.list` sessions, change, bounce, duration and tiles, rollup and filtered; one more `lib/pages.test.ts` for the new columns, null sorting and `comparable`). On dev:
- `npx convex run migrations:backfillPageStats` marked all four dev sites. A script over the dev tables (`npx convex data`) hand-counted every page row from the raw sessions and pageviews: 88 rows, 0 differences. For every site and day, page entries = the day's sessions, page bounces = its bounces, and page time and count = its `durationSumMs` and `durationCount` (e.g. `localhost` 27 Oct: 9 entries, 4 bounces, 235,000 ms over 6 pageviews; page sessions 12, since multi-page sessions count on each page).
- `next dev` in Chrome, `localhost`, 30d: tiles 62 pages, 112 pageviews, 77 sessions, 90.9% bounce (70 of 77), 40s (319 s over 8 pageviews); `/` 22 sessions, 86%, 35s and `/pricing` 3 sessions, 0%, 58s. 28 Oct alone: Pageviews 3 with a red −82.4% "vs previous". 7d with `f=device:desktop`: the filtered tiles and rows; sorting by Duration put `/pricing` 1m 30s first and pages without time last (`aria-sort` descending). The loading state shows skeleton tiles and rows.
- Cookieless dev `advancedortholabsf.com` on 14 Oct: Sessions and Avg. bounce "–", Avg. duration 52s; rows show "–" for sessions and bounce, `/about` 52s.
- Light at full width, and light in a 375px frame: tiles go two per row with Avg. duration full width, no sideways scroll, and the table scrolls in its card (760 px in 339).
Not checked: a sessions change in the browser (no dev page has sessions on two comparable days; it's covered by tests), dark at 375px, and a real phone.
Checks at the end of design v4 Phase 5: the same four clean, `npm test` 433 tests passing (12 new: `lib/pages.test.ts` for the trend score, sorting, search and paging; `pages.test.ts` for ownership, the rollup counts against `stats.breakdown`, filters against `stats.filtered`, the 90-day notice and Today against `stats.hourly`). On `next dev` (Convex dev) in Chrome, `localhost`, after 45 more curl test pageviews to `/v4p5/page-1` … `-45` (from France, today; now in the dev data):
- From Analytics on 30d, the Pages tab link was `/pages?range=30d`, and with `f=country:DE` both the Analytics and Pages links kept it (Live, Customers and Settings don't).
- Before the test hits, the table's Views and Visitors matched the Analytics Pages card under Pageviews and Visitors for all 17 pages (/ 28 and 27, /pricing 16 and 8, /test.html 9 and 2, the rest 1). Pages with no visitors (see Decisions) are in the table and not in the card's Visitors list.
- With 62 pages: "1–50 of 62", Next gave "51–62 of 62" with Next disabled. Sorting Page went A–Z (`aria-sort` ascending) and Z–A, Trend put today's new pages first, and changing the sort went back to the first rows. Searching "BLOG/POST" gave 6 rows ("1–6 of 6"), and "zzz" said "No pages match “zzz”."
- `f=country:DE`: one row, / 9 at 100%, with the chip and the tracking note. Today: 47 pages counted per hour. 1–10 Sep: "No pageviews in this range." 12m with a filter: the 90-day notice.
- Dark at full width, and light in a 375px frame: the page doesn't scroll sideways, and the table scrolls inside its card (640 px in 341).
- Analytics after the refactor: the card metric still goes to `?metric=` without a history entry, and 7d still changes the range.
Not checked: a real phone, and revenue values (every page shows "–", see Decisions).
Checks at the end of design v4 Phase 4: the same four clean, `npm test` 421 tests passing (no backend changes, no new tests: the map is drawing code over the existing country list). On `next dev` (Convex dev) in Chrome, `localhost`, 90d, after 17 curl test hits with `x-vercel-ip-country` (DE 9, GB 4, JP 2, BR 1, SG 1; they're now in the dev data):
- The Map tab showed bubbles for exactly the Countries list minus Unknown (DE, GB, JP, NO, BR, SG, US). Radii under Visitors: DE 24, GB 18, JP 14.5, the 1-visitor countries 12. Under `?metric=pageviews` Norway grew to 16.4 (more pageviews than visitors), the others kept their order.
- Hovering Germany showed "🇩🇪 Germany · 9 visitors". Clicking it set `f=country:DE`, and the map then showed only Germany, outlined in the foreground colour.
- Dark and light both read (light dots raised to 25% after a first look). In a 375px frame: no sideways scroll, the map is 301 px wide in a 160 px box, and the tooltips for Japan (right) and the US (left) stayed inside the card.
- On a production build (`next start -p 3001`), the map chunk (24 KB, 4.5 KB gzipped) was not fetched until the Map tab was clicked. `next dev` fetches it up front, so check lazy loading on a build. No console errors.
Not checked: a real phone, and revenue sizes (only Unknown has revenue on dev, so the map is empty under Revenue).
Checks at the end of design v4 Phase 3: the same four clean, `npm test` 421 tests passing (7 new: `lib/dims.test.ts` for `listCount`, `rankEntries` by metric and `topEntries`; one each in `stats.test.ts` and `filtered.test.ts` re-ranking real results by each metric; one rollup test updated, see Decisions). On `next dev` (Convex dev, `convex dev` pushing) in Chrome:
- `localhost`, 30d: every card's label read Visitors and Pages ranked `/` 10 over `/pricing` 8. One click on the Sources label switched all four cards within 300 ms. Pages went to `/pricing` 16, `/` 11; Countries to Unknown 46, Norway 3; Devices to Desktop 30, Mobile 20; Sources stayed on Visitors and its button said "this list has no pageviews". The URL gained `metric=pageviews` with no new history entry.
- Enter on the focused button moved to Revenue: Sources showed only `test $64`, Countries only Unknown $64 (zero rows gone), Pages kept Pageviews and Devices Visitors. The button's name reads e.g. "Showing revenue. Switch every card to visitors".
- Reloading `?metric=pageviews&f=device:mobile` kept Pageviews, and the filtered lists re-ranked (Pages `/` 4, `/pricing` 2; Countries Unknown 9, Norway 3, US 1). On the Map tab under Pageviews, Norway was shaded brighter than the US.
- `example.com` (no revenue): `?metric=revenue` read as Visitors, and the label cycled Visitors → Pageviews → Visitors.
- A 375px frame in light, with Pageviews: no sideways scroll; Countries' "More" sits tight against the label.
Not checked: dark at 375px with this change, and a real phone.
Checks at the end of design v4 Phase 2: the same four clean, `npm test` 414 tests passing (no backend changes). On `next dev` (Convex dev) in Chrome, `localhost`:
- 30d with the default series (dark): blue Visitors bars, the light-blue Pageviews line, and a green Revenue bar beside Visitors on 27 Oct. The y axis shows 0–24. The tooltip on 27 Oct read Visitors 8, Pageviews 17, Revenue $64.00 with matching swatches. With all seven series stored, it listed Conv. rate 12.5%, Bounce rate 44.4% and Visit duration 26s after those, in grey.
- Clicking Visitors hid its bars and greyed its dot, and clicking it again brought them back.
- With `test-signup` set as a temporary key goal (cleared afterwards): purple bars beside the blue and green ones on 27 Oct, a purple dot on the "Test Signups" tile, and "Test Signups 3" in the tooltip. Checked in light too.
- Today (hourly), after two loads of `/test.html`: one Visitors bar and the Pageviews line at 12:00, the same composition as the day ranges.
- In a 375px frame (dark): no sideways scroll and the bars draw. Over 30 days they are thin (about 2 px each with three series).
Not checked: Yesterday and 24h with traffic (no dev hits then; they use the same component as Today), light at 375px, and a real phone.
Checks at the end of design v4 Phase 1: the same four clean, `npm test` 414 tests passing (no backend changes). On a local production build (`next start -p 3001`, Convex dev) in Chrome:
- On `/sites/localhost?range=30d` in dark, the page background measured `rgb(10,10,10)` and all 18 visible borders and the card ring measured `rgb(31,31,31)` (`#1f1f1f`). Setting `--line` to red on `<html>` turned all 18 red. In light they measured `rgb(229,229,229)`.
- No Filter button, and no Events or Funnels card. Clicking Google under Sources set `f=source:Google`, showed the chip and outlined the row.
- The user button showed "MS" only (a 28px circle), and the open menu showed "Signed in as" and the email.
- `/websites`, `/websites/new`, `/settings`, site Settings, Customers and Live read well in light and dark. The Live map tiles don't paint in the automation tab (as in 5h), but its frame and feed do.
- In 375px frames the dashboard and `/websites` had no sideways scroll (dark). The stored theme was left on `dark`.
Not checked: every page at 375px in light, and a real phone.
Checks at the end of design v3 Phase 6: the same four clean, `npm test` 414 tests passing (no backend changes). On `next dev` (Convex dev) in Chrome:
- The empty case was checked by forcing the list empty in code for the test, then reverting. `/websites` went to `/websites/new` with one history entry (a replace) and no site card rendered at any point (polled every 15 ms). The step 1 card showed with no Cancel.
- With the code back as committed, `/websites` showed the grid and `/websites/new` showed Cancel, linking to `/websites`.
Not checked: a real empty account (that needs a throwaway Clerk user or deleting the dev sites), and the onboarding page at 375px. Phase 6 only removes the Cancel button, so step 1's layout is otherwise unchanged from Phase 4.
Checks at the end of design v3 Phase 5: the same four clean, `npm test` 414 tests passing (4 new in `convex/sites.test.ts` for `sites.hasPageview`: missing or someone else's site gives null, no hits gives false even when another site has hits, and a cookieless hit and a hit with visitor ids both give true). On a local production build (`next start -p 3001`, Convex dev) in Chrome:
- `?site=example.com` showed step 2 with "Waiting for your first event…" and Skip to dashboard. A curl of one cookieless pageview to `/api/collect` flipped it to "First pageview received" without a reload. The stepper ticked both steps, the panel ticked all three, and Go to dashboard appeared, linking to `/sites/example.com`.
- Copy wrote exactly the snippet shown (checked by stubbing `navigator.clipboard.writeText`) and the button read "Copied".
- `?site=not-mine.example` showed step 1.
- `/sites/example.com/settings` showed the same snippet block, in light.
- In 375px frames (light) step 2 stacked the panel under the card with no sideways scroll. The stored theme was set back to `dark`.
Not checked: the waiting state at 375px and in light (only the received state), and a hit from `/test.html` in a browser (the curl takes the same `/api/collect` path).

**`example.com` on the dev deployment now has one test pageview** (`/`, cookieless). Delete the site from its Settings if you don't want it.
Checks at the end of design v3 Phase 4: the same four clean, `npm test` 410 tests passing (no backend changes); `/websites/new` builds as static. On a local production build (`next start -p 3001`, Convex dev) in Chrome:
- `/websites?add=1` showed the plain grid, and both "Add website" and the switcher's "Add site" opened `/websites/new` with the field focused and Create disabled.
- `https://www.example.com/path` previewed "We'll track example.com". `not a domain` showed no preview and kept Create disabled.
- `localhost` showed "localhost has already been added" inline, with the field outlined in red and the text kept.
- Creating from the full URL stored `example.com` with America/Los_Angeles (the browser's) in its Settings. The URL became `?site=example.com` and step 1 was ticked.
- `?site=not-mine.example` showed step 1, and Cancel went back to `/websites`.
- In 375px frames both steps stacked the panel under the card with no sideways scroll, in light and dark.

**The dev deployment now has a test site, `example.com`** (no hits). Delete it from its Settings if you don't want it in the grid; Phase 5 can use it for the first-hit check.
Checks at the end of design v3 Phase 3: the same four clean, `npm test` 410 tests passing (5 new for `initials`). On a local production build (`next start -p 3001`, Convex dev) in Chrome: the trigger showed "MS" and the owner's email on `/websites` (dark) and `/sites/localhost` (light). The menu opened downwards, aligned to the end, and read well in both. With the keyboard, Enter opened it, the arrows moved through the items and Enter on Settings opened `/settings`. Escape closed it and put focus back on the trigger. In 375px frames both pages showed only the 32px circle and had no sideways scroll. There were no console errors. Not checked: Sign out (it would sign the owner out of the automation browser). It calls the same `signOut({ redirectUrl: "/" })` as the Settings page.
Checks at the end of design v3 Phase 2: the same four clean, `npm test` 405 tests passing (no backend changes); `/billing` and `/settings` build as static and redirect to sign-in without a session. On a local production build (`next start -p 3001`, Convex dev) in Chrome: `/websites`, `/billing` and `/settings` showed the logo, "Analytics" and the account tabs with the right one underlined and `aria-current`, and no switcher; `/sites/localhost` still showed the switcher, "0 online" and its four tabs. On Settings, Light survived a reload (stored `light`), System stored `system` and followed the OS (dark), and Manage account opened Clerk's profile dialog. In 375px frames all three pages had no sideways scroll in light and dark. The stored theme was set back to `dark` afterwards. Not checked: the Sign out button (it would sign the owner out of the automation browser).
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
- **The section `visitors` is now `analytics`** (`sitePath(domain, "analytics")` is still `/sites/[domain]`). "All sites" left the tab row (it's in the switcher and the logo). The site tabs dropped their lucide icons, then (2026-11-02, owner's request) got icons back from Nucleo's Micro Bold set, as in piqo: chart-line, page, users, radio and gear, inlined as SVG in `src/components/NavIcons.tsx` (Nucleo is a paid licence, so there is no package; copy any new ones from nucleoapp.com/app). The account tabs have none.
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

### Design v4, Phase 17 (MCP server)

- **SDK**: the official TypeScript SDK v2, `@modelcontextprotocol/server` 2.4.0 (with `zod` 4 for the tool schemas), rather than `mcp-handler`. `createMcpHandler` builds one server per request and serves both the 2026-07-28 revision and 2025-era clients (initialize, then tools/call) through its stateless fallback, so nothing is kept between requests and it runs as a plain Vercel function. GET and DELETE answer 405 (no sessions). There is no `export const runtime`: Cache Components forbids it, and Node.js is the default.
- **Auth, per request**: the route reads `Authorization: Bearer vamcp_<48 hex>`, hashes it (SHA-256, `node:crypto`) and calls `mcp.authenticate` (INGEST_SECRET + hash). Missing or malformed → 401 "Missing or malformed API key"; unknown or revoked → 401 "Unknown or revoked API key" (both with `WWW-Authenticate: Bearer`). Then every tool's `mcp.*` query checks the key again, so a key revoked mid-request fails its next tool call. Only the hash ever leaves the route. `lastUsedAt` is written by `authenticate` when it's a minute or more old.
- **Keys** are account-wide (they read every site the owner has), named, shown once, and start with `vamcp_` so they can't be confused with a site's payments key (`va_`). Settings shows the first 12 characters as the prefix. At most 20 active keys per account; names up to 60 characters. Revoking sets `revokedAt` (the row stays) and drops the key from the list. Revoke asks for a second click, not a dialog.
- **No second copy of the maths**: `stats.summary`, `timeseries`, `breakdown`, `goals`, `conversions`, `live`, `online`, `liveFeed`, `pages.list`, `visitors.list` and `visitors.profile` are now thin queries over exported `site*` / `pageList` / `visitorList` / `visitorProfile` helpers that take the resolved site. The UI resolves it with `requireSite` (Clerk), MCP with `ownedSite(ctx, ownerId, domain)` from the key's owner (`lib/auth.ts`; `findOwnedSite` uses it too). Someone else's domain and a missing one both give "Site not found".
- **The tools pick the same view as the dashboard**: day ranges without filters read the rollups; today, yesterday and 24h, and day ranges with filters, go through `filteredView` (hourly or daily window), with the 90-day filter limit. Sites that never sent a visitor id ignore filters, as the dashboard does, and the result says so in `note`. `get_breakdown` ranks with `rankEntries` (the cards' metric toggle; optional `metric`) and returns 20 rows by default (`limit` up to 100); `channel: "AI"` is the Sources AI tab.
- **Stricter arguments than the URL**: an unreadable range or filter is an error naming the grammar, instead of the URL's silent fallback to 7d, so an assistant never gets numbers for a range it didn't ask for. Missing range means 7d. Hour ranges use the exact clock (the dashboard snaps it to 5 minutes).
- **Compact results**: JSON text without whitespace, the UI's shapes trimmed: revenue fields only on sites with revenue, goal and conversion series only where they apply, no per-page sparkline in `get_pages`, and `get_live` keeps 25 feed rows. Every result echoes `domain`, `timezone`, `range` (`param`, `from`, `to`, `granularity`, plus ISO `start`/`end` for hour ranges) and `filters`. Revenue is in minor units, times are Unix ms; the server's `instructions` say so. Errors (ConvexError) come back as tool errors (`isError`) with the message.
- **Setup snippets**: Claude Code `claude mcp add --transport http analytics <origin>/api/mcp --header "Authorization: Bearer <key>"`; Claude Desktop through `npx mcp-remote` (Desktop's config file only runs local commands), with the header in an env var; Cursor's `mcp.json` with `url` and `headers`. A key created on the page fills them in; otherwise they say `<your-key>`. The origin is `appOrigin()`, so production snippets use the Vercel production URL.
- **Sidebar**: Integrations (MCP server) sits between Privacy and Filtering, as in piqo. The account card is below Theme; the account column grew from `max-w-xl` to `max-w-2xl` for the code blocks.
- **Out of scope, as the PRD says**: OAuth (so claude.ai web connectors can't use it yet), write tools, per-site keys.
- **Checks:** on dev against `next dev`: no key and a wrong key → 401; `initialize`, `tools/list` and `tools/call list_sites` → 200 with the owner's four dev domains; every tool called, and `get_summary` for 30d and for `device:mobile` matched `stats.summary` and `stats.filtered` exactly; someone else's domain → "Site not found"; a bad range or filter → a tool error. Created a key in Settings, used it (Last used <1m ago), revoked it (next request 401). Both test keys made on dev are revoked. Looked at both sections in dark and light and at 375px in an iframe (no sideways scroll; the code blocks scroll inside). Theme left on dark.

### Design v4, Phase 16 (ignore my visits)

- **The flag** is `localStorage._va_ignore = "1"`, set by `?_va_ignore=1` and removed by `?_va_ignore=0` (any other value changes nothing). It is read right after the local-host and `webdriver` checks, before anything else runs, so an ignored browser sends nothing: the script returns before the pageview, the click and history listeners and the `window.analytics` API. It also deletes `_va_vid` and `_va_sid`, like `sa_ignore`. localStorage is per origin, so `www.` and the apex, and each subdomain, need the link opened separately; the section says so.
- **Undo tracks the same page load**: `?_va_ignore=0` clears the flag and the script carries on, so that pageview is counted (its query string is never sent). That is the simplest reading of "the undo link resumes tracking".
- **Blocked localStorage** (some private modes): the flag can't be stored, so the page is tracked as before. There is no cookie fallback, to keep the cookieless promise.
- **The links**: `https://<domain>/?_va_ignore=1` and `=0` (`ignoreUrl` in `src/lib/snippet.ts`), opened in a new tab, with Copy. The dev `localhost` site points at this app's `/test.html` instead, since that's where its snippet runs. A site served only on `http://` would need the link edited.
- **No confirmation on the site.** The script stays silent (no banner or console line), to stay small. To check it worked, look in DevTools → Application → Local Storage for `_va_ignore`, or in the Network tab for no `/api/collect` requests.
- **Checks:** in Chrome at desktop width in dark and light, and at 375px in an iframe (no sideways scroll; the links truncate, Copy copies the whole URL). On dev, `/test.html?_va_ignore=1` set the flag, and that load, a reload, `data-goal` and outbound `element.click()`s and a `pushState` sent no `/api/collect` request; `/test.html?_va_ignore=0` cleared the flag and sent the pageview (200) and the page's queued goal. The flag was left cleared and the theme back on dark; no site settings changed.

### Design v4, Phase 15 (visitor identity)

- **The reply**: `ingest.pageview` now returns `{ cookieless }` for every pageview of a known site (also excluded, repeated and dropped-legacy ones) and `null` for an unknown site or foreign hostname; the route turns that into a `200` `text/plain` body of `cookieless` or `cookies`. Every other hit, bot and error still gets the 204. Only pageviews carry the reply, since beacons can't read one.
- **Script transport**: pageviews now go by `fetch` (`keepalive`, a simple CORS request with no preflight; `Access-Control-Allow-Origin: *` lets the script read the body) and pings, goals, outbound clicks, identify and claims still go by `sendBeacon`. Without `fetch` a pageview falls back to a beacon and simply gets no reply. An empty reply (an older server, a 204, a network error) changes nothing.
- **Sensible default: a localStorage flag.** To meet "sends no ids afterwards" across page loads, the script must remember the mode, so on a `cookieless` reply it deletes `_va_vid` and `_va_sid` and sets `localStorage._va_nc = "1"` (no id, just the mode). Later page loads start cookieless. A `cookies` reply removes the flag; that page load stays cookieless and the next one sets cookies ("resumes on the next visit"). The very first hit from a browser that has never seen the reply still sets the cookies and sends ids; ingest strips them and the reply deletes them. The section says this, and that `data-cookieless` on the snippet is the zero-storage option from the first hit. If localStorage is blocked, each page load clears its cookies after its first pageview instead.
- **`data-cookieless` wins**: with the attribute the script never writes cookies or the flag, whatever the reply. Ingest treats a site's setting like the attribute for the 7-day legacy rule, so cookieless hits are never dropped as "old script" hits.
- **What is not changed**: stored data. A site switched to cookieless keeps its `trackingStartedAt`, so the dashboard still shows the session tiles and Users still lists earlier visitors; new days show sessions and bounce as 0 and visitors by the unique-visit rule. Switching back resumes ids per visitor on their next page load (new visitor ids, since the old cookies were deleted).
- **Sidebar**: Privacy (Visitor identity) sits between Attribution and Filtering, as in the piqo screenshot. Tracking code and Goals now point at the setting instead of only `data-cookieless`, and the Users tab's cookieless note names both.
- **Checks:** in Chrome at desktop width in dark and light, and at 375px in an iframe (no sideways scroll). On dev, set the `localhost` site to Cookieless, loaded `/test.html`: no `_va_` cookies afterwards, `_va_nc` set, and a curl-style hit carrying ids was answered `200 cookieless` and stored without ids. Switched back to Cookies: the next load cleared the flag and the one after set both cookies. The setting is back to Cookies (field cleared); the test pageviews (`/test.html`, `/p15-check`) stay on dev.

### Design v4, Phase 14 (page path grouping)

- **Named patterns** (`convex/lib/paths.ts`) are paths whose `:name` segments match any one non-empty segment and whose other segments match exactly, with the same number of segments (so `/orders/:order_id` doesn't cover `/orders/1/items`). Each needs at least one `:name`, starts with `/`, has no spaces, `?`, `#` or `*`, and is at most 200 characters; stored normalised (no trailing or repeated `/`) and deduped, at most 50. A path that matches is stored as the pattern itself, so auto-detection doesn't run on it.
- **Auto-detection** works per segment: a UUID, 6 or more digits, 16 or more hex characters, or 16 or more letters and digits with at least one of each (base64-ish ids, Convex ids). A sensible default the PRD left open: **segments containing `-` or `_` (other than UUIDs) are treated as slugs and never grouped**, so `/blog/how-to-install-v2-guide` is safe; ids with dashes or underscores (some nanoids) need a named pattern. A run of 16+ plain letters (a long word) is never grouped either.
- **Placeholder**: `:` plus a name of letters, digits and `_` (starting with a letter or `_`), at most 40 characters. A missing `:` is added and an empty field means `:id`.
- **Order at ingest**: excluded paths match the path as sent, then grouping rewrites it, as the plan says. Goals and outbound clicks on a pageview stored earlier are checked against its stored (possibly grouped) path, so an excluded pattern written against raw ids won't catch an old grouped pageview's later events. Pings, durations and events use the stored path, so they land on the grouped row.
- **Storage**: `sites.pathGrouping` is `{ enabled, placeholder, patterns }`; saving the defaults (off, `:id`, no patterns) clears the field. Separate query and mutation, like Phase 13. Turning grouping off keeps the placeholder and patterns.
- **The switch** is a native checkbox with `role="switch"`, as in the piqo screenshot. The preview runs `normalizePath` (what `/api/collect` does: no query or trailing slash) and then `groupPath` with the unsaved form values, so it shows what ingest would store once saved; with the switch off it shows the path unchanged and says so.
- **Gotcha:** a grouped row's "open the page" links (the Pages drawer's URL, the Pages card's arrow) point at the grouped path, e.g. `/orders/:id`, which isn't a real page.
- **Checks:** in Chrome at desktop width in dark and light, and at 375px in an iframe (no sideways scroll). Saved a named pattern on the dev `localhost` site and sent three hits through `/api/collect`: they were stored as `/dashboard/:site_id/sites` and `/orders/:id` twice, as the preview showed. The setting was then cleared (the three test pageviews stay on dev).

### Design v4, Phase 13 (excluded paths)

- **Glob rules** (`convex/lib/paths.ts`): `*` matches any characters, slashes included, so `/admin/*` covers every page under /admin at any depth, and a trailing `/*` also matches the bare prefix (`/admin` itself). A pattern without `*` matches that path exactly. Trailing slashes are ignored on both sides, matching is case-sensitive (paths are), and `/*` excludes the whole site. There is no separate `**`; runs of `*` collapse to one.
- **Valid patterns** start with `/`, have no spaces, `?` or `#` (the stored path has no query), and are at most 200 characters. They are stored normalised (no trailing slash, no repeated `/` or `*`) and deduped, at most 50 per site. The form validates on Add with the same function, and the mutation refuses the whole save with "`<pattern>`: `<reason>`".
- **Where the drop happens:** in `ingest.pageview`, right after the site lookup (the lookup is in Convex, so `/api/collect` has nothing to match against; the route is unchanged and the shared pure function is used by Convex and the Settings form). Nothing is written: no pageview, session, visitor, rollup, or the site's `sourcesStartedAt`. Pings, duration beacons and events for that pvId then find no pageview and are dropped as for any unknown pageview (events after their one retry).
- **Pageviews stored before the pattern was added:** their later goals and outbound clicks are dropped too (checked against `pv.path`); their pings still add time to the stored pageview, and identify and Stripe claims still apply, since those link people and payments rather than count the page. A gotcha: identify or a Checkout success page on an excluded path is lost, because its pageview is never stored, so don't exclude your sign-in or success pages.
- **Separate query** `sites.excludedPaths` / mutation `sites.setExcludedPaths` (like `revenueSettings`), rather than another field on `sites.get`.
- **The section** is the only Filtering entry for now (Page paths and Ignore my visits come with Phases 14 and 16). The form stays mounted across a save, so "Saved" stays visible; edits made elsewhere while it is open don't reset it.
- **Checks:** in Chrome at desktop width in dark and light, and at 375px in an iframe: invalid input shows its message, Add and remove work, Save enables only on a change, a reload shows the saved list, and no sideways scroll. The dev site was left with no patterns.

### Design v4, Phase 12 (settings sidebar layout)

- **Only built sections are listed**: Install (Tracking code, Timezone), Attribution (Goals & conversions, Revenue attribution) and Danger zone. Integrations, Privacy and Filtering have no sections yet, so their group headings are left out too; each later phase adds its entry to `GROUPS` in `SiteSettings.tsx`.
- **An unknown or not-yet-built `?section=`** (for example Phase 9's `?section=identity` link from a cookieless Users tab) opens Tracking code, whose description already explains `data-cookieless`. Phase 15 makes that link land on Visitor identity.
- **Section titles follow the sidebar** ("Embed snippet" → Tracking code, "Goals" → Goals & conversions, "Revenue" → Revenue attribution, "Delete website" → Danger zone with a "Delete this site" block). The type-the-domain confirm form stays, rather than piqo's single "Delete site…" button.
- **Navigation:** the sidebar items are links (`aria-current` on the open one, `scroll={false}`), so each section change is a history entry and Back returns to the previous section. On phones (below `md`) the sidebar is hidden and a native select with one optgroup per group takes its place; changing it pushes the same URL.
- **Links in:** the Goals card's "Set up goals" used `settings#goals` (no anchor any more) and now opens `?section=goals`; the Users tab's Customers hint (connect payments or pick a key goal) opens `?section=revenue`.
- **Attribution is hidden (2026-11-02, owner's request):** the group has `hidden: true` in `GROUPS`, so Goals & conversions and Revenue attribution are left out of the sidebar and the phone select. They still open by URL (`?section=goals`, `?section=revenue`), so the Goals card's "Set up goals" link and the Users tab's revenue hint keep working. Remove the flag to bring the group back.
- **Only one section is mounted at a time**, so unsaved edits in a section are dropped when you switch sections (each form has its own Save, as before).
- **Checks:** in Chrome at desktop width in both themes, and at 375px in an iframe (the window would not resize below its minimum): the select shows, every section switches through it with the URL following, and the page has no sideways scroll.

### Design v4, Phase 11 (visitor drawer)

- **`visitors.profile` extended, not replaced:** `pageviews` and `engagedMs` are the visitor's totals (Phase 9's fields, or the listed sessions' sum for a visitor the backfill hasn't reached), `events` counts goals and outbound clicks over the latest 2,000 events (`moreEvents` adds a "+"), `firstVisit` is the oldest session's entry page, source and start (read separately when it is beyond the 50 listed), each session has `events`, and goal items carry `props`. Identify calls and checkout returns are in the journey but not counted as events.
- **Tiles:** Time on site = the visitor's total engaged time, Sessions = lifetime sessions, **Pages = lifetime pageviews** (the same number as the header; piqo's demo shows a different figure but distinct pages would mean reading every pageview), Events as above.
- **Journey order:** newest session first, as in the reference, but numbered in the order they happened (the latest is "Session N", the first visit "Session 1"); the old profile listed them oldest first. Within a session items stay in time order. **Entry** marks the first pageview and **Exit** the last, only when every pageview of the session is listed (up to 100); a one-page session gets both. Goals show "goal", outbound "click", payments "payment"/"refund" on the right, and goal properties as `key=value` under the name.
- **Header** also keeps what the old profile had and the reference doesn't: the identify() email / user id and the total paid (green), when known. Location, device and first/last seen moved into the sessions and First visit block.
- **Not found:** a visitor that isn't on this site (unknown id, another site's, or an id over 100 characters, which the query would reject) shows "Visitor not found" in the drawer; the Users page behind it is unchanged.
- **The drawer** follows the page drawer: shadcn `sheet`, `?visitor=` replaces the history entry, the open row is highlighted, and `finalFocus` returns focus to the row's name button (`data-visitor-row`, which replaced the name link). Focus starts on a wrapper of the header and body, not on the body, because focusing the body of a long journey scrolled the header out of view. While loading the title reads "Visitor" rather than the animal name, so identified visitors don't flash a persona.
- **Links elsewhere:** `visitorPath` (Live feed and Live map) now points straight at `/users?visitor=<id>`. `VisitorProfile.tsx` and its route are deleted; `VisitorAvatar`'s `lg` size is now 40px for the drawer header.
- **Gotcha (as Phase 8):** in a background Chrome tab the sheet's transitions don't run, so focus may not move into it. In the automated (hidden) tab, focus moved into the drawer on one open and not on others; a scripted Escape closed it and focus returned to the row each time. Worth a check by hand.

### Design v4, Phase 10 (Users header)

- **Same queries as Analytics** (`UsersOverview.tsx`): `stats.summary`, `stats.timeseries` and `stats.breakdown` on day ranges, `stats.filtered` with filters and `stats.hourly` on hour ranges, so Visitors, Pageviews and the lists are the Analytics tile and card numbers by construction. No new Convex function. A filtered range over 90 days shows the usual "Filters work on ranges of up to 90 days" notice in place of the header (the table still lists).
- **Views per visitor** = pageviews ÷ visitors, one decimal. **Avg. time on site** is per visitor: the Visit duration tile's per-session average × sessions ÷ visitors (visible-tab time over all of a visitor's sessions), with Visit duration per session in its tooltip. There is no Analytics tile with the same number. On ranges before visitor tracking started, Visitors includes old unique-flag visitors with no sessions, so time per visitor reads lower than per session there. Changes use the previous period, shown as "+x% vs previous" ("–" alone with nothing to compare, or when the previous period predates tracking).
- **Filters now narrow the header** (chips' note: "Filters narrow the tiles, chart and lists, not the visitor table"), and clicking a Sources / Countries / Devices row adds a filter, as on Analytics. The card shows the top 7 with "View all N →" (StatsCard).
- **Cookieless sites** get the header too (Visitors, Pageviews, Views per visitor and Avg. time on page, with Referrers in place of Sources), above the "No visitor ids" explanation.
- **The chart** is the page drawer's bar chart moved to `components/dashboard/CountChart.tsx` and given a `count` (visitors in `--series-visitors`, pageviews in `--series-pageviews`). The tiles are plain (not chart toggles), so the Users tiles have no dots. `Change` is exported from `StatTile`.

### Design v4, Phase 9 (Users tab and visitor table)

- **Visitor totals** (`visitors.pageviews`, `engagedMs`, `country`, `region`, `city`, `device`, `browser`, `entryPath`, `exitPath`, all optional). Ingest adds each pageview, and a new session sets the location, device, browser and entry page from its first hit (as the session stores them); every pageview moves the exit page. **Pings now also patch the visitor** (`engagedMs`): that is the only exact way to keep time on site current, and goes against 5a's "visitor rows only change on pageviews". Online now still reads sessions; the cost is one more read and write per ping, and the Users query re-runs on pings of listed visitors (it already did on pageviews).
- **Backfill** `npx convex run migrations:backfillVisitorTotals` (`--prod` for production) recounts every visitor from its sessions (newest 500 per visitor), in batches of 20 per site. It overwrites rather than adds, and ingest keeps sessions and the visitor in the same transaction, so it is safe to run twice or while hits arrive; there is no "backfilled" flag. Until it runs, older visitors show only what came in since the deploy.
- **"Seen in the range"** means a pageview between the range's start and end (site-local midnight, or the hour window on Today, Yesterday and 24h). `visitors.list` reads `by_site_lastSeen` from the start, newest first, drops those first seen after the end, and for a visitor first seen before and last seen after the range checks that a session overlapped it. "Newest first" is by last seen overall.
- **Read budget:** at most 5,000 of the range's visitors are read (`MAX_LISTED_VISITORS`). Past that the count shows "+" and a notice says the list, count and search cover the 5,000 seen most recently. Paging is by offset (50 rows), like Pages, so the count is exact below the cap.
- **Row numbers are lifetime**, not the range's: sessions, pageviews and time over every session, location, device and entry → exit of the latest session, source = first source (how they found you). Per-range numbers would need reading each visitor's sessions.
- **Customers** = paid (on a site with revenue) **or** completed the key goal (newest 5,000 completions), on a site with both together; the old page showed one at a time (`?by=goal`, now dropped by the redirect). Revenue (lifetime) is a column only in Customers mode on revenue sites. They are limited to the range like All, so the same people as the old Customers page show on a range covering them (12 months covers everything so far). A site with neither gets the old pointer to Settings.
- **Search** (server side, `convex/lib/visitors.ts`): part of the identify() name, email, animal persona, visitor id, English country name, city or latest entry/exit path, or the whole country code ("de"). `src/lib/names.ts` moved to `convex/lib/names.ts` (re-exported) so the server can match personas. Older pages of a visitor's history aren't searched (only the latest session's entry and exit).
- **Filters** (`?f=`) carry over to Users and show as chips with "Filters don't narrow the visitor table"; visitor rows have no per-session data to filter. Phase 10's header will honour them.
- **Cookieless:** a site with no `trackingStartedAt` (never sent a visitor id) gets `status: "cookieless"` and an explanation linking to `settings?section=identity` (Phase 12 adds the section; until then it opens Settings). That also covers a brand-new site with no visits, and says so.
- **Rows open the old profile page** (`/visitors/<id>`, now under the Users tab) until Phase 11's drawer. `visitorPath` moved to `TopBar` next to `sitePath`, `Source` to `components/customers/Source.tsx`, and `Customers.tsx` and its route are deleted. `visitors.customers` stays (tests, and the MCP phase may use it).
- **The table** is `min-w-[960px]` and scrolls sideways inside its card on phones (as Pages does); the page itself doesn't scroll sideways at 375px.

### Design v4, Phase 8 (page drawer)

- **`pages.detail`** (`convex/pages.ts`, `filteredPage` in `lib/filtered.ts`) runs the filtered view with `page:<path>` added to the URL's filters (not added twice if it's already there). The tiles and chart are that page's own entry of the view (its pageviews per point, distinct visitors, entries, bounces and pinged time), not the filtered dashboard's summary: with a page filter the dashboard's Pageviews tile counts every pageview of the sessions that viewed the page, which would not match the row. Bounce and Avg. time use the table's formulas (`bounceRate`, `avgDuration`). The lists are exactly the filtered dashboard's Sources, Countries, Devices and Browsers with `page:<path>` (a test checks this), shown by visitors.
- **Cookieless pageviews of the page count** in the drawer (views, time, unique visits, country/device/browser), when no other filter is set, so cookieless pages match their row instead of showing zeros. The dashboard's page filter still leaves them out, as before. On sites without visitor tracking the first list is Referrers, since sessionless hits have no source.
- **Ranges over 90 days** show "Page details work on ranges of up to 90 days" in the drawer (the filtered view's limit), as filters do on the dashboard. A rollup-only fallback (tiles and chart from the page rows) is possible but needs a key-first index on `dailyDims`; left out.
- **Where numbers can differ from the row:** unfiltered day rows come from the rollups, which count a pageview on its own day and sessions on the day of their first view of the page; the drawer counts pageviews on the day their session started (as the filtered dashboard and the chart do). They differ only for sessions that cross midnight at the range's edges. Visitors are distinct visitors over the range (the rollups' per-page visitors, which only counted a visitor's first page of the day, aren't used).
- **The drawer** is shadcn's `sheet` (Base UI Dialog): focus moves to the drawer body on open, Escape, ✕ or a click outside close it, and `finalFocus` returns focus to the row's page button (`data-page-row`), also after the drawer was opened from a reloaded URL. Opening and closing replace the history entry (as `?metric=` does), so Back doesn't close it. The open row is highlighted. The list card's "Visitors" label sits above the card, because four tabs plus the label didn't fit at 375px. Breakdowns exports `Label`, `rowIcon` and `rowHref` for the drawer's rows. Drawer rows don't filter.
- **Gotcha:** in a background Chrome tab the sheet's exit transition doesn't run, so it stays in the DOM until the tab is shown again. It closes normally in a visible tab.

### Design v4, Phase 7 (page titles)

- **The script** sends the title as `ti` on every pageview: `document.title` with whitespace collapsed, trimmed and cut to 200 characters, and nothing when it's empty. `/api/collect` (`parseTitle` in `lib/collect.ts`) cleans it the same way and drops a title that isn't a string without dropping the hit. Ingest cleans it once more, since `ingest.pageview` is public.
- **SPA route changes.** Apps usually set the new title after they change the URL, so when the script sees the route change the title is often the old page's. After a route change it sends the title only if it differs from the one sent with the previous pageview, so a stale title never lands on the new path. The cost: a page whose title stays the same as the one before it gets its title from full page loads only. A site where every page has the same title gets it on full loads.
- **`pageTitles`** (siteId, path, title, updatedAt; index `by_site_path`). The row is written only when the title changes, since most pageviews repeat it and every pageview of a busy page would otherwise rewrite the same row. A blank or missing title never overwrites. Titles are per path, not per day, so a renamed page shows its new title over its whole history. When grouping comes (Phase 14), ingest will be passed the grouped path, so titles follow it.
- **`pages.list`** rows carry `title` (null when none was ever sent). Without a search, only the 50 shown rows are looked up (50 index reads). **Search now matches titles as well as paths** (PRD story 49; Phase 5 searched paths only): with a search, the site's titles are read in one go, up to 5,000, and past that later pages are found by path only.
- **The row** shows the title over the path in small muted text, as in piqo, both truncating with the full text on hover. Untitled pages show the path alone at the normal size. The search box's accessible name is now "Search pages by path or title".
- **Nothing to backfill:** old pageviews never carried a title. Their paths pick one up from the next hit on that path once the new script is served.

### Design v4, Phase 6 (per-page rollups and backfill)

- **Page rows gain five optional fields**: `sessions` (sessions that viewed the page, counted on the day of their first pageview of it), `entries` (sessions that started there, on the session's day), `bounces` (those with one pageview and no goal), `engagedMs` and `durationCount` (pinged time and pageviews that sent any, on the pageview's day). **`entries` isn't in the plan.** The plan's bounce is "attributed to the entry page", so the rate divides bounces by the sessions that started there; dividing by every session that viewed the page would make pages people reach mid-visit look like they never bounce. Summed over a day, page entries and bounces equal the day's sessions and bounces, and page time equals the day's time on page.
- **"Per-page sessions add up to site sessions"** (the plan's check) holds for entries, not for sessions: a session that views three pages counts once on each. The Sessions tile is the site's sessions from the daily stats, not the sum of the column. (piqo's demo numbers add up, but its definition isn't stated.)
- **Ingest** (`bumpDailyDim` takes the page counts; `bumpPageDim` adds without a pageview). A session's first pageview of a path is found by reading the session's pageviews (`by_site_session`), so the reads grow with the session's length. The second pageview or a goal takes the bounce back off the entry page, as it does off the day.
- **The cutoff is per site**: `sites.pageStatsStartedAt`, set by the first pageview after deploy (as 5b's `sourcesStartedAt`). Ingest adds pings and goals only for pageviews and events from then on, and the backfill does everything before it. Bounces are counted "as of the cutoff" (pageviews and goals before it), so a session that started before the deploy and goes on after it comes out right either way. One gap: pings that arrive for a pre-cutoff pageview after the backfill has passed it are not added to its page (they still count on the day). Run the backfill a few minutes after the deploy to avoid it.
- **Backfill**: `npx convex run migrations:backfillPageStats` (add `--prod` for production), self-rescheduling batches of 200 per site, first pageviews (time and sessions) then sessions (entries and bounces). Sites are marked `pageStatsBackfilled` first, so a second run does nothing. A site without traffic since the deploy gets its cutoff from the run.
- **`pages.list`** returns `tiles` (pageviews and the previous period's, sessions, bounce rate, time on page) and `comparable`, and each row's sessions, `sessionsChange`, `bounceRate` and `durationMs`. Unfiltered day ranges read the page rows for the range and the period before (up to 10,000 more rows; past that no changes show) and the daily stats for both. Filters and hour ranges work it out from the filtered view's sessions, on the day each session started, with the filtered summary as the tiles. `stats.ts` exports `readDailyStats` and `sumTotals` for this.
- **Changes**: the sessions change is hidden when visitor tracking started in this period or the one before (as on Analytics), and when a page had no sessions before. Pageviews show their change whenever the previous period had any.
- **Visitors column removed.** The PRD's row is views, sessions with change, bounce, duration and revenue; Visitors per page only counted a visitor's first page of the day (see Phase 5). It can come back with one column entry. Sorting is on every column, and pages without a bounce rate or duration sort last either way.
- **Tiles** are a plain block (not the dashboard's chart toggles): label, number and a small grey line, "unique paths" under Pages viewed and the change "vs previous" under Pageviews (green up, red down). Sessions and Avg. bounce show "–" with no sessions (cookieless), duration "–" with no time. Search clicks (in piqo) isn't in the plan.
- **Cookieless pages** have time but no sessions, so their Sessions and Bounce show "–".

### Design v4, Phase 5 (Pages tab, first cut)

- **`pages.list`** (new `convex/pages.ts`, table logic in `convex/lib/pages.ts`) takes the range as dates or, for Today, Yesterday and 24h, as `{ period, now }`, plus filters, sort, direction, search and offset, and returns 50 rows with `offset`, `matched` (pages the search kept), `pages` (all pages in the range) and `totalPageviews` for the shares. Sorting, search and paging happen on the server, so the browser only gets the rows it shows, and every change is a new query.
- **Where the numbers come from** is what Analytics uses, so the table matches its Pages card: day ranges read the `page` rollups (up to 15,000 rows, past which a "too many pages" notice shows); filters on day ranges, and every hour range, go through the filtered view. `lib/filtered.ts` gained `filteredPages`, which returns every page (not the top 500) with its views per point, counted at its session's start as the chart does. Its `breakdown` was split so both share `breakdownEntries`. Filters on ranges over 90 days get the dashboard's notice.
- **Trend** is each page's views per day (per hour on hour ranges), drawn as a small SVG line with a dot on the last point (no chart library, 50 per page). Sorting by Trend uses the least-squares slope over the mean, so a small page that doubles beats a big one growing a little. Paths sort naturally (`/p9` before `/p10`).
- **Visitors per page are what the rollups have always counted:** with visitor ids, a visitor counts once a day, on the first page they viewed that day, so later pages in a visit show 0 visitors. The Analytics Pages card shows the same numbers. Filtered and hour views count distinct visitors per page instead (as their card does). Phase 6 adds per-page sessions, which are the better measure.
- **Revenue is "–" on every page for now.** Payments are credited to session lists (sources, campaigns, locations), not to pages, so the `page` rows carry no revenue. The column shows only on sites with payments. Crediting pages (say, the entry page) needs a rollup change and a backfill; it isn't in the plan, so it's left for you to decide.
- **Shared pieces.** `SiteShell` (top bar, sign-in, site lookup and "No site called…"), `SiteHeader` (title, range in words, range controls, filter chips and a note), `BlockedNotice` and the `useSiteRange` hook (range, filters, hour clock, `navigate`) came out of `SiteDashboard`, which now uses them too. `navigate({ set })` replaces the history entry, as the metric switch did.
- **Tabs.** `SiteSection` gained `pages`. The tabs have lucide icons (Analytics, Pages, Live, Customers, Settings) as in piqo. The Analytics and Pages links keep `?range=` and `?f=` (re-formatted through the filter helpers); the others don't.
- **Table state** (sort, search, offset) is local, not in the URL; the plan only puts range and filters there. Search waits 200 ms after typing. While the next rows load, the last ones stay on screen, faded.

### Design v4, Phase 4 (dotted world map)

- **Pre-built, as before.** `npm run build:world-map` (same script, rewritten, ~40 s) now writes `src/components/dashboard/world-dots.json` (21 KB): a staggered grid of land dots, 7 map units apart on a 960-wide Equal Earth projection, tested against world-atlas's 50m land (Antarctica and everything south of 60°S dropped). The 2,728 dots are one relative `path` of zero-length segments drawn with round caps, so the map is one DOM node. `world-110m.json` is deleted.
- **Country centres** are the centroid of each country's largest piece in world-atlas's 50m countries, so the US sits on the lower 48, France and Norway on the mainland. 50m has 235 countries, so Singapore, Malta, Bahrain and Hong Kong now get a bubble (they had no outline at 110m). Kosovo, Northern Cyprus and Somaliland map as before. Only "Indian Ocean Ter." and "Siachen Glacier" have no code and are skipped.
- **Bubbles**: `fill-series-visitors` for every metric (the plan says blue, including Revenue), with a 30% halo. Radius 6 + 18 × √(count ÷ top) map units (about 3–12 px on a desktop card). Countries without a centre, and Unknown, set no scale. Big bubbles draw first so small neighbours stay clickable, and the filtered country draws last with a foreground outline.
- **Tooltip** is a popover-styled box (flag, name, muted "· N visitors") following the pointer. It opens to the left of the pointer on the right half of the map, so it stays on the card at 375px. Bubbles aren't focusable; the Countries tab stays the accessible list, as before.
- **The map box is `min-h-40`** on phones (was 264 px everywhere), `sm:min-h-66` from 640 px up, and so is its loading block.

### Design v4, Phase 3 (card metric toggle)

- **The page ranks, not the query.** `stats.breakdown`, `stats.filtered` and `stats.hourly` take no metric. Each list returns `topEntries`: every key in the top 500 by any count a card can rank it by (the list's own count, visitors, pageviews, revenue), in the old order. `Breakdowns` re-ranks them with the shared `rankEntries(dim, rows, metric)`. Switching never re-runs a query, so the filtered view (tiles and chart) doesn't reload, and the cut-off still matches the whole list. A list can return up to four times as many rows as before on very large sites; in practice it is the same.
- **One behaviour change in the rows:** keys that only count under another metric are now returned (a referrer with pageviews but no unique visits, say). The page drops them under Visitors, as before. `stats.test.ts`'s referrer test now says so.
- **Which count a list shows** is `listCount(dim, metric)` in `convex/lib/dims.ts`. Pageviews only exist on the pageview lists (pages, referrers, devices, browsers, OS, countries, regions, cities); the rollups keep session lists at 0. Revenue only exists on sources, channels, UTM tags, ref, referrers and locations (`revenue.creditDims`). A list without the chosen count shows its own (`dimMetric`): Sources under Pageviews shows Visitors, Entry/Exit Sessions (one entry pageview each), Outbound Clicks, and Pages and Devices under Revenue show Pageviews and Visitors. The filtered view follows the same rule even where it could count more, so the numbers don't change when a filter is added. The header shows the count actually used, and its title / accessible name adds "(this list has no pageviews)".
- **`?metric=`** is `visitors` (left out of the URL), `pageviews` or `revenue`. Revenue is only in the cycle when the site's revenue source isn't None (`cardMetrics(currency)`), and a stale `metric=revenue` reads as Visitors. The change goes through `window.history.replaceState`, which Next keeps `useSearchParams` in step with: it's instant, with no server round trip and no new history entry. Ranges and filters still use `router.push`.
- **Defaults moved:** Pages now opens on Visitors (as in piqo), not Pageviews; one click gives the old view. The old per-card Visitors ⇄ Revenue switch and the `revenue` flag on cards are gone.

### Design v4, Phase 2 (bar-and-line chart)

- **Revised after review (2026-11-02):** Visitors is now a line with a blue fill like Pageviews (piqo's look); only Revenue and the key goal stay bars. The chart opens on Visitors and Pageviews only, and the stored choice moved to `dashboard.chartSeries.v2`, so earlier picks reset once. Bounce rate is a solid grey line (Conv. rate and Visit duration keep their dashes). The rate lines had gaps because a bucket with no sessions has a `null` rate and Recharts breaks the line there; they now use `connectNulls` and join across empty buckets rather than dropping to a made-up 0%.
- **Composition** (`TrafficChart`): Visitors bars and the Pageviews area share the visible count axis, so the line sits above the bars as in piqo. Revenue and the key goal keep their own hidden scales (top at 1.5× their max), so money and goal counts don't need the visitor axis. Recharts 3 groups bars by x axis, so the three bars sit side by side in a bucket even with different y axes. `barCategoryGap` is 20% and `maxBarSize` 16.
- **The rates and duration have no series colour.** The plan only names four series tokens, so Conv. rate, Bounce rate and Visit duration draw in `--muted-foreground` with their dashes, as before. An "on" dot for those tiles is grey, and "off" is a fainter grey. That matches piqo's grey dots for those tiles.
- **Tooltip order**: the payload is sorted by `SERIES_KEYS` (tile order) before it reaches `ChartTooltipContent`, since the custom content ignores Recharts' `itemSorter` and the draw order puts bars first.
- **Y-axis labels were off the canvas.** The hidden y axes (revenue, goal, rates) each took the default 60 px, pushing the visible count labels to x = −98 (that was the case before this phase too). Hidden axes now have `width={0}` and the labels show.
- **Monochrome tokens retired.** `--chart-1`…`--chart-5` and their `--color-chart-*` aliases are removed from `globals.css`. `SiteCard`'s sparkline on `/websites` moved to `--series-visitors` and `--series-pageviews`, so the cards are blue now too.
- **Known, not from this phase:** at 375px the Sources card's "More" tab overlaps the "Visitors ⇅" label.

### Design v4, Phase 1 (theme tokens and dashboard clean-up)

- **One border token.** `--line` is defined once per theme in `globals.css`. `--border`, `--input` and `--sidebar-border` are `var(--line)`, and `--color-line` (the old `border-line` alias) now reads `--line` too. shadcn's base-nova draws Card, Popover and Dropdown Menu outlines with `ring-foreground/10`, not a border, so those (and the add-website skeleton and `SiteFavicon`) now use `ring-line`. The active tab underline (`border-foreground`) is an indicator, not a border, and keeps its colour.
- **Dark palette** (sampled from the piqo screenshots): page, cards and sidebar `#0a0a0a`, popovers `#111111`, muted / secondary / accent `#1a1a1a`, text `#ededed`. Cards sit on the page colour and are told apart by their border, as in piqo. Light mode is unchanged apart from the border (`#e5e5e5`, as before, now through `--line`).
- **Series tokens** `--series-visitors`, `--series-pageviews`, `--series-revenue`, `--series-goal` (and `bg-series-*` classes): dark `#4f8fe0`, `#8fb4e3`, `#2eab7e`, `#9c7ee6` from piqo; light `#2563eb`, `#60a5fa`, `#059669`, `#7c3aed` for contrast on white. Nothing reads them yet. Phase 2 moves the chart and the tile dots onto them and retires the monochrome `--chart-*` tokens, which the chart still uses until then.
- **Share bars** use the old, unused `--bar` token, now a tint (`#141414` dark, `#f4f4f4` light) instead of `bg-muted`.
- **Hidden, not deleted.** `SHOW_FILTER_BUTTON` in `RangeControls` and `SHOW_EVENTS_AND_FUNNELS` in `Breakdowns` are `false`. With Events hidden, `stats.goals` is no longer queried from the dashboard.
- **Up / down colours** (`--up`, `--down`) are unchanged, as is the rule that lower bounce is good.

### Design v3 (summary)

- **Top bar modes.** `TopBar` takes `site` (switcher, online count, Analytics / Live / Customers / Settings) or `account` (logo and "Analytics", Websites / Billing / Settings), never both. Both tab rows share one `TabStrip`. `/websites/new` uses account mode with Websites active.
- **Routes.** `/` is a public splash page (the proxy lets it through, and redirects signed-in visitors to `/websites`). `/websites` is the grid, `/billing` and `/settings` are account pages, and `/websites/new` is the add flow (`?site=<domain>` is step 2 for a site you own). Sign out goes to `/`, and sign-in still lands on `/websites`.
- **`?add=1` is removed**, along with the inline add form. "Add website" and the switcher's "Add site" link to `/websites/new`.
- **Onboarding.** An empty site list on `/websites` replaces the URL with `/websites/new`, which hides Cancel while you have no sites.
- **First-hit query.** `sites.hasPageview` reads one raw pageview through `by_site_ts`, so cookieless hits count. `trackingStartedAt` isn't used because cookieless sites never set it.
- **User menu.** `UserMenu` (initials plus email, shadcn menu) replaces Clerk's `UserButton` in both modes. Sign out calls `signOut({ redirectUrl: "/" })`. Design v4 Phase 1 dropped the email from the trigger; it's still in the menu.

### Design v3, Phase 6 (onboarding redirect)

- **The redirect is on the client, in `SiteGrid`**: an effect calls `router.replace("/websites/new")` once `sites.listWithStats` comes back empty. While the list is loading or redirecting, the skeleton shows, so an empty grid never flashes. The "Add website" header button stays hidden then.
- **Cancel reads `sites.list`** (the switcher's light query) and only shows once the list is known and not empty. A user with sites sees Cancel appear when the query lands. That's usually immediate, since the switcher already holds the subscription.

### Design v3, Phase 5 (add website, step 2)

- **`sites.hasPageview({ domain })`** returns null for a missing or foreign site, otherwise whether one `pageviews` row exists (`by_site_ts`, `.first()`, so it reads at most one row). It reads raw hits rather than `trackingStartedAt`, which cookieless sites never set. `AddFlow` subscribes to it only once `?site=` is confirmed as yours, and passes the result to the stepper (step 3 means both ticked), `HowItWorks` (`received`) and `InstallTracker`.
- **The status row is `role="status"`**, so screen readers announce the flip. The waiting dot is a pinging green dot.
- **`Snippet` is now a shadcn-styled code block**: a header with the label and a ghost `xs` Copy button (lucide icons), then the tag in a `pre`. It has its own copy logic. `CopyButton` (react-icons, old tokens) is unchanged and still used by the goals and API blocks in Settings.

### Design v3, Phase 4 (add website, step 1)

- **The flow is `AddWebsite`** (`src/components/websites/AddWebsite.tsx`), with the panel in `HowItWorks.tsx` next to it. The step comes from `?site=`, checked with `sites.get`. A missing site, or one that isn't yours, shows step 1. While the check is loading, a skeleton card shows in place of the form.
- **The panel takes a `stage`** (`domain`, `install` or `live`) plus `received`, so Phase 5 only has to pass the first-hit result.
- **The script size in the panel is written in by hand** ("~2 KB script"; the minified build is about 2 KB gzipped). Update `HowItWorks.tsx` if the script grows; `script.test.ts` caps it at 3 KB.
- **The favicon in the field waits 400 ms after typing stops**, so it doesn't fetch `/favicon.ico` from every partial domain.
- **There is no timezone picker in the flow.** The browser's zone is used and shown in the hint. `TimezoneSelect` is now used only by site Settings.
- **`Snippet` moved to `src/components/Snippet.tsx`**, unchanged, and `AddWebsiteForm` is deleted. `/websites` no longer reads the URL, so its page dropped the `Suspense` wrapper. The empty state (until Phase 6) is a link to `/websites/new`.
- **The privacy note reads** "No personal data is sold or shared. Add `data-cookieless` to the tag to run without cookies." The screenshot's "No personal data stored" isn't true of the default script.
- **Added with the shadcn CLI:** `alert`, `input-group` (with `input` and `textarea`) and `kbd`.

### Design v3, Phase 3 (user menu)

- **`UserMenu`** (`src/components/UserMenu.tsx`) replaces Clerk's `UserButton` in `TopBar`. It follows `SiteSwitcher`'s idiom: the items navigate with `router.push` and the trigger has the same hover and open styles.
- **The initials rule is `initials()` in `src/lib/initials.ts`**. It uses the first letters of the first and last name. If only one name is set it gives one letter. Otherwise it takes the first two letters of the email's local part, so a one-letter local part gives one letter. Until Clerk's user loads, the circle shows a person icon and no email.
- **The avatar is initials only.** It doesn't show Clerk's profile image, as the plan asks.
- **The menu's links all appear in both modes**, including the account pages you are already on. Sign out calls `signOut({ redirectUrl: "/" })`, the same as the Settings page.
- **Added with the shadcn CLI:** `avatar`. It imports `cn` from the `cn` package, like the other ui files.
- **The old "hydration warning from Clerk's `UserButton`"** (an older decision note) should be gone with it. This hasn't been re-checked on the dashboard in dev.

### Design v3, Phase 2 (account tabs)

- **`TopBar` takes `site` or `account`**, never both (a union type). Both tab rows come from one `TabStrip` inside `TopBar.tsx`, with the same classes as before and an `aria-label` per row. The switcher only appears in site mode, so `SiteSwitcher`'s "no current site" case is gone; the "All sites" item in its menu stays.
- **`PageHeader`** (`src/components/PageHeader.tsx`) is the title, optional line and actions from `/websites`, now shared by Websites, Billing and Settings.
- **Manage account calls Clerk's `openUserProfile()`**, the modal profile, so no `/user-profile` route is needed.
- **The theme choice is a ToggleGroup like the range segments.** It shows no selection until the page is in the browser (`useSyncExternalStore`), because the stored choice isn't known on the server. Clicking the pressed option again keeps the theme.
- **Sign out on Settings** calls `signOut({ redirectUrl: "/" })` and uses the destructive button style.
- **Added with the shadcn CLI:** `card`.

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

Superseded by design v4 Phase 4's dotted map. The outlines and shading below are gone; the `country:map` tab and the lazy loading stay.


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

## Next: review design v4 Phases 1 to 17 (the whole plan)

This completes the design v4 plan. Owner, in both themes and on your phone, check Phases 1 to 17 below, then deploy and run the post-deploy steps at the end.

1. The dashboard: near-black page and cards, every border the same dark grey (`#1f1f1f`), no Filter button, no Events or Funnels. Clicking a row still filters and the chip still removes it.
2. The user button is just your initials, and the menu still shows your email.
3. Websites, add website, account Settings, site Settings, Customers and Live: nothing looks left behind.
4. To try the one-token rule: change `--line` in `src/app/globals.css` (the `.dark` block) and every border follows.

5. The chart on 7d, 30d, Today and 24h: blue Visitors bars, a light-blue Pageviews line, green Revenue bars beside Visitors on a site with revenue (and purple bars once a key goal is set). Click the tiles: each series hides and its dot goes grey. Hover a day: the tooltip lists each visible series with its colour.
6. `/websites`: the site card sparklines are now blue.
7. The cards: click any card's "Visitors ⇅" and every card moves to Pageviews, then Revenue (on a site with payments), then back. Rows re-rank, zero rows disappear, the Map follows, and a reload keeps it. Try it with a filter set too.

8. The Map tab (Countries card), in both themes and on your phone: a dotted world with a blue bubble per country (none for Unknown), sized by the card metric. Hover a bubble for flag, name and count, click it to filter (it gets an outline), and switch the card metric to see the sizes change.

9. The Pages tab, in both themes and on your phone: open it from Analytics (the range comes along), sort by each column, search, page through (only sites with over 50 pages have a second page), and set a filter from Analytics then switch to Pages. Visitors per page count only a visitor's first page of the day, and Revenue is "–" everywhere; both are explained under Decisions, and Revenue needs your call.

10. The Pages tab after Phase 6: five tiles above the table (Pages viewed, Pageviews with its change, Sessions, Avg. bounce, Avg. duration), and Sessions, Bounce and Duration columns in place of Visitors. Bounce is per entry page and the Sessions tile is site sessions, not the column's sum (see Decisions). Try a cookieless site: Sessions and Bounce show "–", Duration shows.

11. Page titles: after the push, visit a few pages on a tracked site, then open its Pages tab. Each visited page shows its title over its path, and pages nobody has visited since show the path alone. Search for a word from a title. Titles fill in as visitors load each page; nothing needs to be run.

12. The page drawer, in both themes and on your phone: click a Pages row and check its numbers against the row (Views, Bounce, Duration), then reload and copy the URL into a new tab (same drawer). Press Escape: focus lands back on the row. Tab to a row and press Enter to open it. Open a page with Analytics filtered by `page:<path>` and compare the Sources, Countries and Devices lists. Try 6 months (the drawer says it needs 90 days or less) and Today (hourly bars).

13. The Users tab, in both themes and on your phone: the tabs read Analytics | Pages | Users | Live | Settings, and an old `/sites/<domain>/customers` bookmark lands on Users with Customers on. The All visitors table lists people seen in the range (try Today, 7d and a custom range in the past), latest first, 50 a page. Check a few rows against their profile (click one): sessions, pageviews, time, location, device · browser, entry → exit. Toggle Customers: the people the old Customers page listed (on a range that covers them), with revenue on a site with payments. Search by a name or email, part of a visitor id, an animal name, a country ("germany" or "de"), a city and a page path. A cookieless site shows the "No visitor ids" explanation.

14. The Users header, in both themes and on your phone: four tiles (Visitors, Pageviews, Views per visitor, Avg. time on site) with a visitors chart under them on the left and Sources / Countries / Devices on the right; stacked on a phone. Compare Visitors, Pageviews and each list with Analytics on the same range (7d, 30d, Today), and the bars with Analytics' blue Visitors bars. Set a filter (click a source in the card) and check the tiles and lists follow while the table doesn't. Avg. time on site is per visitor, so it differs from Analytics' per-session Visit duration (see Decisions).

15. The visitor drawer, in both themes and on your phone: click a Users row and check the header and tiles against the row (sessions, pageviews, time). The First visit block should match the visitor's first source. Scroll the Journey: newest session on top, each with its facts line and its pages (Entry and Exit marked), goals (with properties, if your site sends any), outbound clicks and payments. Reload and copy the URL into a new tab (same drawer). Press Escape: focus lands back on the row. Tab to a row and press Enter. Open an old `/sites/<domain>/visitors/<id>` link, and click a visitor in Live: both land on Users with the drawer open. Change the id in the URL: "Visitor not found".

16. Site Settings, in both themes and on your phone: a sidebar with Install (Tracking code, Timezone), Attribution (Goals & conversions, Revenue attribution) and a red Danger zone; one section on the right with a title, description and bordered card. Click through each and reload: the same section comes back, and copying the URL into a new tab opens it. Save a timezone, a key goal and a revenue source from their sections, copy the snippet, and check the delete confirm still needs the domain typed (don't submit it). On a phone the sidebar is a select. "Set up goals" on an empty Goals card and the Users Customers hint open their sections.

17. Excluded paths (Settings → Filtering), in both themes and on your phone: try `admin/*` (refused with a message), then add `/admin/*` and `/preview/` (stored as `/preview`), remove one, and check Save changes only enables on a change. Save `/admin/*` on a tracked site, visit `/admin/anything` and `/admin` there, and check neither shows up in Live, Analytics or Pages, while `/administrator` (if it exists) does. A goal fired on an excluded page isn't counted. Stats from before the save stay.

18. Page paths (Settings → Filtering), in both themes and on your phone: the switch starts off. Type `/orders/123456` in Preview: it stays as is until you tick the switch, then reads `/orders/:id`. Change the placeholder to `order` (stored as `:order`), try `my id` (refused). Add `/dashboard/:site_id/sites` and preview `/dashboard/abc123/sites`; try `/orders` as a pattern (refused, it needs a `:name`). `/pricing` and `/blog/some-slug` stay untouched. Save on a tracked site with numeric or UUID URLs, visit two of them, and check Pages shows one grouped row (with the latest title) and Live shows the grouped path. Pages from before the save keep their own rows.

19. Visitor identity (Settings → Privacy), in both themes and on your phone: two options, Cookies selected; Save only enables on a change. On a tracked site, pick Cookieless and save, then load a page of that site: in DevTools → Application, the `_va_vid` and `_va_sid` cookies are gone after the first pageview and `_va_nc` is in Local Storage; reload and check the `/api/collect` requests carry no `vid`/`sid` (and the pageview response reads `cookieless`). Live and Users get no new visitors from it, while Analytics still counts the pageviews. Switch back to Cookies: the next page load clears `_va_nc` and the one after sets the cookies again. A site whose snippet has `data-cookieless` behaves as before. **Nothing to change in the snippets on your live sites**: they load `/script.js`, which picks up the new version on deploy (browsers may keep the old copy cached for a while, and ingest strips ids from those hits anyway). Remove `data-cookieless` from a snippet only if you'd rather control it from the setting.

20. Ignore my visits (Settings → Filtering), in both themes and on your phone: two links for the site, each with Copy, and the per-browser, per-site explanation. After the deploy, open the first link on a tracked site: in DevTools → Network no `/api/collect` requests go out on that load, on reloads, on other pages, or when you click a goal button or an outbound link, and `_va_ignore` is in Local Storage; Live shows nothing from you. Open the second link: the flag is gone and that page view shows up in Live. Repeat on your phone and on `www.` if your site uses it. Browsers may serve the old `/script.js` from cache for a while after the deploy, so reload once if the first link seems to do nothing.

21. The MCP server, after the deploy. In account Settings (Settings tab on `/websites`), in both themes and on your phone: the MCP server card. Create a key named e.g. "Laptop": it shows once with Copy (reload and it's gone; only the prefix stays in the list), and the setup below fills it in. Then in a terminal:

    ```bash
    claude mcp add --transport http analytics https://analytics-jet-zeta.vercel.app/api/mcp \
      --header "Authorization: Bearer <the key>"
    ```

    (Copy it from the card instead: it uses the app's production URL, and a custom domain once you attach one.) Start Claude Code, run `/mcp` to see `analytics` connected with 8 tools, and ask "list my sites", then "visitors on advancedortholabsf.com in the last 30 days, and top sources", "top pages this week", "who's online now". Compare a few numbers with the dashboard on the same range and filter (e.g. 30d, and `country:US`). The key's "Last used" moves (at most once a minute). Ask about a domain you don't own: "Site not found". Revoke the key: the next question fails with 401 (in Claude Code, `/mcp` shows it failed). Try Claude Desktop and Cursor with their snippets if you use them (Desktop needs Node.js for `mcp-remote`). Site Settings → Integrations → MCP server shows the same setup with the domain and links to the keys. Remove the test server afterwards with `claude mcp remove analytics` if you don't want to keep it.

### Deploy and post-deploy steps (Phases 1 to 17)

Push to `main` when happy; Vercel runs `npx convex deploy --cmd 'npm run build'`, which deploys the Convex functions and schema (all additions are optional fields or new tables: `pageTitles`, `apiKeys`) and the Next.js app together. Then:

1. **No new environment variables.** The MCP route uses `NEXT_PUBLIC_CONVEX_URL` and `INGEST_SECRET`, which Vercel Production and Convex prod already have (they must be the same value on both, as for `/api/collect`). Check `INGEST_SECRET` is set on Vercel Production if MCP calls answer 500 "Server misconfigured".
2. **New dependencies** (`@modelcontextprotocol/server` 2.4.0, `zod` 4.6.7) are in `package.json` and `package-lock.json`; Vercel installs them. Nothing else to install.
3. **Run both backfills once on production**, a few minutes after the deploy:
   - `npx convex run migrations:backfillPageStats --prod` (Phase 6; until it runs, the Pages tab's Sessions, Bounce and Duration only count hits since the deploy).
   - `npx convex run migrations:backfillVisitorTotals --prod` (Phase 9; until it runs, older visitors' Users rows show only what came in since the deploy, and their location and device are blank).
   Each reschedules itself per site; check the Convex prod logs until they report done.
4. **Nothing to change in the snippets on your sites**: they load `/script.js`, which picks up Phases 7, 15 and 16 on deploy (browsers may keep the old copy cached for a while).
5. **Connect Claude Code to production**: create a key in account Settings on the live app and run the `claude mcp add` command from the card (item 21). Keys made on dev don't work on production, and the other way round.

Per phase, for reference: Phase 17 adds the `apiKeys` table, `apiKeys.*` and `mcp.*` functions and `/api/mcp`, and refactors the stats, pages and visitors queries into shared helpers (no behaviour change). Phase 16 changes only the script and the Settings page. Phase 15 adds `sites.cookieless` and changes `ingest.pageview`, `sites`, `/api/collect` and the script. Phases 13 and 14 add `sites.excludedPaths` and `sites.pathGrouping` and change `ingest` and `sites`. Phases 10, 11 and 12 need nothing run. Phases 3, 5, 6, 7, 8 and 9 change Convex functions; Phases 6 and 9 add optional fields and need the backfills above, and Phase 7 adds `pageTitles`.

## Earlier: review design v3 Phases 1 to 6

Owner:

1. Signed out (a private window), open `/`: the splash page in light and dark and on your phone. Both Log in buttons open the sign-in page, and signing in lands on `/websites`.
2. Signed in, open `/`: it goes straight to `/websites`.
3. Sign out from the user button: you land on `/`.
4. On `/websites`, `/billing` and `/settings`: the account tabs, in both themes and on your phone. Site pages should look exactly as before.
5. On `/settings`: Manage account, each theme option (then reload), and Sign out (lands on `/`).

6. The user menu, on `/websites` and on a site page, in both themes: your initials and email (only the circle on your phone). Its items go to Websites, Billing and Settings, and Sign out lands on `/`. Try it with the keyboard too (Tab to it, Enter, arrows, Escape).

7. Add website (from `/websites` and from the switcher), in both themes and on your phone:
   - Paste a full URL and check the "We'll track" line.
   - Try a domain you already have and check the error.
   - Create one, check its timezone in Settings, and see the `?site=` step. Cancel should return to the grid.

8. Add website, step 2: create a site (or open `/websites/new?site=<a site with no hits>`), paste the snippet into a page and load it. The row should flip to "First pageview received" without a reload. Check Copy, Skip to dashboard, and the snippet block in the site's Settings, in both themes and on your phone.

9. Onboarding: with at least one site, `/websites` shows the grid and `/websites/new` shows Cancel. To see the empty case, sign in as a user with no sites (a throwaway Clerk user on dev), or delete the last site. You should land on `/websites/new` with no Cancel and no flash of an empty grid.

Design v3 is then complete. Push to `main` to deploy it (the Convex functions include the new `sites.hasPageview`).

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

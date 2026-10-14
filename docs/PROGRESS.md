# Build Progress

Last updated: 2026-10-14. Read this together with [PLAN.md](PLAN.md), which is the brief and lists the remaining phases. This file records what has been built, the decisions taken along the way (some differ from PLAN.md), and how the environments are set up.

## Status

| Phase | State |
| --- | --- |
| 0: Skeleton deployed | Done. Signed in on Vercel, and `me.whoami` returned the Clerk user id from Convex production. |
| 1: Tracking live on one site | Done. Real pageviews from advancedortholabsf.com reached Convex production with the right date, country, device, unique flag and duration. |
| 2: Site dashboard | Done. `/sites/[domain]` approved by the owner: SA's layout with the original dark look (see Decisions). |
| 3: Websites list and settings | **Built, awaiting owner review.** `/websites`, settings and the `/` redirect work locally against Convex dev. Still to do by the owner: add the snippet to the other seven sites. |
| 4: Side-by-side run, cancel SA | Not started. The snippet runs next to SA on advancedortholabsf.com since 2026-10-14. |

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
  schema.ts          all four tables from PLAN.md (sites, pageviews, dailyStats, dailyDims)
  auth.config.ts     Clerk issuer from CLERK_JWT_ISSUER_DOMAIN, applicationID "convex"
  me.ts              whoami test query (Phase 0 check)
  sites.ts           sites.create (normalises the domain, rejects duplicates, validates the timezone),
                     sites.get (null if missing or not yours), sites.list (feeds the site switcher),
                     sites.listWithStats (30 zero-filled days per site), sites.update (timezone),
                     sites.remove + internal deleteSiteData (batched, self-rescheduling)
  stats.ts           stats.summary, stats.timeseries, stats.breakdown, stats.live (all behind requireSite)
  ingest.ts          ingest.pageview / ingest.duration (public, guarded by INGEST_SECRET)
  lib/auth.ts        requireOwnerId(ctx) -> identity.tokenIdentifier; requireSite / findOwnedSite(ctx, domain)
  lib/ranges.ts      date-range maths on "YYYY-MM-DD": presets, previous/next range, ?range= parsing (shared with the page)
  lib/dates.ts       localDate(ts, tz), isValidTimeZone
  lib/domain.ts      normalizeDomain, hostMatchesDomain (shared with the collect route)
  lib/rollups.ts     bumpDailyStats, bumpDailyDim upserts
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
  lib/collect.ts     parsePayload, normalizeReferrer, normalizePath, detectDevice, requestHostname
  lib/*.test.ts      unit tests, including script.test.ts, which runs public/script.js in a fake browser
public/script.js     hand-written ES5 tracking script (1.47 KB gzipped)
```

Checks at the end of Phase 1: `npm run build`, `npx tsc --noEmit`, `npm run lint` clean, `npm test` 89 tests passing.
Checks at the end of Phase 2: the same four clean, `npm test` 128 tests passing.
Checks at the end of Phase 3: the same four clean, `npm test` 134 tests passing; add, settings and delete clicked through locally.

## Decisions and differences from PLAN.md

- **Owner id is `identity.tokenIdentifier`**, not `identity.subject` (Convex guideline, approved by the owner). Store and compare `tokenIdentifier` in `requireSite` for Phase 2. Moving to a Clerk production instance changes the issuer part, so `sites.ownerId` will need a one-off update then.
- **No `users` table.** Clerk is the user list. The owner chose to keep the plan as written.
- **`ua-parser-js` is pinned to v1 (MIT)**, with `@types/ua-parser-js`. v2 is AGPL-3.0; do not upgrade.
- **The script sends only the referrer's hostname**, never the full URL, so query strings and search terms stay in the browser.
- **The script skips localhost** unless `data-site` is literally `localhost`, which is what makes `/test.html` work against a dev site called `localhost`.
- **`ingest.pageview` ignores a repeated `pvId`**, so a retried beacon is not counted twice.
- **The duration beacon is sent once per pageview** (as the plan says), so time after a hidden tab comes back is lost and time on page reads a little low.
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

Read production data with `npx convex data <table> --prod`.

## Open items for the owner

- In Vercel, check that `CONVEX_DEPLOY_KEY` is scoped to Production only.
- Before real use: create a Clerk production instance on a custom domain, swap in its keys and issuer, and update `sites.ownerId` (see the first decision above).
- Add the snippet to mselbekk.com and the other six sites (planned for Phase 3).

## Next: finish Phase 3, then Phase 4

Owner: review `/websites` and the settings page against `public/SA-websites.png`, then add each remaining site under Add website (production) and paste its snippet (Settings → Embed snippet) into mselbekk.com and the other six sites, next to the SA snippet. Phase 4 is then the two-week side-by-side run.

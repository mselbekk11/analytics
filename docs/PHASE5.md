# Analytics: Phase 5 and 6 Plan

Oct 26, 2026 · @Morgan Selbek

## Summary

Phase 5 turns your app into a DataFast-style, revenue-first tool like [minilytics](https://github.com/surendrapandar/minilytics). It runs on your existing Next.js, Convex and Clerk app and is not a port. The key change is that the script now gives each visitor a first-party cookie id and groups their pageviews into sessions. Everything below is built on that.

**What Phase 5 adds:**

- **Visitors and sessions:** returning visitors are recognised. The stat row adds bounce rate and session time, and "online now".
- **Sources and campaigns:** channels (Direct, Organic Search, Organic Social, AI, Referral, Email, Paid), named sources such as X, Google and ChatGPT, `utm_*` and `?ref=` tags, and entry and exit pages.
- **OS, region and city.**
- **Goals, outbound clicks and identify:** named goals, clicks on links to other sites, and an optional call that attaches a user id, email or name to a visitor.
- **Revenue:** payments from Stripe (and a generic payments API) linked to the visitor and the source that brought them. This gives revenue, conversion rate and revenue per visitor, overall and by source. Revenue is optional per site. Sites without payments use a key goal, such as a sign-up, as their conversion instead.
- **Open sign-ups (Phase 6):** anyone can create an account, add their own websites and choose per site whether to connect Stripe.
- **Customer journeys and visitor profiles:** a list of paying customers, each with a timeline of visit, pages, goals and payment. Anonymous visitors get friendly names such as "brown fox".
- **Click to filter** on any row, and a **live map** of visitors online now.

**What stays the same:** the stack, the existing pages and routes, the daily rollups as the main read path, and no stored IP addresses.

**What changes for privacy:** the script now sets two cookies on each tracked site. Your sites' privacy policies need a line about it, and EU visitors may need a consent banner (see Open questions).

Minilytics is MIT licensed. Copy small pieces with credit, such as `src/shared/sources.ts` and `src/shared/names.ts`, but rewrite everything that touches data for Convex.

## Instructions for Claude Code

If you are an AI coding agent reading this file, it is your brief for Phase 5. Save it as `docs/PHASE5.md`. Read it together with `docs/PLAN.md` and `docs/PROGRESS.md`.

1. **This brief replaces PLAN.md's scope rule.** The owner has chosen to track visitors. First-party cookies, visitor and session ids, sessions, UTM tags, goals, identify, payments and revenue are now in scope, as this brief describes them. Still never store IP addresses or full query strings. Do not add features beyond this brief. Ask if something seems missing.
2. **One sub-phase at a time** (5a to 5h). Stop after each one so the owner can review, and ship it to production before you start the next. 5a must be live before any later sub-phase, because the others depend on visitor and session ids.
3. **Additive schema changes only.** Add new tables, optional fields and new `dim` literals. Never rename or remove fields that hold data. When old rows need new values, use a batched internal migration that reschedules itself, the same pattern as `deleteSiteData`.
4. **Keep rollups as the main read path.** Raw tables (`sessions`, `pageviews`, `events`, `payments`) are read for filtered views, visitor profiles, customer lists and the live map. Always read them through an index, within Convex's read limits.
5. **Secrets stay server-side.** Store webhook signing secrets and payment API keys in a `siteSecrets` table that no public query returns. Verify every webhook signature before you write anything.
6. **Same checks as before.** Read `convex/_generated/ai/guidelines.md` first. At the end of each sub-phase, run `npm run build`, `npx tsc --noEmit`, `npm run lint` and `npm test`, and report the results against its "Done when" line.
7. **Keep the tracking script small.** It must stay hand-written ES5 and under 3 KB gzipped (it is 1.47 KB today). Add tests for every new branch to `src/lib/script.test.ts`.
8. **Update `docs/PROGRESS.md`** at the end of each sub-phase with what was built and any decisions.

## How visitors and sessions are tracked

The script sets two first-party cookies on the tracked site. From the day 5a goes live, a visitor is a cookie id, not a Simple Analytics-style unique visit. Days before then keep their old counts.

**Cookies,** set by `script.js` on the site's root domain, so `app.site.com` and `site.com` share one visitor:

| Cookie | Value | Lifetime | Purpose |
| --- | --- | --- | --- |
| `_va_vid` | random UUID | 400 days, renewed on every visit | Visitor id: returning visitors, journeys, revenue |
| `_va_sid` | random UUID | 30 minutes, sliding | Session id: a new one starts after 30 minutes of inactivity |

Both use `SameSite=Lax` and `Secure` on https. The `localStorage.sa_ignore` opt-out still works. When it is set, the script also deletes both cookies.

**How each number is defined from 5a on:**

| Number | Definition |
| --- | --- |
| Visitors | Distinct `_va_vid` values in the range |
| Sessions | Distinct `_va_sid` values in the range |
| Pageviews | Unchanged |
| Bounce rate | Sessions with exactly one pageview and no goal ÷ sessions |
| Session time | Average engaged (visible-tab) time per session |
| Time on page | Unchanged: average engaged time per pageview |
| Online now | Distinct visitors with a hit in the last 5 minutes (replaces "live pageviews") |
| Conversion rate | Visitors who paid ÷ visitors. On a site without revenue: visitors who completed its key goal ÷ visitors |
| Revenue per visitor | Revenue ÷ visitors |

**Continuity:** the chart draws a thin marker on the 5a launch date, labelled "visitor tracking on". A % change whose previous period starts before that date shows "–" instead of a number, because the two definitions are not comparable.

**Safari limit:** Safari caps cookies set by JavaScript at 7 days. A Safari visitor who comes back after more than 7 days counts as new, and their journey starts again. Sites you build with Next.js can avoid this with the first-party proxy described under Open questions.

## Data model in Convex

Phase 5 adds five tables (`visitors`, `sessions`, `events`, `payments`, `siteSecrets`) and adds optional fields to the four existing ones. A session row holds everything about how a visit arrived, so filters and journeys read sessions instead of joining pageviews.

```ts
// New tables (convex/schema.ts)
visitors: defineTable({
  siteId: v.id("sites"),
  visitorId: v.string(),          // _va_vid
  firstSeen: v.number(),
  lastSeen: v.number(),
  lastSeenDate: v.string(),       // site-local day of the last hit, for daily visitor counts
  sessions: v.number(),
  firstSource: v.optional(v.string()),
  firstChannel: v.optional(v.string()),
  userId: v.optional(v.string()), // from identify()
  email: v.optional(v.string()),  // from identify() or a payment
  name: v.optional(v.string()),
  revenueMinor: v.number(),       // lifetime, in the site's currency
  firstPaidAt: v.optional(v.number()),
})
  .index("by_site_visitor", ["siteId", "visitorId"])
  .index("by_site_lastSeen", ["siteId", "lastSeen"])
  .index("by_site_email", ["siteId", "email"])
  .index("by_site_firstPaid", ["siteId", "firstPaidAt"]),

sessions: defineTable({
  siteId: v.id("sites"),
  sessionId: v.string(),          // _va_sid
  visitorId: v.string(),
  date: v.string(),               // site-local day the session started
  startedAt: v.number(),
  lastSeenAt: v.number(),
  engagedMs: v.number(),
  pageviews: v.number(),
  goals: v.number(),
  entryPath: v.string(),
  exitPath: v.string(),
  referrer: v.string(),
  source: v.string(),
  channel: v.string(),
  utmSource: v.optional(v.string()), utmMedium: v.optional(v.string()),
  utmCampaign: v.optional(v.string()), utmTerm: v.optional(v.string()),
  utmContent: v.optional(v.string()), refTag: v.optional(v.string()),
  country: v.string(), region: v.optional(v.string()), city: v.optional(v.string()),
  lat: v.optional(v.number()), lon: v.optional(v.number()), // rounded to 1 decimal
  device: v.string(), browser: v.string(), os: v.optional(v.string()),
  revenueMinor: v.number(),
})
  .index("by_site_session", ["siteId", "sessionId"])
  .index("by_site_started", ["siteId", "startedAt"])
  .index("by_site_visitor_started", ["siteId", "visitorId", "startedAt"]),

events: defineTable({
  siteId: v.id("sites"),
  ts: v.number(),
  date: v.string(),
  type: v.union(v.literal("goal"), v.literal("outbound"), v.literal("identify")),
  name: v.string(),               // goal name, or outbound origin + path
  path: v.string(),
  pvId: v.string(),
  sessionId: v.string(),
  visitorId: v.string(),
  props: v.optional(v.record(v.string(), v.string())), // up to 10 keys
})
  .index("by_site_ts", ["siteId", "ts"])
  .index("by_site_visitor_ts", ["siteId", "visitorId", "ts"])
  .index("by_pvId_name", ["pvId", "name"]),

payments: defineTable({
  siteId: v.id("sites"),
  provider: v.union(v.literal("stripe"), v.literal("api")),
  providerId: v.string(),         // Stripe charge or invoice id, or your own id
  ts: v.number(),
  date: v.string(),
  kind: v.union(v.literal("payment"), v.literal("refund")),
  amountMinor: v.number(),        // cents; refunds are negative
  currency: v.string(),
  renewal: v.boolean(),
  customerId: v.optional(v.string()),
  email: v.optional(v.string()),
  visitorId: v.optional(v.string()),
  sessionId: v.optional(v.string()), // the credited session
  matchedBy: v.optional(v.union(v.literal("metadata"), v.literal("return_page"),
                                v.literal("customer"), v.literal("email"))),
})
  .index("by_site_ts", ["siteId", "ts"])
  .index("by_site_provider_id", ["siteId", "provider", "providerId"])
  .index("by_site_customer", ["siteId", "customerId"])
  .index("by_site_visitor", ["siteId", "visitorId"]),

siteSecrets: defineTable({
  siteId: v.id("sites"),
  stripeWebhookSecret: v.optional(v.string()),
  apiKeyHash: v.optional(v.string()),   // SHA-256 of the payments API key
}).index("by_site", ["siteId"]),
```

**Fields added to existing tables:**

| Table | New optional fields |
| --- | --- |
| `sites` | `currency` (default `USD`), `trackingStartedAt` (the 5a launch time, for the chart marker), revenueSource (none, stripe or api; default none, added in 5e), keyGoal (a goal name such as signup, added in 5d) |
| `pageviews` | `visitorId`, `sessionId`, plus index `by_site_session` on `["siteId", "sessionId", "ts"]` for journeys |
| `dailyStats` | `sessions`, `bounces`, `sessionEngagedMs`, `revenueMinor`, `payments`, `refundsMinor` |
| `dailyDims` | `sessions` and `revenueMinor`; new `dim` values `source`, `channel`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `ref`, `entry`, `exit`, `os`, `region`, `city`, `goal` and `outbound` |

**How the rollups are kept up to date:**

- **First hit of a session:** insert the `sessions` row, upsert the `visitors` row, and add 1 to `dailyStats.sessions` and `dailyStats.bounces`. Add 1 to `sessions` on each session-level dim: source, channel, UTM, ref, entry, exit, country, region, city, device, browser and OS.
- **First hit of a visitor on a new local day** (`visitors.lastSeenDate` differs): add 1 to `dailyStats.visitors` and set `lastSeenDate`. The chart shows daily visitors from this, and the Visitors tile counts distinct `visitorId` values over the range from `sessions` (see Risks).
- **Second pageview, or first goal, in a session:** subtract 1 from that day's `bounces`. Every pageview moves the `exit` dim from the old path to the new one.
- **Engaged-time ping:** add the time to the session, the pageview and `dailyStats.sessionEngagedMs`, always on the session's own start date.
- **Payment:** add to `dailyStats.revenueMinor` on the payment's date, and to `revenueMinor` on the credited session's dims (source, channel, campaign, country and the rest), so lists can show revenue by source.

Region and city keys include the parent, for example `US/California/San Francisco`, so two cities with the same name stay separate.

**Backfill:** a migration classifies existing `pageviews` into `source` and `channel` from their stored referrer, and rebuilds those two dims for old days. Sessions, visitors and revenue cannot be recovered for days before 5a.

## Tracking script and ingest

The embed snippet does not change, so all eight sites get the new behaviour as soon as the app serves the new `script.js`. Every payload now carries `vid` and `sid`.

**Script changes (`public/script.js`):**

1. **Ids (5a).** On every send, read `_va_vid` and `_va_sid`, create them if missing, and write them back. This renews the visitor id and slides the session's 30 minutes. To find the root domain, try writing a test cookie on each parent domain, as minilytics does in `rootDomain()`. A `data-cookie-domain` attribute overrides it.
2. **Engaged time (5a).** Replace the single duration beacon with a `ping` that sends `{ t: "ping", pvId, sid, ms }`. It goes every 60 seconds while the tab is visible (at most 30 per pageview), on `visibilitychange` to hidden, on `pagehide` and before an SPA route change. `ms` is the visible time since the last ping, so time after a hidden tab comes back is no longer lost.
3. **Campaign tags (5b).** On the first pageview only, send the values of `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `ref` and `via`, each cut to 100 characters. Never send the full query string.
4. **Goals, outbound clicks and identify (5d).** Add `window.analytics("goal", name, props?)`, `window.analytics("identify", { id?, email?, name? })` and `data-goal="signup"` on any element, with a small queue so calls made before the script loads still count. A capture-phase `click` and `auxclick` listener sends `{ t: "out", url }` (origin and path only) for links to other hostnames.
5. **Checkout attribution (5e).** Add `window.analytics("attribution")`, which returns `{ va_vid, va_sid }` to pass into Stripe Checkout metadata. On page load, if the URL has a Stripe `session_id=cs_...` parameter, send `{ t: "claim", checkoutSessionId }` so the return page can link a payment even when metadata was not set.

**Ingest changes (`/api/collect` and `convex/ingest.ts`):**

- **Validate** `vid` and `sid` as UUIDs, plus the new fields, in `src/lib/collect.ts`. A payload with no `vid` comes from an old cached script. Store it the old way for 7 days after 5a launches, then drop it.
- **`ingest.pageview`** upserts the session and visitor as described under Data model, then inserts the pageview with `visitorId` and `sessionId`.
- **`ingest.ping`** replaces `ingest.duration`. It caps each ping at 70 seconds and each pageview at 30 minutes.
- **`ingest.event`** handles goals, outbound clicks, identify and claims. It ignores an event whose `pvId` is unknown or belongs to another site, and a repeat of the same goal name on the same `pvId`.
- **Source classifier** in `convex/lib/sources.ts`, adapted from minilytics' `KNOWN_SOURCES` (MIT, credited in a comment). Precedence: `utm_source`, then `ref`, then the referrer host. A `utm_medium` of cpc, ppc, paid and similar means Paid. Email or newsletter means Email. No referrer and no tags means Direct. An unknown host is a Referral named after the host.
- **Geolocation:** take `region`, `city`, `latitude` and `longitude` from the `geolocation()` call the route already makes. Round the coordinates to 1 decimal place (about 10 km) before they leave the route. The IP is never read or stored.
- **Tests:** unit tests for the classifier, cookie and root-domain logic in `script.test.ts`, plus `convex-test` tests for session start, the bounce decrement, the exit-page move, the ping cap, a duplicate goal, an unknown `pvId` and a wrong secret.

## Revenue

Revenue comes in through a Stripe webhook per site, or through a small payments API for anything else. Each payment is linked to a visitor and credited to one of their sessions. That session's source, campaign and country then get the revenue.

**Revenue is optional per site.** Each site has a revenue source in Settings: None (the default), Stripe or API. A site set to None has no revenue tiles, chart bars or revenue columns. It picks a **key goal** instead, for example `signup` or `booking` from 5d, and its conversion rate, Customers page and journeys are built on visitors who completed that goal. A site can have both, for example a free sign-up and a paid plan, and the dashboard then shows sign-ups and revenue side by side.

**Stripe (the default):** a Convex HTTP action at `/stripe/{siteId}` in `convex/http.ts`. It verifies the `Stripe-Signature` header with that site's secret from `siteSecrets`, using the Stripe SDK's `constructEventAsync`. If the Convex runtime cannot run the SDK, use a `"use node"` action. It records:

| Stripe event | Recorded as |
| --- | --- |
| `checkout.session.completed` with `mode: payment` | A payment |
| `invoice.paid` | A payment. `renewal` is true when `billing_reason` is `subscription_cycle` |
| `charge.refunded` | A refund with a negative amount |

A subscription checkout is counted from its `invoice.paid` only, so it is never counted twice. Payments are idempotent on `providerId`, because Stripe retries webhooks.

**Payments API:** `POST /api/payments` with `Authorization: Bearer <site key>`. The body is `{ id, amount, currency, email?, customerId?, visitorId?, sessionId?, ts?, refund? }`. Use it for Lemon Squeezy, Paddle, Dodo or manual sales. Settings creates the key and shows it once. Only its SHA-256 hash is stored.

**Linking a payment to a visitor**, tried in this order:

1. **Metadata:** `va_vid` and `va_sid` in the Checkout Session's `metadata` (or `client_reference_id`), from `window.analytics("attribution")`.
2. **Return page:** a `claim` event from the success page whose Checkout Session id matches.
3. **Customer:** an earlier payment from the same Stripe `customer` already has a visitor.
4. **Email:** a visitor whose `identify()` email matches the payment email.

If nothing matches, the payment still counts toward total revenue under "Unattributed". `matchedBy` records which rule linked it.

**Credited session:** the visitor's last session before the payment whose channel is not Direct, or their last session if all were Direct. The journey also shows the first-touch source.

**Currency:** each site has one currency, set in Settings. Payments in another currency are stored but left out of totals, and the dashboard shows a notice. No exchange rates for now.

**Settings, Revenue section:** the currency, the Stripe webhook URL to copy (and which events to select), a field for the signing secret, the payments API key, and a "Copy AI prompt" button. The prompt tells Claude Code how to pass `attribution()` into checkout in that site's codebase.

## Phased milestones

There are eight sub-phases. 5a comes first because everything else needs visitor and session ids. After that, 5e (revenue) and 5f (journeys) are the priority. 5b to 5d feed them better data, so do them in order.

**Phase 5a: Visitors and sessions**

- [ ] `visitors` and `sessions` tables, the new fields on `pageviews`, `dailyStats` and `sites`
- [ ] Script: cookies, root-domain detection, `ping` replacing the duration beacon
- [ ] A `data-cookieless` attribute on the snippet that keeps today's behaviour, with no cookies, for sites that need it
- [ ] Ingest: session and visitor upserts, bounce and exit logic, `ingest.ping`, fallback for old cached scripts
- [ ] Dashboard: Visitors switches to distinct visitor ids. Add Sessions, Bounce rate and Session time tiles. "Live pageviews" becomes "Online now". Add the launch-date marker on the chart.
- [ ] Privacy-policy text for the sites, in `docs/PRIVACY.md`, for the owner to paste
- [ ] Done when: two visits from your phone 40 minutes apart show 1 visitor and 2 sessions, and a one-page visit counts as a bounce

**Phase 5b: Sources, channels and campaigns**

- [ ] Classifier, session fields and dims for source, channel, UTM, ref, entry and exit
- [ ] Backfill of `source` and `channel` for days before 5a
- [ ] Dashboard: the Referrals column gets tabs for Channels, Sources, Campaigns and Referrers. Pages gets Entry and Exit tabs. Sources show their favicon.
- [ ] Done when: a visit with `?utm_source=test&utm_campaign=phase5b` shows under Campaigns, and a click from chatgpt.com shows as ChatGPT under AI

**Phase 5c: OS, region and city**

- [ ] Fields and dims for OS, region and city, plus rounded `lat` and `lon` on sessions
- [ ] Dashboard: the Devices column gets an OS tab, and Countries gets Regions and Cities tabs
- [ ] Done when: your own visit shows your city and OS

**Phase 5d: Goals, outbound clicks and identify**

- [ ] `events` table, `ingest.event`, and goal and outbound dims
- [ ] Script: `goal`, `identify`, `data-goal` and outbound links
- [ ] Dashboard: a Goals panel with completions, visitors and conversion rate per goal, plus an Outbound links list
- [ ] Settings: a Goals section with the snippet, a "Copy AI prompt" button, and a picker for the site's key goal
- [ ] Done when: a test goal and an outbound click on advancedortholabsf.com show within seconds, and an `identify` call puts an email on the visitor

**Phase 5e: Revenue**

- [ ] `payments` and `siteSecrets` tables, the Stripe HTTP action, `POST /api/payments` and the matching rules
- [ ] Script: `attribution()` and the return-page claim
- [ ] Dashboard: Revenue, Conversion rate and Revenue per visitor tiles. Revenue bars on the chart under the visitors line. A Revenue column on every source, campaign and country list.
- [ ] Settings: the Revenue section, set to None by default. The revenue tiles, chart bars and columns appear only on sites set to Stripe or API.
- [ ] Done when: a payment in Stripe test mode from a visit tagged `?utm_source=test` shows that revenue under the test source, with `matchedBy` set to metadata

**Phase 5f: Customer journeys and visitor profiles**

- [ ] Friendly names in `src/lib/names.ts`, adapted from minilytics' `names.ts`: a stable colour and animal ("brown fox") from a hash of the visitor id, with the email or name from `identify()` taking priority
- [ ] `/sites/[domain]/customers`: every paying visitor (on a site without revenue, every visitor who completed the key goal) with name, first source, credited source, total paid, first-payment date and time to convert, newest first
- [ ] `/sites/[domain]/visitors/[visitorId]`: profile header (name, location, device, first seen, total paid), then a timeline by session of the source, each page with its time, goals, outbound clicks and payments
- [ ] Clicking a visitor anywhere (customers list, live feed) opens their profile
- [ ] Done when: the Stripe test payment from 5e shows a full journey from the tagged visit to the payment

**Phase 5g: Click to filter**

- [ ] Clicking a row in any list adds a filter chip, kept in the URL as `?f=channel:AI,country:US`, with up to 3 filters
- [ ] `stats.filtered` reads `sessions` (plus `pageviews` for a page filter, `events` for a goal filter and `payments` for revenue) through `by_site_started` for the range. It filters in memory and returns the same shape as the rollup queries, so the components are unchanged.
- [ ] Filtered views are limited to 90 days. If a range would go past Convex's read limits, show a notice instead of failing.
- [ ] Done when: filtering by `channel:AI` changes every tile, the chart and every list, and removing the chip brings back the rollup view

**Phase 5h: Live map**

- [ ] A `/sites/[domain]/live` tab with a MapLibre map (`maplibre-gl`) on free [OpenFreeMap](https://openfreemap.org) tiles, a dot per visitor online now, and a feed of pageviews, goals and payments with visitor names
- [ ] `stats.liveFeed` takes `since` from the client, like `stats.live`, and returns at most 200 rows
- [ ] Done when: opening one of your sites on your phone puts a named dot near you within 30 seconds

## Phase 6: Open sign-ups

Phase 6 lets anyone create their own account, add their own websites, and choose for each site whether to connect Stripe. It comes after Phase 5, once every feature is proven on your own sites. Most of the groundwork is already there: every site has an owner, and every query checks it.

**What a customer gets:** they sign up, add a website, paste the snippet and see their dashboard. Revenue tracking stays off until they connect Stripe (or the payments API) in that site's Settings, as described under Revenue. A customer who only wants analytics never sees a revenue setting they have to deal with.

**Phase 6a: Accounts and sign-up**

- [ ] Clerk production instance on your custom domain (for example `stats.mselbekk.com`), with Invite-only turned off and sign-up with Google and email. Run the one-off `sites.ownerId` update for your own sites.
- [ ] An `accounts` table keyed by `tokenIdentifier`, created on first sign-in: `plan`, `createdAt`, `siteLimit` and `monthlyPageviewLimit`
- [ ] A public landing page at `/` for signed-out visitors, plus `/terms` and `/privacy`. The proxy stops sending `/` to sign-in.
- [ ] Onboarding: after sign-up, `/websites` shows the Add website form and the snippet. The site shows "Waiting for first pageview" until the first hit arrives, then "Installed".
- [ ] Done when: a second Google account can sign up, add a site, see its data and never see yours

**Phase 6b: Safe for many accounts**

- [ ] **Snippets use a site id, not the domain.** Today ingest looks sites up by domain, and domains are unique across the app, so a stranger could claim someone else's domain first. New snippets carry `data-site-id`, a random public id. Ingest checks that the request's hostname matches that site's domain. The same domain can then exist in two accounts without either seeing the other's data. Your existing snippets that use `data-site` keep working, so you don't need to re-paste them.
- [ ] **Limits:** count pageviews per account per month. Past the plan's limit, ingest drops hits quietly and the dashboard shows a banner. Rate-limit `/api/collect` per site with the Convex rate limiter component.
- [ ] **Account deletion:** a Clerk `user.deleted` webhook, and a Delete account button, remove every site and all its data through `deleteSiteData`
- [ ] **Isolation tests:** `convex-test` cases where account B tries to read, change or delete account A's sites, payments and visitors, and gets nothing
- [ ] **An admin page for you** (by your Clerk id): accounts, sites, pageviews this month and plan
- [ ] Done when: two accounts with the same domain are fully separate, and an account over its limit stops recording without errors on its site

**Phase 6c: Billing for your app**

- [ ] A free plan and a paid plan, through Stripe Billing on your own Stripe account or Clerk Billing. This is your billing, separate from the customers' Stripe connections.
- [ ] Plan limits read from `accounts`, upgrades handled by webhook
- [ ] Done when: upgrading in test mode raises the account's limits

**Your responsibilities once others sign up:** you become the processor of their visitors' data. You need terms, a privacy policy and a data processing agreement for EU customers. Customers stay responsible for their own cookie consent, and the `data-cookieless` mode from 5a gives them an option. Their Stripe webhook secrets are held in `siteSecrets` and never returned to the browser.

## Open questions and risks

- **Which payment providers do your sites use?** This plan assumes Stripe, plus the generic API for anything else. If some sites use Dodo, Lemon Squeezy or Paddle, a native webhook for each is a small addition to 5e.
- **Consent in the EU and UK:** a cookie used for analytics and revenue attribution generally needs consent there. If a site gets meaningful EU traffic, either add a consent banner and load the script only after consent, or use the `data-cookieless` mode. That mode falls back to the current behaviour with no cookies and no journeys. Build it in 5a so it is there when needed.
- **Privacy policies:** each site's policy should say which cookies are set, what they are for, and that IPs are not stored. 5a writes the text.
- **Safari's 7-day cookie cap:** cookies set by JavaScript last at most 7 days in Safari, so Safari visitors who return less often look new. For your Next.js sites, an optional fix is a first-party proxy. A `rewrites()` entry serves `/va/script.js` and `/va/collect` from the site's own domain, and the collect route sets `_va_vid` as a server cookie. It also helps against ad blockers. Plan it after 5h if Safari numbers look low.
- **Visitors over long ranges:** the Visitors tile counts distinct ids from `sessions` in the range. Your busiest site has about 733 pageviews a month, so a year is a few thousand sessions, well inside Convex's [read limits](https://docs.convex.dev/production/state/limits). If a site grows past them, the tile falls back to the sum of daily visitors and says so.
- **The cutover breaks comparisons:** days before 5a use the Simple Analytics unique-visit rule, so % changes across the launch date are hidden. Launch 5a early so a clean 30-day comparison exists sooner.
- **Storing personal data:** `identify()` and payments store emails and names in Convex. Only you can sign in (Clerk is invite-only), and deleting a site deletes its visitors and payments too. Extend `deleteSiteData` to the new tables.
- **Cost:** with pings, a pageview causes about 3 to 5 function calls, so 2,100 pageviews a month is roughly 10,000 calls. That is still about 1% of Convex's free tier. Once other accounts sign up in Phase 6, usage grows with them, so expect to move to Convex's paid plan and price your own plans to cover it.
- **Clerk production instance:** still open from Phase 3. It is required for Phase 6 anyway. It needs a domain you own, so Phase 5 is built on the Clerk development instance and the vercel.app URL. Buy the domain during Phase 5 and point the snippets at it, then switch Clerk at the start of 6a, so the `ownerId` update happens while the data is small.
- **Not in this plan:** funnels, teams (several people on one account), and sounds in the live view. Each one can be a later phase.

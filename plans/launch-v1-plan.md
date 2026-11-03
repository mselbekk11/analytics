# Plan: Launch V1

> Source PRD: `plans/launch-v1.md` (owner's notes `plans/next-steps.md`, screenshots `public/next-steps/`). Domain: **simplestats.ai** (bought at a third-party registrar).

Work one phase at a time and stop after each one for the owner to review (`docs/PLAN.md`, "Instructions for Claude Code"). Update `docs/PROGRESS.md` at the end of each phase. Phases 1–11 are the launch; 12–15 are stretch and can ship after it.

## Architectural decisions

Durable decisions that apply across all phases:

- **Domain**: `https://simplestats.ai` serves everything. `/` is the homepage, `/websites` and `/sites/[domain]/...` the app, `/billing` and `/settings` the account, `/script.js` the snippet, and `/api/collect`, `/api/payments` and `/api/mcp` the APIs. `www.simplestats.ai` redirects to the apex. The old `analytics-jet-zeta.vercel.app` stays served so existing installs keep sending.
- **Auth**: Clerk production instance on simplestats.ai with open sign-up (Convex prod). Convex dev keeps the Clerk dev instance. Owner ids stay `identity.tokenIdentifier`.
- **Billing unit**: one account per signed-in Clerk user. All their sites share one subscription and one usage count. There are no teams.
- **Schema, new `accounts` table** (index by owner id; by Stripe customer id): `ownerId`, `trialEndsAt`, `comped?`, `stripeCustomerId?`, `stripeSubscriptionId?`, `plan?` (`starter` \| `growth` \| `scale`), `interval?` (`month` \| `year`), `status?` (Stripe subscription status), `currentPeriodEnd?`, `cancelAtPeriodEnd?`. Stretch phases add the email preferences.
- **Access state**: worked out in one shared server helper from the account row: `comped`, `trialing`, `active`, `past_due` (allowed) or `locked`. Every dashboard read and MCP tool goes through it, and locked accounts get a typed "subscription required" error. **Ingest is never gated.**
- **Stripe boundary**: platform billing (our customers paying us) is separate from per-site revenue attribution (our customers' customers paying them). It has its own Convex HTTP webhook route and signing secret, test mode on dev and live mode on prod, and price ids in env vars per environment. The homepage `pricing` object stays the source of display prices.
- **Usage**: pageviews plus custom events (goals, outbound, `track`) per account per UTC calendar month, from the daily rollups, with no hot per-account counter and no enforcement.
- **Site tabs**: Analytics \| Pages \| Users \| Revenue \| Goals \| Outbound \| Funnels \| Live \| Settings. Revenue only shows on sites with a payments provider, and Funnels only once built. Routes are `/sites/[domain]/revenue`, `/goals`, `/outbound`, `/funnels` and `/signups`. `?range=`, `?f=` and `?metric=` carry across tabs.
- **Stretch schema**: `funnels` table (site id, name, ordered steps of `{ kind: "page", pattern } | { kind: "event", name }`, window in hours). `visitors.identifiedAt?` for signups. Email cadence switches on `accounts`.
- **Email (stretch)**: Resend through the Convex component, sending from a subdomain of simplestats.ai, with Convex crons for daily, weekly and monthly sends.

---

## Phase 1: simplestats.ai on Vercel

**User stories**: 5, 6, 7, 35

### What to build

Attach simplestats.ai (apex and `www`) to the Vercel project, with the DNS records the owner adds at the registrar. Everywhere the app shows its own URL (install snippet, onboarding step 2, Settings → Tracking code, MCP setup instructions, homepage Setup block) now comes from one configured canonical origin, `https://simplestats.ai`, instead of the Vercel project URL. The old `vercel.app` URL keeps serving the script and accepting collects. Clerk stays on the dev instance in this phase, so sign-in on the new domain may still be limited. Sign-in proper is Phase 2.

### Acceptance criteria

- [ ] `https://simplestats.ai/` serves the homepage over HTTPS, and `www` redirects to the apex.
- [ ] `https://simplestats.ai/script.js` loads, and a pageview from a test page using it reaches Convex prod.
- [ ] A pageview from an install still using the `vercel.app` script URL still reaches Convex prod.
- [ ] The snippet, onboarding, tracking-code settings and MCP instructions all show `simplestats.ai`.
- [ ] Typecheck, lint, tests and build all pass.

---

## Phase 2: Clerk production and owner migration

**User stories**: 1, 2, 3, 4

### What to build

Create the Clerk production instance on simplestats.ai with open sign-up (the owner adds Clerk's DNS records and the social-login credentials). Switch Vercel Production and Convex prod to its keys and issuer. Before switching, take a Convex prod snapshot. Right after, run a one-off internal migration that rewrites every owner-keyed field (sites, API keys, anything else keyed by `ownerId`) from the dev-issuer `tokenIdentifier` to the owner's prod-issuer one. A new sign-up lands on `/websites/new`.

### Acceptance criteria

- [ ] A Convex prod snapshot exists from before the switch.
- [ ] The owner signs in on simplestats.ai and sees all eight sites with their history, goals, revenue settings and MCP keys.
- [ ] A brand-new email can sign up with no invitation and lands on "Add your website".
- [ ] The new user sees none of the owner's sites, and the owner sees none of theirs.
- [ ] The migration is idempotent (running it twice changes nothing), and dev keeps working on the Clerk dev instance.
- [ ] Tests cover the migration's rewrite and its idempotency.

---

## Phase 3: Accounts, trial and lock

**User stories**: 8, 9, 11, 12, 13, 24, 25, 31, 32, 33

### What to build

Add the `accounts` table. An idempotent "ensure account" runs on a user's first signed-in request and starts a 7-day trial. An internal mutation sets or clears `comped`, and the owner's account is comped on prod. The shared access helper guards every dashboard query and every MCP tool. The top bar shows "Trial · N days left" (linking to `/billing`) while trialing. A locked account visiting any site page sees a "Pick a plan to continue" screen with a button to `/billing`. `/billing`, `/settings`, `/websites` (list, add, delete) and sign-out keep working. Ingest is untouched. `/billing` itself can still be the placeholder; subscribing is Phase 4.

### Acceptance criteria

- [ ] A new user gets an account with `trialEndsAt` 7 days ahead, and sees the trial pill counting down.
- [ ] With `trialEndsAt` set in the past (in a test, and by hand on dev), site pages show the paywall, and every guarded query and MCP tool refuses with "subscription required".
- [ ] A locked account's site still records pageviews and events.
- [ ] A comped account never sees the pill or the paywall.
- [ ] Tests cover every access state and confirm that each guarded query and MCP tool refuses when locked (including a wrong-user case).

---

## Phase 4: Checkout and billing webhook

**User stories**: 10, 14, 15, 16, 17, 26

### What to build

Create Starter, Growth and Scale products in Stripe test mode, each with a monthly and a yearly price matching the homepage, and put the price ids in env vars. `/billing` shows the plan picker with a Monthly \| Yearly toggle and the same prices as the homepage. Choosing a plan runs an action that creates (or reuses) the Stripe customer and a subscription-mode Checkout Session, then redirects. A new platform billing webhook route, verified with its own signing secret, handles `checkout.session.completed` and `customer.subscription.created/updated/deleted`, re-reads the subscription and writes plan, interval, status and period end onto the account. Returning to `/billing?checkout=success` shows "Finishing up…" until the reactive account query flips to active, then the dashboard is unlocked.

### Acceptance criteria

- [ ] On dev, a locked test account pays with Stripe's test card and is unlocked within seconds of returning, with no manual reload.
- [ ] `/billing` prices match the homepage for all six plan and interval pairs (a test checks the price config against `pricing`).
- [ ] A trialing account can subscribe early, and the trial pill goes away.
- [ ] Webhook events with a bad signature are refused, and replayed or out-of-order events leave the account correct.
- [ ] Tests cover the webhook handler's state updates.

---

## Phase 5: Managing a subscription

**User stories**: 18, 19, 20, 21, 22, 23

### What to build

`/billing` shows the current plan, interval, status and next renewal (or end) date for subscribed accounts. "Manage subscription" opens the Stripe customer portal (configured to switch plans and intervals, update the card, view invoices and cancel at period end). The webhook also handles `invoice.payment_failed` and the cancel flag. `/billing` shows a "Cancels on <date>" banner when cancelling, and a "Payment failed, update your card" banner plus a top-bar pill when past due. When a subscription ends, the account falls back to locked, with tracking still running.

### Acceptance criteria

- [ ] On dev, switching Growth monthly to Scale yearly in the portal is reflected on `/billing`.
- [ ] After cancelling in the portal, access continues and the banner shows the end date. Once the period ends (simulated with a Stripe test clock or a deleted-subscription event), the account is locked.
- [ ] A failed renewal (Stripe test card for declines) shows the past-due banner and pill, and access is kept.
- [ ] Tests cover the cancelling, past-due and ended state transitions.

---

## Phase 6: Usage meter

**User stories**: 27, 28, 29, 30

### What to build

Count events per account for the current UTC month: pageviews plus custom events across all the account's sites, with engagement pings excluded. Use the daily rollups, adding a per-day custom-event count to the existing rollup row if it isn't there already, with a backfill for the current month. `/billing` shows "X of Y events this month" with a bar against the plan's limit (and against Starter's limit while trialing). Going over changes nothing for the customer. An internal query lists accounts over their limit.

### Acceptance criteria

- [ ] On dev, sending a known number of pageviews and events moves the meter by exactly that amount, and pings don't move it.
- [ ] An account with several sites sees the sum across them.
- [ ] An account over its limit still tracks and reads normally, and appears in the internal over-limit list.
- [ ] Tests cover the count across sites, month boundaries, and the exclusion of pings.

---

## Phase 7: MCP end-to-end on production

**User stories**: 34 (and verifies 32)

### What to build

With a fresh key created in the app on simplestats.ai, connect Claude Code (`claude mcp add --transport http`) and Claude Desktop to `https://simplestats.ai/api/mcp` and call every tool once against a real site. Fix anything found. Confirm that a locked account's key gets the "subscription required" error as readable tool output. Record the exact connect commands in `docs/PROGRESS.md`.

### Acceptance criteria

- [ ] All eight tools return correct data for one of the owner's sites in Claude Code and in Claude Desktop.
- [ ] A revoked key gets a 401, and a locked account's key gets the subscription error.
- [ ] The in-app MCP instructions work when copied and pasted as shown.

---

## Phase 8: Tab bar and Goals tab

**User stories**: 43, 44, 45, 46, 47, 48, 49, 53, 54, 55

### What to build

The site tab strip gains Revenue (only on sites with payments; the page itself lands in Phase 10), Goals and Outbound, with icons. It scrolls sideways on phones and carries `?range=`, `?f=` and `?metric=`. `/sites/[domain]/goals` has the range header, Goals tracked (events and pageviews split), Total conversions and Avg. conversion rate tiles, and a Goals table (name, key, type, conversions, rate bar, top source) with All \| Events \| Pageviews. Clicking a row opens Analytics filtered by that goal, and "Manage goals" goes to Settings → Goals & conversions. Below the table, "Other events" lists custom events that aren't goals, each with a count and a way to make it a goal. The Analytics Events card is shown again (the Funnels card stays hidden). An empty state shows the one-line event snippet.

### Acceptance criteria

- [ ] On dev, the Goals tab's numbers match the Analytics Events card and the existing goals stats for the same range.
- [ ] Making an "other event" a goal moves it into the Goals table.
- [ ] The tab bar works at 375px, and the range and filters survive switching tabs.
- [ ] Tests cover top source per goal and the other-events list.

---

## Phase 9: Outbound tab

**User stories**: 50, 51, 52

### What to build

`/sites/[domain]/outbound` has the range header, Total clicks, Unique clicks, Links tracked and Clicks per link tiles with change, a clicks bar chart (hourly on short ranges), and a Links table: favicon, host and path, trend sparkline, clicks with share, visitors with change. It has search, sorting and 50 rows a page, and is built from the outbound-click events already collected.

### Acceptance criteria

- [ ] On dev, clicking three external links on the test page shows up with the right totals, links and visitors.
- [ ] The totals match the Outbound list in the Analytics Pages card for the same range.
- [ ] Tests cover grouping by host and path, unique visitors and change against the previous period.

---

## Phase 10: Revenue tab and real Stripe test payment

**User stories**: 36, 37, 38, 39, 40, 41, 42

### What to build

`/sites/[domain]/revenue` has the range header, Revenue, Conversions, Avg. order value and Avg. time to convert tiles with change, a green daily revenue bar chart, a Sources \| Countries card by revenue, and a Payments table (customer, location, source, journey dots, time to convert, amount, paid at) with search, sorting and pagination. A row opens the visitor drawer. Sites without a payments provider don't show the tab; a direct visit gets a setup prompt that links to Settings → Revenue attribution. Then prove the per-site flow on production with a real Stripe test-mode payment: a test site with Stripe attribution, a visit with UTM tags, a Checkout payment, and the payment shown on the tab, attributed to that source.

### Acceptance criteria

- [ ] The test-mode payment shows on the Revenue tab with the right amount, source, country and journey within a minute.
- [ ] The tiles agree with the Analytics Revenue tile and with the Sources card on "Revenue ⇅" for the same range.
- [ ] A refund reduces revenue as it does today.
- [ ] Tests cover the totals, avg. time to convert and the payments list.

---

## Phase 11: Homepage clean-up and go live

**User stories**: 56, 57, 58

### What to build

Drop "Soon" from Revenue and goal attribution on the homepage (Funnels and Search Console keep it until they ship). Point every "Start free trial" button at sign-up, and make the FAQ's billing answers (what counts as an event, going over, cancelling, the 7-day trial with no card) match how Phases 3–6 work. Then switch production billing to Stripe live mode: activate the account, create the live products and prices, set live env vars and the live webhook, and configure the portal. Do one real purchase with a live card and refund it.

### Acceptance criteria

- [ ] The homepage fixture and pricing tests still pass, and the FAQ wording is approved by the owner.
- [ ] A live-mode purchase on simplestats.ai unlocks the account, and the refund shows in Stripe.
- [ ] `docs/PROGRESS.md` lists every env var and the Stripe and Clerk dashboard settings for production.

---

## Phase 12: Funnels, first cut (stretch)

**User stories**: 59, 60, 61, 62, 64

### What to build

Add the `funnels` table with owner-checked create and list functions (up to 8 steps and 20 funnels per site). `/sites/[domain]/funnels` (now in the tab bar) has the range header and "New funnel", which opens a form: name, 2–8 ordered steps, each a page pattern (`*` wildcards, the excluded-paths matcher) or an event or goal, and a completion window (default 24 hours). Each funnel card shows its steps as bars, with count, % of entered, % continued and the number dropped off, and Conversion, Entered and Completed beside it. It's computed on demand for the range. Cookieless sites get an explanation instead.

### Acceptance criteria

- [ ] On dev, a scripted journey through three pages and an event produces the expected step counts, and a visitor who skips a step or goes past the window drops out.
- [ ] A 30-day funnel on the busiest prod site computes within Convex read limits (measured and recorded).
- [ ] Homepage Funnels loses its "Soon" badge.
- [ ] Tests cover step order, the window, wildcards and event steps.

---

## Phase 13: Funnels, edit, delete and the Analytics card (stretch)

**User stories**: 63, 65

### What to build

Edit and Delete on each funnel card, with a confirmation dialog for delete (rendered in the app, not a browser dialog). The Analytics tab's Funnels card is shown again, displaying the site's first funnel with "All funnels →". When there are no funnels it shows a short prompt with a link to create one.

### Acceptance criteria

- [ ] Editing a step re-computes the card, and deleting removes it everywhere.
- [ ] The Analytics card matches the Funnels tab for the same range.
- [ ] Tests cover update and delete with owner checks (wrong user refused).

---

## Phase 14: Signups tab (stretch)

**User stories**: 66, 67, 68, 69, 70, 71

### What to build

Record `visitors.identifiedAt` the first time `identify()` gives a visitor an email or user id, and backfill it from existing identified visitors. `/sites/[domain]/signups` (in the tab bar) has the range header, Signups, Free, Paying, Free → paid % and Avg. time to sign up tiles, a Free/Paying stacked daily chart with Daily \| Cumulative, a Sources \| Countries \| Landing pages card by signups, and a "People who signed up" table (person, plan, country, source, landing page, signup page, time to sign up, journey, signed up at) with search. A row opens the visitor drawer.

### Acceptance criteria

- [ ] On dev, identifying two new test visitors and linking a test payment to one shows 2 signups, 1 free, 1 paying and 50% free → paid.
- [ ] Re-identifying the same visitor doesn't count twice.
- [ ] The backfill gives existing identified visitors an `identifiedAt` that's no later than their first identify.
- [ ] Tests cover signup detection, the free and paying split, and time to sign up.

---

## Phase 15: Insight emails (stretch)

**User stories**: 72, 73, 74, 75, 76, 77, 78

### What to build

Set up Resend (the owner verifies a sending subdomain of simplestats.ai) through the Convex Resend component. Account Settings gains Insight emails: Daily (off), Weekly (on) and Monthly (on), stored on `accounts`. Convex crons send daily at 07:00 UTC, weekly on Mondays at 09:00 UTC and monthly on the 1st at 09:00 UTC. Each one schedules one send per opted-in, non-locked account. The email covers each site that had activity: visitors, pageviews, revenue (if configured) and key goal, each with change against the previous period, plus the top 3 sources and pages. Sites with no activity are left out, and the email is skipped when no site had any. Every email carries a signed one-click unsubscribe for its cadence and `List-Unsubscribe` headers.

### Acceptance criteria

- [ ] On dev, triggering the weekly job by hand sends an email to the owner's inbox with numbers that match the dashboard for last week.
- [ ] An account with no activity, a locked account and an opted-out account get nothing.
- [ ] The unsubscribe link turns off only that cadence, and the Settings switch reflects it.
- [ ] Tests cover who gets emailed, skipping empty periods and validating the unsubscribe token.

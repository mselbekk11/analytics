# Launch V1 PRD

Owner's notes: `plans/next-steps.md`. Competitor screenshots: `public/next-steps/`. References: https://piqo.app/ and https://datafa.st/.

## Problem Statement

The analytics app works and looks good, but only the owner can use it. Clerk is a development instance set to invite-only, there is no way to take payment, and the app runs on a `*.vercel.app` URL. The homepage already advertises three paid plans with a 7-day free trial, but nothing behind it is real.

The owner also wants to compete with piqo and DataFast. Those products are more than pageview counters: they show revenue, goals, outbound clicks, funnels, signups, Search Console data and send insight emails. Several of these already exist in this app's backend (goals, custom events, outbound clicks, identify, Stripe revenue attribution). Customers can't see them because no dashboard page shows them, or the cards are hidden behind flags. Others (funnels, signups, insight emails, Search Console) don't exist yet.

The owner wants to launch publicly within a few days of full-time work, with as many of these features as is realistic.

## Solution

Launch as a public, self-serve SaaS on a custom domain:

1. **Real accounts.** Clerk runs as a production instance on the custom domain with open sign-up. The owner's existing sites and data carry over.
2. **Billing.** Every new account gets a 7-day trial with no card. After that, the customer picks Starter, Growth or Scale, monthly or yearly, through Stripe Checkout, and manages the subscription through the Stripe customer portal from `/billing`. When a trial or subscription lapses, tracking keeps going but the dashboard (and MCP) lock behind a "pick a plan" screen. Usage counts events per account per month and shows them on the billing page, with no hard limit, as the FAQ promises. The owner's account is comped forever.
3. **MCP verified.** The existing MCP server is tested end-to-end on the new domain with Claude.
4. **Data that's already collected, now visible.** New site tabs, in the style of piqo: **Revenue** (only on sites with payments), **Goals** (goals and custom events) and **Outbound** (external link clicks). The Revenue flow is proven with a real Stripe test-mode payment, and the homepage drops its "Soon" badges for what ships.
5. **Stretch, in this order:** **Funnels** (ordered steps of pages or events with drop-off), **Signups** (people identified through `identify()`, with Free vs Paying from payments), and **Insight emails** (weekly and monthly summaries through Resend).

Search Console is deferred until after launch because Google's OAuth verification for that permission takes days to weeks.

## User Stories

### Accounts and domain

1. As a prospective customer, I want to sign up on the product's own domain, so that the product looks trustworthy and not like a test deployment.
2. As a prospective customer, I want to sign up without an invitation, so that I can try the product immediately.
3. As a new customer, I want to land on "Add your website" after sign-up, so that I can install the snippet right away.
4. As the owner, I want my existing sites, data, goals and API keys to still belong to me after the move to Clerk production, so that I lose nothing.
5. As the owner, I want snippets already installed on my eight sites with the old `*.vercel.app` script URL to keep sending data, so that I don't lose tracking while I update them.
6. As a customer, I want the install snippet shown in Settings to use the custom domain, so that I'm not tied to the old URL.
7. As a customer, I want `https://<domain>/` to be the marketing homepage and the app to sit under the same domain, so that there is one simple URL.

### Trial

8. As a new customer, I want a 7-day free trial without entering a card, so that I can judge the product with no risk.
9. As a trialing customer, I want to see how many trial days are left in the top bar, so that I'm not caught by surprise.
10. As a trialing customer, I want to be able to subscribe before the trial ends, so that there's no interruption.
11. As a customer whose trial ended, I want my sites to keep collecting data, so that I don't have gaps when I subscribe.
12. As a customer whose trial ended, I want a clear "Pick a plan to continue" screen instead of the dashboard, so that I know what to do.
13. As a customer whose trial ended, I want my account settings, billing and sign-out to stay reachable, so that I can subscribe or leave.

### Subscribing and managing billing

14. As a customer, I want to pick Starter, Growth or Scale with a monthly or yearly toggle on `/billing`, so that I can choose what fits.
15. As a customer, I want the prices on `/billing` to match the homepage, so that I'm not confused.
16. As a customer, I want to pay through Stripe Checkout, so that my card details are handled securely.
17. As a customer, I want the dashboard to unlock right after a successful checkout, without a reload loop or a wait, so that it feels instant.
18. As a customer, I want to see my current plan, billing interval, next renewal date and status on `/billing`, so that I know where I stand.
19. As a customer, I want a "Manage subscription" button that opens the Stripe customer portal, so that I can change my plan or card, download invoices or cancel.
20. As a customer who cancelled, I want access until the end of the period I paid for, so that I get what I paid for.
21. As a customer whose payment failed, I want to be told on `/billing` and keep access during Stripe's retry period, so that a card hiccup doesn't lock me out at once.
22. As a customer whose subscription has fully lapsed, I want the same locked state as an expired trial, with tracking still running, so that I can come back without losing data.
23. As a customer who upgrades or downgrades in the portal, I want `/billing` to show the new plan, so that it's accurate.
24. As the owner, I want my account marked as comped so that it never sees trial banners or paywalls.
25. As the owner, I want to be able to comp other accounts (friends, early users) the same way, so that I can hand out free access.
26. As the owner, I want billing to run in Stripe test mode on dev and preview and in live mode on production, so that I can test safely.

### Usage

27. As a customer, I want to see "X of Y events this month" on `/billing`, so that I know whether I'm on the right plan.
28. As a customer, I want pageviews and custom events to count, but not engagement pings, so that the count matches the FAQ.
29. As a customer over my plan's events, I want tracking and the dashboard to keep working, so that nothing breaks, as the FAQ promises.
30. As the owner, I want to see which accounts are over their plan, so that I can get in touch about moving up a plan.

### Locking

31. As the owner, I want the lock enforced on the server for dashboard queries and the MCP server, not just hidden in the UI, so that unpaid accounts can't read data through the API.
32. As a locked customer, I want the MCP server to return a clear "subscription required" error, so that my AI tool explains what's wrong.
33. As a locked customer, I want ingest for my sites to keep working, so that no data is lost.

### MCP

34. As a customer, I want to create an MCP key and connect Claude to `https://<domain>/api/mcp`, so that I can ask questions about my analytics.
35. As a customer, I want the MCP setup instructions in the app to show the custom domain, so that copying them works.

### Revenue tab

36. As a customer with Stripe connected, I want a Revenue tab with Revenue, Conversions, Avg. order value and Avg. time to convert tiles with their change, so that I can see how sales are going.
37. As a customer, I want a daily revenue bar chart for the selected range, so that I can see trends.
38. As a customer, I want revenue by Sources and Countries next to the chart, so that I know which traffic makes money.
39. As a customer, I want a Payments table (customer, location, source, journey, time to convert, amount, paid at) with search and sorting, so that I can look at each sale.
40. As a customer, I want to click a payment to open that visitor's drawer and journey, so that I can see how they found me.
41. As a customer without payments configured, I want the Revenue tab hidden, or a setup prompt that links to Settings → Revenue attribution, so that I'm not looking at an empty page.
42. As the owner, I want the full revenue flow proven with a real Stripe test-mode payment on a test site, so that I can advertise it honestly.

### Goals tab

43. As a customer, I want a Goals tab with Goals tracked, Total conversions and Avg. conversion rate tiles, so that I can see conversion at a glance.
44. As a customer, I want a table of goals with type (event or pageview), conversions, rate bar and top source, filterable by All, Events or Pageviews, so that I can compare them.
45. As a customer, I want to click a goal to filter the Analytics tab by it, so that I can dig in.
46. As a customer, I want a "Manage goals" button that takes me to the goals settings, so that I can add or change goals.
47. As a customer, I want to see custom events that aren't goals yet, with their counts, so that I can see what my site sends and promote events to goals.
48. As a customer, I want the Analytics tab's Events card shown again, so that events are visible on the main view.
49. As a customer with no events yet, I want an empty state that shows the one line of code to send an event, so that I know how to start.

### Outbound tab

50. As a customer, I want an Outbound tab with Total clicks, Unique clicks, Links tracked and Clicks per link tiles, so that I can see how much traffic I send elsewhere.
51. As a customer, I want a daily clicks bar chart, so that I can spot trends.
52. As a customer, I want a Links table (domain and path, trend sparkline, clicks with share, visitors with change) with search, sorting and pagination, so that I can find my most-clicked links.

### Navigation

53. As a customer, I want the site tabs to read Analytics | Pages | Users | Revenue | Goals | Outbound | Funnels | Live | Settings, with icons, so that each feature has its own place.
54. As a customer on a phone, I want the tab bar to scroll sideways, so that every tab is reachable.
55. As a customer, I want the range and filters to carry between tabs, as they do today between Analytics and Pages, so that I don't have to set them again.

### Homepage

56. As a visitor to the homepage, I want "Soon" badges only on features that really aren't available, so that the marketing is honest.
57. As a visitor, I want "Start free trial" buttons to go to sign-up, so that I can start right away.
58. As the owner, I want the billing FAQ answers (what counts as an event, going over, cancelling) checked against how billing really works, so that they're accurate.

### Stretch: Funnels

59. As a customer, I want to create a funnel of 2 to 8 ordered steps, where each step is a page path (with `*` wildcards) or an event or goal, so that I can model my signup or purchase flow.
60. As a customer, I want to set a completion window (default 24 hours), so that the funnel counts people who finish in a sensible time.
61. As a customer, I want each step's count, % of entered, % continued from the previous step and the number who dropped off, as bars, so that I can see where people leave.
62. As a customer, I want Conversion, Entered and Completed totals beside the funnel, so that I get the headline numbers.
63. As a customer, I want to edit and delete funnels, so that I can keep them up to date.
64. As a customer, I want the Funnels tab to follow the selected range, so that I can compare periods.
65. As a customer, I want the Analytics tab's Funnels card to show my first funnel with a link to all funnels, so that it's visible on the main view.

### Stretch: Signups

66. As a customer, I want each visitor who's first identified with `identify()` to count as a signup, with no extra code, so that it works with what I already send.
67. As a customer, I want Signups, Free, Paying, Free → paid % and Avg. time to sign up tiles, so that I can see how acquisition is going.
68. As a customer, I want a daily signups chart split into Free and Paying, with a Daily | Cumulative toggle, so that I can see growth.
69. As a customer, I want signups by Sources, Countries and Landing pages, so that I know which channels bring real users.
70. As a customer, I want a "People who signed up" table (person, plan, country, source, landing page, time to sign up, journey, signed up at) with search, so that I can look at each one.
71. As a customer, I want to click a person to open the visitor drawer, so that I can see their full journey.

### Stretch: Insight emails

72. As a customer, I want a weekly email on Monday morning about the week just ended, on by default, so that I keep up without logging in.
73. As a customer, I want a monthly email on the 1st about the month just ended, on by default, so that I get the bigger picture.
74. As a customer, I want an optional daily email, off by default, so that I can choose more detail.
75. As a customer, I want each email to show, per site, visitors, pageviews, revenue and the key goal with their change, plus top sources and pages, so that I see what's working and what slipped.
76. As a customer, I want periods with no activity skipped, so that I don't get empty emails.
77. As a customer, I want to turn each cadence on or off in account Settings, and unsubscribe with one click from the email, so that I'm in control.
78. As a locked (unpaid) customer, I want insight emails to stop, so that I'm only emailed for an active service.

## Implementation Decisions

### Order and launch line

- **Launch blockers, in order:** (1) domain and Clerk production, (2) billing and usage, (3) MCP check, (4) Goals and Outbound tabs, (5) Revenue tab and Stripe test payment, (6) homepage clean-up. Then the stretch goals: (7) Funnels, (8) Signups, (9) Insight emails. Each is a phase that stops for owner review, as `docs/PLAN.md`'s instructions require.
- Domain comes first because Clerk production needs a custom domain, and every later phase (Stripe webhook URLs, MCP instructions, Resend DNS) depends on the final domain.

### Domain and Clerk production

- The domain is bought at a third-party registrar, so DNS records are added by hand: Vercel's A and CNAME records for the apex and `www`, Clerk's production CNAMEs, and later Resend's records.
- One domain for everything: the homepage at `/`, the app under `/websites` and `/sites/...`, the snippet at `/script.js`, and the APIs under `/api/...`.
- The old `*.vercel.app` production URL stays served. The snippet sends to the host it was loaded from, so old installs keep working. The snippet's install URL now comes from the custom domain, not the Vercel project production URL.
- Clerk moves from the dev instance to a production instance with open sign-up. Convex auth config and env vars switch to the production issuer on Convex prod, and dev keeps the dev instance.
- **Owner-id migration:** owner ids are Clerk `tokenIdentifier`s, which include the issuer. A one-off internal migration rewrites `ownerId` (and any other field keyed by owner) from the dev-issuer form to the prod-issuer form for the owner's account, and is run once on Convex prod right after the switch. It's planned in the same way as earlier migrations.

### Accounts and billing model

- **The billing unit is the account**, meaning one signed-in Clerk user. There are no teams or organizations in V1. All of a user's sites share one subscription and one usage count.
- **New `accounts` table**, keyed by owner id: trial start and end, Stripe customer id, subscription id, plan (starter, growth or scale), interval (month or year), subscription status as Stripe reports it, current period end, cancel-at-period-end, and a `comped` flag. The row is created lazily on the user's first signed-in request, through an idempotent "ensure account" mutation. Existing users get one too: the owner's row is set to comped by an internal mutation.
- **Access state** is worked out in one place from the account row: `comped`, `trialing` (now < trial end), `active` (status active or trialing in Stripe), `past_due` (still allowed: Stripe's retry window), and `locked` (anything else). One shared server helper returns whether data reads are allowed.
- **Server-side enforcement:** every dashboard stats, pages, users, visitors, payments and goals query, and every MCP tool, checks access through the shared helper. Locked accounts get a typed "subscription required" error that the UI turns into the paywall screen. Account-level pages (`/billing`, `/settings`, sign-out) and site management (snippet, delete) stay usable. **Ingest is never gated.**
- **Stripe objects:** one Product per plan and two Prices each (monthly and yearly), matching the homepage `pricing` object. Price ids live in env vars per environment (test on dev, live on prod), and the homepage `pricing` object stays the source of display prices. A test fails if they diverge where it can check.
- **Checkout:** a Convex action creates a Stripe Checkout Session in subscription mode for the chosen price. It reuses or creates the Stripe customer, with the account's owner id in metadata and `client_reference_id`. Success returns to `/billing?checkout=success`, which shows a pending state until the webhook updates the account reactively. There's no polling: the account query is reactive.
- **Customer portal:** a Convex action creates a Billing Portal session for the account's customer and returns its URL. The portal is configured in the Stripe dashboard to allow switching plans and intervals, updating the card, viewing invoices and cancelling at period end.
- **Billing webhook:** a new Convex HTTP route, separate from the per-site revenue webhook (which stays keyed by site). It's verified with the platform's own Stripe signing secret. It handles `checkout.session.completed`, `customer.subscription.created/updated/deleted` and `invoice.payment_failed`, and writes plan, interval, status, period end and cancel flag to the account. It is idempotent: it always re-reads the subscription state from the event rather than applying deltas.
- **Stripe SDK in Convex:** reuse the approach already proven for the revenue webhook (the SDK in the default runtime with the subtle-crypto provider). Actions that call the Stripe API use the same SDK.
- **`/billing` page** replaces the "coming soon" card: current plan and status, renewal or end date, usage meter, plan picker (shown when there's no active subscription, or as "Change plan" through the portal), and a Manage subscription button. Payment-failed and cancelling states show a banner.
- **Top bar:** a "Trial · N days left" pill links to `/billing` while trialing, and a "Payment failed" pill shows when past due.
- **Comping:** an internal mutation sets or clears `comped` for an account, run from the Convex dashboard or CLI. There's no admin UI in V1.

### Usage

- Usage is the number of pageviews plus custom events (goals, outbound, any `track` call) across all the account's sites, in the current calendar month (UTC). Engagement pings are excluded.
- Work it out from the existing daily rollups where they already hold these counts, rather than adding a hot per-account counter at ingest, to avoid write contention on one document. If the rollups can't give custom events per day cheaply, add a per-site per-day event count to the existing daily rollup row, not a new per-account document.
- There's no enforcement. An internal query lists accounts over their plan's limit for the owner.

### MCP

- No code change is expected beyond showing the custom domain in the setup instructions and adding the access check. The check runs Claude Code and Claude Desktop against production with a fresh key, and calls every tool once.

### New site tabs (Revenue, Goals, Outbound)

- Tabs become Analytics | Pages | Users | Revenue | Goals | Outbound | Funnels (once built) | Live | Settings. Revenue shows only when the site has a payments provider. The tab strip scrolls sideways on narrow screens. `?range=`, `?f=` and `?metric=` carry across tabs, as Pages does today.
- Each tab follows the established Pages tab pattern: a header with the range controls, joined stat tiles with change vs the previous period, a chart (per hour on the short ranges, per day otherwise), and a sortable, searchable, paginated table. It reuses the existing tile, chart, table and drawer components.
- **Revenue:** new queries for revenue totals and series (from existing payments and daily rollups), revenue by source and country (already available through the card metric), and a paginated payments list joined to visitors for location, source and journey dots. A row opens the existing visitor drawer.
- **Goals:** extend the existing goals stats with per-goal top source and an "events not yet goals" list. "Manage goals" links to Settings → Goals & conversions. The hidden Events card on Analytics is switched back on. The Funnels placeholder stays hidden until Funnels ships.
- **Outbound:** a query over outbound-click events for the range: totals, unique visitors, distinct links, a series, and per-link clicks, visitors, change and sparkline. Links are grouped by host plus path.
- Homepage: remove "Soon" from Revenue and goal attribution (and from Funnels if it ships), keep it on Search Console and Bing, and re-check the FAQ billing answers against the real behaviour.

### Stretch: Funnels

- **New `funnels` table:** site id, name, ordered steps (each a `page` with a glob pattern, using the excluded-paths matcher, or an `event` with a name), and a completion window in hours.
- CRUD mutations are owner-checked, with up to 8 steps and 20 funnels per site.
- **Computed on demand** for the selected range: a visitor enters at step 1 within the range. For each later step, look for the first matching pageview or event at or after the previous step's time, within the window from entry. Counts per step follow from that. The first version reads the range's raw pageviews and events for the site, bounded like the existing hourly and filtered paths. If that's too slow on 30-day ranges, add a per-day cache table later (noted, not built).
- Cookieless sites (no visitor ids) can't have funnels. The tab says so.

### Stretch: Signups

- A signup is the first time a visitor gets an email or user id through `identify()`. Store `identifiedAt` on the visitor at that moment (with a backfill from existing identified visitors, using the earliest evidence available).
- Free vs Paying: Paying means the visitor has at least one linked payment. Time to sign up is `identifiedAt` minus first seen.
- Queries: totals and series by day (free and paying, daily or cumulative), breakdown by source, country and landing page, and a paginated people list. It reuses the visitor drawer. Emails are shown as the site owner sent them (it's their own users).

### Stretch: Insight emails

- Resend via the Convex Resend component, sending from a subdomain of the new domain, with SPF and DKIM records added at the registrar.
- Account settings gain an Insight emails section with daily (off), weekly (on) and monthly (on) switches, stored on the `accounts` row.
- Convex crons: daily at 07:00 UTC, weekly Mondays at 09:00 UTC, monthly on the 1st at 09:00 UTC. Each finds the opted-in, non-locked accounts and schedules one send per account.
- The email is a React Email template: per site with activity, visitors, pageviews, revenue (when configured) and key-goal completions with change vs the previous period, plus the top 3 sources and pages. Sites with no activity are skipped, and so is the whole email when every site is empty.
- One-click unsubscribe uses a signed token link to an HTTP route that turns off that cadence, plus `List-Unsubscribe` headers.

## Out of Scope

- **Google Search Console and Bing:** deferred until after launch (Google OAuth verification for the Search Console scope). The homepage keeps "Soon".
- Teams, organizations, shared site access and per-seat billing.
- Hard event limits, overage charges, metered billing and automatic plan upgrades.
- Stripe Tax and VAT handling beyond what Stripe Checkout does by default. Coupons beyond Stripe's built-in promotion codes.
- An admin UI for comping or viewing accounts (it's done through internal functions).
- A public demo dashboard with sample data (piqo's `/demo`).
- The Journeys and Ask AI tabs from piqo (the MCP server covers Ask AI for now).
- An Insights page in the app (emails only).
- Funnel caching tables, funnel breakdowns by source, and funnel "Explore journeys".
- Phase 4 of the original plan (the side-by-side run and cancelling Simple Analytics).

## Further Notes

**Rough time per phase**, assuming full days:

| # | Phase | Estimate |
|---|---|---|
| 1 | Domain, Clerk production, owner migration | ~0.5 day, plus DNS wait |
| 2 | Billing: accounts, trial, Checkout, portal, webhook, `/billing`, lock, usage | ~1.5–2 days |
| 3 | MCP end-to-end check on the domain | ~1–2 hours |
| 4 | Goals and Outbound tabs, Events card back | ~1 day |
| 5 | Revenue tab and real Stripe test payment | ~0.5–1 day |
| 6 | Homepage and FAQ clean-up | ~1–2 hours |
| 7 | Funnels (stretch) | ~1.5 days |
| 8 | Signups (stretch) | ~1 day |
| 9 | Insight emails (stretch) | ~1 day |

The launch blockers come to roughly 4–5 days, and all three stretch goals add about 3.5 more.

**Things the owner has to do outside the code:**

- Buy the domain and add DNS records at the registrar.
- Create the Clerk production instance (it needs the domain), and set up Google and other social sign-in providers with their own OAuth credentials for production.
- In Stripe: activate the account for live mode, set up the customer portal, and create the products and prices (Claude can script these through the API or CLI with a key you provide).
- Create a Resend account and verify the sending domain (stretch).
- Update the snippet on the eight existing sites to the new domain when convenient. It isn't urgent, because the old URL keeps working.

**Risks:**

- The Clerk production switch is the riskiest step, because of the owner-id migration. Take a Convex prod snapshot first.
- Funnel computation over 30 days of raw rows might hit Convex read limits on the busiest site. Measure it on prod data before shipping, and fall back to shorter ranges or caching.
- DNS propagation and Stripe live-mode activation can each take hours. Start both on day one.

# Plan: Design v4, piqo look, Pages, Users, settings and MCP

> Source PRD: `plans/dashboard-design-v4.md` (owner's brief `plans/dashboard-design-v4-brief.md`, screenshots in `public/design-v4/`)

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes** (all under `/sites/[domain]`):
  - `/` (Analytics), `/pages`, `/users`, `/live` and `/settings`.
  - `/customers` redirects to `/users?kind=customers`. `/visitors/[visitorId]` redirects to `/users?visitor=<id>`.
  - The MCP endpoint is `/api/mcp`. Like `/api/collect`, it's public in the proxy and authenticated by a Bearer key.
- **URL state**:
  - `?range=` and `?f=` work as today and carry across the Analytics / Pages / Users tabs.
  - `?metric=visitors|pageviews|revenue` is the card toggle.
  - `?page=<path>` and `?visitor=<id>` open the drawers.
  - `?kind=all|customers` is the Users toggle. `?section=<id>` picks the settings section: tracking, timezone, goals, revenue, mcp, identity, ignore, paths, excluded or danger.
- **Theme**:
  - One border token, `--line`: `#1f1f1f` in dark, a light grey in light. `--border`, `--input` and the sidebar border all point at it.
  - Series tokens `--series-visitors`, `--series-pageviews`, `--series-revenue` and `--series-goal` (blue, light blue, green, purple), in both themes. Light mode and the theme toggle stay.
- **Schema** (all additions are optional fields or new tables, so deploys are safe):
  - `dailyDims` page rows gain `sessions`, `bounces`, `engagedMs` and `durationCount`.
  - New `pageTitles` table: siteId, path, title, updatedAt, indexed by site + path.
  - `visitors` gains denormalised totals: pageviews, engagedMs, latest country/region/city, device, browser, latest entry and exit paths.
  - `sites` gains `cookieless`, `excludedPaths` (string array) and `pathGrouping` (enabled, placeholder, ordered named patterns).
  - New `apiKeys` table: ownerId, name, hash, prefix, createdAt, lastUsedAt, revokedAt, indexed by hash and by owner.
- **Ingest order**, for every hit type: site lookup → excluded paths drop → path grouping rewrite → strip ids if the site is cookieless → store and roll up. Path matching and grouping are pure functions shared by the collect route and Convex.
- **Auth**:
  - UI queries stay behind `requireSite` (Clerk `tokenIdentifier` owner).
  - MCP requests go through public Convex functions guarded by `INGEST_SECRET`. They resolve a hashed API key to its owner, then call the same owner-id-taking stats helpers as the UI. There is no second copy of the stats maths.
- **Backfills**: one-off, self-rescheduling migrations per site, like 5b's: per-page rollups (Phase 6) and visitor totals (Phase 9). Run each once on Convex prod after deploy.
- **Script**: hand-written in `src/script/script.js`, staying under 3 KB gzipped. Phases 7, 15 and 16 touch it.
- **Checks at the end of every phase**: `npm run build`, `npx tsc --noEmit`, `npm run lint`, and `npm test` clean. Look in Chrome in both themes and at 375px. Update `docs/PROGRESS.md`.

---

## Phase 1: Theme tokens and dashboard clean-up

**User stories**: 1–11, 15–17

### What to build

Move the app to piqo's palette:

- Near-black backgrounds and cards in dark, with matching light values.
- The single `--line` border token that every border uses.
- The four series tokens, plus a subtle tint for row share bars.

On the dashboard, stop rendering the Filter button and the Events | Funnels row (the components stay in the code). The user menu trigger shows only the initials circle. Every existing page (Websites, account, add website, Live, settings, customers) picks up the tokens without layout changes.

### Acceptance criteria

- [ ] Changing `--line` in one place changes every border in the app, in both themes.
- [ ] Dark borders measure `#1f1f1f`. Light borders are a light grey.
- [ ] No Filter button, Events or Funnels card on the dashboard. Click-to-filter and the chips still work.
- [ ] The user button shows initials only, and the email still shows inside the menu.
- [ ] Positive and negative change colours are unchanged in meaning (lower bounce is still good).
- [ ] Every signed-in page reads well in light and dark.

---

## Phase 2: Bar-and-line chart

**User stories**: 5–7, 18–23

### What to build

Redraw the dashboard chart:

- Visitors as blue bars in every bucket.
- Pageviews as a light-blue line with a soft fill over them.
- Revenue (green) and key goal (purple) as extra bars in the same bucket when present.

Tiles get a dot in their series colour, which turns grey when the series is off, and they keep toggling series. The tooltip lists each visible series with its colour. Daily and hourly ranges share the same composition.

### Acceptance criteria

- [ ] A site with no revenue and no key goal shows Visitors bars and a Pageviews line on every range.
- [ ] A site with revenue shows green bars beside the Visitors bars. With a key goal set, purple bars appear too.
- [ ] Turning a tile off hides its series and greys its dot.
- [ ] Today, Yesterday and 24h (hourly) look the same as 7d and 30d (daily).
- [ ] The tooltip shows every visible series with matching colours, in both themes.

---

## Phase 3: Card metric toggle

**User stories**: 24–30

### What to build

Replace the Visitors ⇄ Revenue switch with a three-way metric shared by all cards and kept in `?metric=`. Clicking any card's top-right label cycles Visitors → Pageviews → Revenue. Revenue is only in the cycle when the site's revenue source isn't None. Rows rank, number and bar by the chosen metric, and rows with zero drop out. This works in both the rollup view and the filtered (`?f=`) view, and on the Map tab.

### Acceptance criteria

- [ ] One click changes every card's metric. Reloading keeps it.
- [ ] Sites without revenue cycle Visitors ⇄ Pageviews only.
- [ ] Rows re-rank by the chosen metric, and zero rows disappear.
- [ ] Works with a filter set (`?f=device:mobile`) as well as without.
- [ ] The button is keyboard reachable and announces the current metric.
- [ ] Tests cover the metric ranking for rollup and filtered results.

---

## Phase 4: Dotted world map

**User stories**: 31–37

### What to build

Replace the choropleth on the Map tab with a dot-matrix world map:

- One blue bubble per country, at a static country centroid, sized by the chosen metric (square-root scale).
- Hovering shows "flag · country · N <metric>". Clicking filters by that country and outlines it while filtered.
- Unknown traffic is left off the map.
- The map is still lazy-loaded and uses the existing country breakdown (no backend change).

### Acceptance criteria

- [ ] The Map tab shows a dotted map with bubbles only for countries in the Countries list (minus Unknown).
- [ ] Bubble sizes follow the card metric.
- [ ] The tooltip and click-to-filter work, and the filtered country is outlined.
- [ ] Readable in both themes and at 375px.
- [ ] The map code is fetched only when the tab opens.

---

## Phase 5: Pages tab, first cut

**User stories**: 12 (Pages tab), 14, 38, 40, 43–44, 47–51, 60–61

### What to build

Add the Pages tab and `/sites/[domain]/pages`:

- The "Pages" header with the range in words, and the same range controls as Analytics.
- An **All pages** table with a page count, built from today's page rollups. Each row has the path, a trend sparkline, views with share, visitors and revenue ("–" when none).
- Sort by any column (default views, descending), search by path, and 50 rows per page with Previous / Next and "1–50 of N".
- `?range=` and `?f=` carry across the Analytics, Pages and Users tab links. Filters apply through the bounded filtered view.
- Empty, loading and over-budget states. The table scrolls sideways on phones.

### Acceptance criteria

- [ ] The Pages tab appears in the top bar, and the range carries over from Analytics.
- [ ] Table counts match the Pages card on Analytics for the same range.
- [ ] Sorting, search and pagination work. The sparklines follow the daily views.
- [ ] With `?f=` set, the table reflects the filter.
- [ ] Ownership tests: someone else's site gives nothing.

---

## Phase 6: Per-page rollups and backfill

**User stories**: 39, 45–46

### What to build

Roll up per-page sessions, bounces, engaged time and duration count at ingest:

- A page's sessions are the sessions that viewed it.
- Bounce goes to the entry page of a one-pageview, no-goal session.
- Duration comes from pings.

Then:

- Run a one-off backfill from stored sessions and pageviews.
- The Pages table gains Sessions (with change against the previous period), Bounce and Duration.
- Add the tiles: Pages viewed, Pageviews (with change), Sessions, Avg. bounce, Avg. duration.

### Acceptance criteria

- [ ] New hits update the page row's sessions, bounces and time. Tests cover a bounce, a multi-page session and a ping.
- [ ] After the backfill on dev, per-page sessions add up to site sessions for a backfilled range.
- [ ] Bounce and duration per page match a hand count on dev data.
- [ ] Cookieless days show duration, and "–" for sessions and bounce.
- [ ] The tiles show correct values and changes.

---

## Phase 7: Page titles

**User stories**: 41–42

### What to build

The script sends `document.title` (trimmed, capped) with each pageview. Ingest upserts the latest non-empty title per path into `pageTitles`. The Pages table shows the title above the path, and paths without a title show only the path.

### Acceptance criteria

- [ ] A test hit with a title shows that title above its path.
- [ ] A later hit with a new title replaces it, and an empty title doesn't overwrite.
- [ ] Old paths show the path alone.
- [ ] The script stays under 3 KB gzipped, and `script.test.ts` covers the title.

---

## Phase 8: Page drawer

**User stories**: 52–59

### What to build

Clicking a Pages row opens a right-side drawer (full width on phones), with its state in `?page=<path>`. It shows:

- The title, and the full URL opening the live page in a new tab.
- Visitors, Pageviews, Bounce and Avg. time tiles.
- A daily pageviews bar chart.
- Sources / Countries / Devices / Browsers lists for that page.

It uses the filtered view with `page:<path>`. Escape and the close button return focus to the row.

### Acceptance criteria

- [ ] Opening, reloading and sharing `?page=/x` show the same drawer.
- [ ] The drawer's numbers match the page's row and the dashboard filtered by `page:/x`.
- [ ] Keyboard: focus moves into the drawer, Escape closes it, and focus returns to the row.
- [ ] Usable at 375px.

---

## Phase 9: Users tab and visitor table

**User stories**: 12 (Users tab), 13, 65–75, 85

### What to build

Add denormalised totals to `visitors`, kept up to date at ingest, and run a one-off backfill. Add the Users tab and `/sites/[domain]/users`, replacing Customers in the tabs. Customers redirects to `/users?kind=customers`.

The **All visitors** table lists visitors seen in the range, newest first, paginated. Each row shows:

- Avatar and name (persona, or identified name/email)
- Location
- Source with its favicon
- Device · browser
- Sessions, pageviews and time
- Latest entry → exit

There is an **All | Customers** toggle (customers show revenue) and search by name, email, id, country or path. Cookieless sites see an explanation instead of an empty table.

### Acceptance criteria

- [ ] New hits keep a visitor's totals and latest details current. After the backfill on dev, totals match the visitor's sessions.
- [ ] The table lists only visitors seen in the range.
- [ ] The Customers toggle lists the same people the old Customers page did.
- [ ] `/sites/[domain]/customers` lands on Users with Customers on.
- [ ] Search finds visitors by each field. Reads stay within budget, with a notice when truncated.
- [ ] Ownership tests pass, and a cookieless site shows the explanation.

---

## Phase 10: Users header

**User stories**: 62–64

### What to build

Above the table, add:

- Tiles for Visitors, Pageviews, Views per visitor and Avg. time on site, each with change against the previous period.
- A daily visitors bar chart.
- A Sources / Countries / Devices card ranked by visitors.

All are built from the daily rollups and dims, and honour `?f=`.

### Acceptance criteria

- [ ] Tile values match the Analytics tiles for the same range.
- [ ] The chart matches the daily visitors.
- [ ] The card's tabs match the corresponding Analytics lists.
- [ ] Laid out like the reference on desktop, and stacked at 375px.

---

## Phase 11: Visitor drawer

**User stories**: 76–84

### What to build

Clicking a Users row opens a drawer, with its state in `?visitor=<id>`. It shows:

- Avatar, name and "N sessions · N pageviews · time".
- Time on site, Sessions, Pages and Events tiles.
- A "First visit" block: landing page, source, date and time.
- A Journey section per session: number, date, source, location · browser · device · duration · pages · events. Each lists its pageviews, goals (with props), outbound clicks and payments, with times and Entry/Exit marks.

It reuses and extends the existing profile query. The old visitor profile route redirects here.

### Acceptance criteria

- [ ] The drawer shows the same journey the old profile page did, plus first visit and per-session counts.
- [ ] `/sites/[domain]/visitors/<id>` lands on Users with that drawer open.
- [ ] Reload and share keep the drawer, and the keyboard behaviour matches the page drawer.
- [ ] A missing visitor, or one from someone else's site, shows "not found".

---

## Phase 12: Settings sidebar layout

**User stories**: 86–91

### What to build

Rebuild site Settings as a two-column page:

- A grouped section sidebar: Install, Attribution, Integrations, Privacy, Filtering and Danger zone.
- One section on the right with a title, a description and a bordered card, picked by `?section=` (default `tracking`).

Move today's Tracking code (snippet), Timezone, Goals & conversions, Revenue attribution and Delete into their sections, unchanged in behaviour. Danger zone is red. On phones the sidebar becomes a select or a scrollable row. Sections for later phases aren't listed until they exist.

### Acceptance criteria

- [ ] Every existing setting still works from its new section.
- [ ] `?section=` deep-links and survives a reload.
- [ ] Works at 375px and in both themes.

---

## Phase 13: Excluded paths

**User stories**: 106–109

### What to build

A Filtering → **Excluded paths** section holds a list of glob patterns (add, remove, Save only when changed, capped and validated), saved on the site. Ingest drops pageviews, goals and outbound clicks whose path matches, before anything is stored. The section says the rule applies to new hits only.

### Acceptance criteria

- [ ] A hit on `/admin/x` with `/admin/*` excluded stores nothing and bumps no rollups.
- [ ] Goals and outbound clicks on excluded paths are dropped too.
- [ ] Unit tests cover glob matching (wildcards, exact, trailing slashes).
- [ ] Invalid patterns are rejected with a message.

---

## Phase 14: Page path grouping

**User stories**: 100–105

### What to build

A Filtering → **Page paths** section has:

- An enable switch (off by default).
- A placeholder name (default `:id`).
- An ordered list of named patterns, with a live preview of what an example path becomes.

At ingest, when grouping is enabled, the path is rewritten by the named patterns first (first match wins), then by auto-detection (UUIDs, long digit runs, long hashes). The rewritten path is what's stored, rolled up and titled. Plain slugs are untouched.

### Acceptance criteria

- [ ] With grouping on, `/orders/123456` and `/orders/987654` land on one `/orders/:id` row.
- [ ] Named patterns win over auto-detection. `/pricing` is untouched.
- [ ] Unit tests cover UUIDs, digit runs, hashes, named patterns and the off state.
- [ ] The preview matches what ingest stores.

---

## Phase 15: Visitor identity

**User stories**: 92–96

### What to build

A Privacy → **Visitor identity** section offers Cookies or Cookieless, saved as `sites.cookieless`, and explains what cookieless loses. When it's set:

- Ingest strips visitor and session ids from every hit.
- The collect reply tells the script, and the script stops setting cookies and clears its own.

`data-cookieless` keeps working. The Users tab's cookieless explanation links here.

### Acceptance criteria

- [ ] With Cookieless set, a hit carrying ids is stored without them.
- [ ] After one hit, the browser has no `_va_` cookies and sends no ids afterwards.
- [ ] Switching back to Cookies resumes ids on the next visit.
- [ ] `data-cookieless` sites behave as before. Script tests cover the reply, and the size stays under budget.

---

## Phase 16: Ignore my visits

**User stories**: 97–99

### What to build

A Filtering → **Ignore my visits** section shows two links built from the domain (`?_va_ignore=1` and `?_va_ignore=0`) and explains that the switch is per browser and per site. The script stores or clears the flag in `localStorage` and sends nothing at all while it's set.

### Acceptance criteria

- [ ] After opening the ignore link, page loads, goals and outbound clicks send no requests.
- [ ] The undo link resumes tracking.
- [ ] Script tests cover both links, and the size stays under budget.

---

## Phase 17: MCP server

**User stories**: 110–119

### What to build

An account Settings **MCP server** section:

- Create a named key (shown once, with Copy).
- List keys with name, prefix, created and last used.
- Revoke a key.
- Ready-to-paste setup for Claude Code, Claude Desktop and Cursor.

Keys are stored hashed in `apiKeys`.

`/api/mcp` is a Streamable HTTP MCP endpoint (Node.js runtime, public in the proxy). It checks the Bearer key through `INGEST_SECRET`-guarded Convex functions and serves read-only tools:

- `list_sites`
- `get_summary`
- `get_timeseries`
- `get_breakdown`
- `get_pages`
- `get_visitors`
- `get_visitor_journey`
- `get_live`

Tools take a domain, the existing range grammar and the filter syntax, and return compact JSON that echoes back the range and timezone. Stats logic is shared with the UI through owner-id-taking helpers. The site Settings → Integrations → **MCP server** section shows the setup with that domain filled in and links to the account keys.

### Acceptance criteria

- [ ] `claude mcp add --transport http … --header "Authorization: Bearer <key>"` connects, and `list_sites` returns the owner's domains.
- [ ] Each tool's numbers match the UI for the same domain, range and filter.
- [ ] Missing, wrong and revoked keys get 401. Someone else's domain returns "not found".
- [ ] `lastUsedAt` updates (at most once a minute). Revoking takes effect immediately.
- [ ] Tests cover key hashing, owner resolution, revocation and tool ownership.

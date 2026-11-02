# PRD: Design v4, piqo look, Pages, Users, settings and MCP

Owner's brief: `plans/dashboard-design-v4-brief.md`. Screenshots: `public/design-v4/` (Dashboard, pages, users, settings; local only). Builds on design v3 (`plans/dashboard-design-v3.md`, `docs/PROGRESS.md`).

## Problem Statement

Design v2 and v3 gave the app a consistent shadcn look, but it still reads as a neutral grey template, and the site pages stop at a single dashboard:

- The colours are flat greys. The borders are a 10% white that varies with what sits behind it. The chart only shows bars when a site has revenue or a key goal, and most sites have neither, so the chart is two grey areas.
- The dashboard shows things that don't work yet: the Events and Funnels cards at the bottom, and a disabled Filter button.
- The user button in the top right shows the email, which the menu already shows.
- Each card's top-right label ("Visitors ⇅") only switches between Visitors and Revenue. Most sites have no revenue, so in practice the switch does nothing useful, and there's no way to rank by pageviews.
- The Map tab is a filled choropleth. It is hard to read with few countries and looks unlike the rest of the page.
- There is no per-page view. You can see the top pages in a card, but not each page's sessions, bounce, time or trend, and you can't drill into one page.
- There is no list of visitors. The Customers tab only lists paying or key-goal visitors, and the profile is a separate full page.
- Site settings is one long scroll (snippet, timezone, goals, revenue, delete), with no room to grow. Useful basics are missing: excluding paths, ignoring your own visits, grouping dynamic paths, and choosing the cookie mode without editing the snippet.
- There is no way to ask an AI assistant about the stats. The owner wants an MCP server.

## Solution

1. **Piqo palette in both themes.** Near-black backgrounds and cards in dark, one shared border colour token (`#1f1f1f` in dark, a matching light grey in light) used by every border, and colour accents: blue for visitors and pageviews, green for revenue, purple for the key goal. Each stat tile has a small coloured dot that matches its chart series. Light mode stays, with the same accents.
2. **Dashboard clean-up.** The Filter button is hidden (click-to-filter and the filter chips still work). The Events and Funnels cards are hidden. The user button shows only the initials circle.
3. **A chart that always has bars.** Visitors are drawn as blue bars in every bucket. Pageviews are a line with a soft fill over them. Revenue (green) and key-goal (purple) bars sit next to the Visitors bar when the site has them. The tiles still switch series on and off.
4. **One metric toggle for every card.** The top-right label on each card cycles **Visitors → Pageviews → Revenue** (Revenue only on sites with revenue). The choice is shared by every card and kept in the URL. Rows rank and bar by the chosen metric.
5. **A dotted world map.** The Map tab becomes a dot-matrix world map with one blue bubble per country, at the country's centre, sized by the chosen metric. Hovering shows "flag · country · N visitors", and clicking filters by that country, as before.
6. **Pages tab.** A new **Pages** page: tiles (Pages viewed, Pageviews, Sessions, Avg. bounce, Avg. duration) and an **All pages** table. Each row shows the page title over its path, a trend sparkline, views with their share, sessions with their change, bounce, duration and revenue. The table can be sorted and searched, and is paginated. Clicking a row opens a right-side drawer for that page: its tiles, a daily pageviews bar chart, and Sources / Countries / Devices / Browsers lists for that page.
7. **Users tab.** **Users** replaces Customers. It has tiles (Visitors, Pageviews, Views per visitor, Avg. time on site), a daily visitors bar chart, and a Sources / Countries / Devices card. Below them, an **All visitors** table lists every visitor seen in the range: avatar and name, location, source, device · browser, sessions, pageviews, time, and entry → exit. It has an **All | Customers** toggle and a search box. Clicking a row opens a drawer with the visitor's summary, first visit and full session-by-session journey.
8. **Tabs.** Site tabs become **Analytics | Pages | Users | Live | Settings**.
9. **Settings with a sidebar.** Site settings becomes a two-column page: a grouped section list on the left (selected section in `?section=`), with one section shown on the right. The V1 sections:
   - **Install:** Tracking code, Timezone
   - **Attribution:** Goals & conversions, Revenue attribution
   - **Integrations:** MCP server
   - **Privacy:** Visitor identity
   - **Filtering:** Ignore my visits, Page paths, Excluded paths
   - **Danger zone**
10. **MCP server.** A read-only MCP server at the app's own URL, authenticated by an account-wide API key that you create and revoke in account Settings. Tools list your sites and read their stats: summary, timeseries, breakdowns, pages, visitors, a visitor's journey and the live count.

## User Stories

### Look and theme

1. As the owner, I want the dashboard to use piqo's near-black backgrounds and cards in dark mode, so that it looks as polished as the reference.
2. As the owner, I want every border in the app to be the same colour, from one token, so that the look is consistent and I can change it in one place.
3. As the owner, I want the border token to be `#1f1f1f` in dark mode, so that the borders match the reference.
4. As the owner, I want light mode to keep working, with a matching light border and the same accent colours, so that I can still use the app in daylight.
5. As the owner, I want visitors and pageviews in blue, revenue in green and the key goal in purple everywhere they appear (tiles, chart, legends), so that I can tell series apart at a glance.
6. As the owner, I want each stat tile to show a small dot in its series colour, so that I can match tiles to the chart.
7. As the owner, I want greyed-out tiles (series switched off) to show a grey dot, so that I can see which series are on.
8. As the owner, I want the list rows' share bars to be a subtle tint on the card background, so that rows stay readable in both themes.
9. As the owner, I want positive changes in green and negative ones in red, keeping today's rule that a lower bounce rate is good, so that I read changes the same way everywhere.
10. As the owner, I want the Live, Websites, account and add-website pages to use the same tokens, so that nothing looks left behind.

### Top bar

11. As the owner, I want the user button to show only my initials circle, so that the bar is less cluttered (the email is already in the menu).
12. As the owner, I want the site tabs to read Analytics | Pages | Users | Live | Settings, with icons like piqo, so that I can reach every site view in one click.
13. As the owner, I want the old Customers URL to take me to Users with the Customers filter on, so that my bookmarks keep working.
14. As the owner, I want the selected range to carry over when I switch between Analytics, Pages and Users, so that I compare like with like.

### Dashboard

15. As the owner, I want the Filter button hidden until filtering by menu works, so that I don't click something dead.
16. As the owner, I want filter chips and click-to-filter to keep working, so that I lose nothing that works today.
17. As the owner, I want the Events and Funnels cards hidden, so that the page only shows what works.
18. As the owner, I want Visitors drawn as bars in every bucket, so that the chart always has bars, even on sites with no revenue.
19. As the owner, I want Pageviews drawn as a line with a soft fill over the bars, so that I can compare pageviews with visitors.
20. As the owner, I want Revenue and key-goal bars beside the Visitors bar when they are present, so that I can see money and conversions against traffic.
21. As the owner, I want the tiles to keep switching series on and off, so that I can focus the chart.
22. As the owner, I want the tooltip to list every visible series with its colour, so that I can read exact values.
23. As the owner, I want hourly ranges (Today, Yesterday, 24h) to use the same bar-and-line chart, so that every range looks the same.

### Card metric toggle

24. As the owner, I want the top-right label on every card to be a button that cycles Visitors → Pageviews → Revenue, so that I can rank lists by what matters right now.
25. As the owner, I want Revenue left out of the cycle on sites without revenue, so that I never land on an empty ranking.
26. As the owner, I want one click to change every card at once, so that the whole dashboard speaks one metric.
27. As the owner, I want the choice in the URL, so that a reload or a shared link keeps it.
28. As the owner, I want each row's number and share bar to follow the chosen metric, so that the ranking is visible.
29. As the owner, I want rows with zero of the chosen metric to drop out of the list, so that a revenue ranking only shows earners.
30. As the owner, I want the button to be keyboard reachable and to announce the current metric, so that it's accessible.

### Map

31. As the owner, I want the Map tab to show a dotted world map, so that it matches the reference and looks good with few countries.
32. As the owner, I want one blue bubble per country, at its centre, sized by the chosen metric, so that I see where traffic comes from at a glance.
33. As the owner, I want hovering a bubble to show the flag, country name and count, so that I get exact numbers.
34. As the owner, I want clicking a bubble to filter the dashboard by that country (and outline it while filtered), so that the map works like the lists.
35. As the owner, I want the map readable in both themes, so that light mode isn't an afterthought.
36. As the owner, I want "Unknown" country traffic left off the map but kept in the Countries list, so that the map is honest.
37. As the owner, I want the map code loaded only when I open the Map tab, so that the dashboard stays fast.

### Pages tab

38. As the owner, I want a Pages tab with a header "Pages" and the range in words, so that it reads like Analytics.
39. As the owner, I want tiles for Pages viewed (unique paths), Pageviews (with change), Sessions, Avg. bounce and Avg. duration, so that I see the shape of page traffic.
40. As the owner, I want an All pages table with a count of pages, so that I can see every page, not just the top seven.
41. As the owner, I want each row to show the page's title above its path, so that I recognise pages by name.
42. As the owner, I want rows with no recorded title to show just the path, so that old data still reads well.
43. As the owner, I want a trend sparkline per page over the range, so that I can spot pages that are rising or falling.
44. As the owner, I want views with their share of all pageviews, so that I see each page's weight.
45. As the owner, I want sessions with their change against the previous period, in green or red, so that I see momentum.
46. As the owner, I want bounce rate and average duration per page, so that I can judge content quality.
47. As the owner, I want revenue per page where there is any, and "–" otherwise, so that I see which pages lead to money.
48. As the owner, I want to sort by any column (default: views, descending), so that I can find winners and losers.
49. As the owner, I want a search box that filters the table by path or title, so that I can find a page fast.
50. As the owner, I want 50 rows per page with Previous / Next and a "1–50 of N" label, so that large sites stay usable.
51. As the owner, I want the table to scroll sideways on a phone instead of breaking the layout, so that it works on mobile.
52. As the owner, I want clicking a row to open a drawer from the right, so that I can drill in without losing my place.
53. As the owner, I want the drawer to show the page's title, its full URL (opening the live page in a new tab) and a close button, so that I know what I'm looking at.
54. As the owner, I want the drawer to show Visitors, Pageviews, Bounce and Avg. time tiles for that page, so that I get its summary.
55. As the owner, I want a pageviews bar chart for that page over the range, so that I see when it got traffic.
56. As the owner, I want Sources / Countries / Devices / Browsers lists for that page, so that I see who reads it.
57. As the owner, I want the open drawer in the URL (`?page=/path`), so that I can share or reload it.
58. As the owner, I want Escape and the close button to close the drawer and return focus to the row, so that it's keyboard friendly.
59. As the owner, I want the drawer full width on a phone, so that it's usable on mobile.
60. As the owner, I want empty and loading states on the tab ("No pageviews in this range"), so that it never looks broken.
61. As the owner, I want the Pages tab to honour active filters from the URL, so that I can look at pages for one source or country.

### Users tab

62. As the owner, I want a Users tab with tiles for Visitors, Pageviews, Views per visitor and Avg. time on site, each with change against the previous period, so that I see audience health.
63. As the owner, I want a daily visitors bar chart beside the tiles, so that I see audience over time.
64. As the owner, I want a Sources / Countries / Devices card beside the chart, ranked by visitors, so that I see where my audience comes from.
65. As the owner, I want an All visitors table with a count, listing everyone seen in the range, newest first, so that I can look at real people.
66. As the owner, I want each row to show the visitor's avatar and name (the existing persona, or their identified name or email), so that rows are recognisable.
67. As the owner, I want location (flag and country, plus city when known), so that I know where they are.
68. As the owner, I want their source with its favicon, so that I know how they found me.
69. As the owner, I want device · browser, so that I know what they use.
70. As the owner, I want sessions, pageviews and time on site, so that I see how engaged they are.
71. As the owner, I want their latest entry → exit path, so that I see what they did last.
72. As the owner, I want an All | Customers toggle, where Customers means visitors who paid or hit the key goal, so that I can still see my converters.
73. As the owner, I want customers to show their revenue, so that the old Customers view isn't lost.
74. As the owner, I want a search box matching name, email, visitor id, country or path, so that I can find someone.
75. As the owner, I want the table paginated, so that big sites stay fast.
76. As the owner, I want clicking a row to open a visitor drawer, so that I can read their story without leaving the list.
77. As the owner, I want the drawer header to show the avatar, name and "N sessions · N pageviews · time on site", so that I get the gist at once.
78. As the owner, I want tiles for Time on site, Sessions, Pages and Events, so that I see engagement in numbers.
79. As the owner, I want a "First visit" block (landing page, source, date and time), so that I see how they arrived.
80. As the owner, I want a Journey section listing each session (number, date, source, location · browser · device · duration · pages · events), so that I see every visit.
81. As the owner, I want each session to list its pageviews, goals and outbound clicks with times, marking the Entry and Exit pages and showing goal properties, so that I can follow their path.
82. As the owner, I want payments shown in the journey where they happened, so that I see what led to a sale.
83. As the owner, I want the open drawer in the URL (`?visitor=<id>`), so that I can link to a person.
84. As the owner, I want the old visitor profile URL to redirect to Users with that drawer open, so that existing links work.
85. As the owner, I want a cookieless site's Users tab to explain that it has no visitor ids (and link to Visitor identity), instead of showing an empty table, so that I understand why.

### Settings layout

86. As the owner, I want site settings to have a left sidebar of sections grouped under Install, Attribution, Integrations, Privacy, Filtering and Danger zone, so that I can find things.
87. As the owner, I want one section on the right with a title, a short description and a bordered card, so that each setting has room to explain itself.
88. As the owner, I want the section in the URL (`?section=tracking`), so that I can link to it, and Tracking code by default.
89. As the owner, I want the sidebar to become a select or a scrollable row on a phone, so that settings work on mobile.
90. As the owner, I want Danger zone in red, so that I don't click it by accident.
91. As the owner, I want Tracking code, Timezone, Goals & conversions, Revenue attribution and Danger zone to keep everything they do today, so that nothing is lost in the move.

### Visitor identity

92. As the owner, I want a Visitor identity setting with "Cookies (visitor and session ids)" or "Cookieless", so that I can pick the privacy mode without editing the snippet.
93. As the owner, I want a cookieless site's hits stored without ids even if an old snippet sends them, so that the setting is enforced on our side.
94. As the owner, I want the script to stop setting cookies, and clear existing ones, once the server tells it the site is cookieless, so that visitors' browsers follow the setting.
95. As the owner, I want the `data-cookieless` attribute to keep working, so that sites already using it don't change.
96. As the owner, I want the section to say what each mode loses (visitors, sessions, journeys, Users), so that I choose knowingly.

### Ignore my visits

97. As the owner, I want a link I can open once on my site that makes that browser stop being tracked, and another link to undo it, so that my own testing doesn't skew the stats.
98. As the owner, I want the section to explain that this works per browser and per site, so that I know to repeat it on my phone.
99. As the owner, I want the script to send nothing at all from an ignored browser, so that nothing leaks through.

### Page paths

100. As the owner, I want a "Group dynamic path IDs" switch that collapses UUIDs, all-number segments and long hashes into a placeholder (default `:id`), so that per-record pages group into one row.
101. As the owner, I want to choose the placeholder name, so that it reads well for my site.
102. As the owner, I want named patterns like `/dashboard/:site_id/sites`, matched top to bottom before auto-detection, so that my routes get real names.
103. As the owner, I want plain slugs like `/pricing` left alone, so that grouping never hides real pages.
104. As the owner, I want grouping off until I turn it on, and to apply to new hits only, so that it's predictable.
105. As the owner, I want a live preview of what an example path becomes, so that I can check a pattern before saving.

### Excluded paths

106. As the owner, I want a list of glob patterns (`/admin/*`, `/preview`) whose hits are dropped at ingest, so that internal pages never count.
107. As the owner, I want to add and remove patterns, with Save disabled until something changes, so that edits are deliberate.
108. As the owner, I want exclusion to apply to pageviews, goals and outbound clicks on those paths, so that nothing from them counts.
109. As the owner, I want to be told it applies to new hits only, so that I don't expect history to change.

### MCP server

110. As the owner, I want an MCP server section in account Settings where I can create an API key, see it once, copy it, and revoke it, so that I control access.
111. As the owner, I want to see each key's name, its prefix, when it was created and when it was last used, so that I can spot stale keys.
112. As the owner, I want ready-to-paste setup for Claude Code (`claude mcp add …`), Claude Desktop and Cursor, so that connecting takes a minute.
113. As the owner, I want the site Settings' "MCP server" section to show the same setup and link to account Settings for keys, so that I find it from either place.
114. As the owner, I want a `list_sites` tool, so that the assistant knows my domains.
115. As the owner, I want summary, timeseries and breakdown tools (sources, channels, pages, entry/exit, countries, regions, cities, devices, browsers, OS, UTM tags, goals, outbound), taking a domain, a range and optional filters, so that the assistant can answer most questions.
116. As the owner, I want tools for the pages table, the visitors list, one visitor's journey and the live count, so that the assistant can go as deep as the UI.
117. As the owner, I want every tool to be read-only, so that an assistant can't change my sites.
118. As the owner, I want a revoked or wrong key to get a clear 401, and a site I don't own to look the same as one that doesn't exist, so that nothing leaks.
119. As the owner, I want tool results as compact JSON with the range and timezone echoed back, so that answers are accurate and cheap.

## Implementation Decisions

### Theme tokens

- Add a `--line` token (the shared border colour): `#1f1f1f` in dark, a light grey in light. Point `--border`, `--input` and the sidebar border at it, so that every border and the `border-border` base rule use one value. One edit changes every border.
- Dark backgrounds and cards move to piqo's near-black values. Add series tokens `--series-visitors`, `--series-pageviews`, `--series-revenue` and `--series-goal` (blue, lighter blue, green, purple), with light-mode values tuned for contrast. The chart config and the tile dots read these tokens. The monochrome chart tokens are retired.
- The row share bar uses a subtle tint token, so that it reads in both themes.
- Light mode and `next-themes` stay. The theme toggle stays.

### Dashboard

- The Filter button is not rendered. Click-to-filter, `?f=` and the chips are unchanged.
- The Events | Funnels row is not rendered. Its components stay in the code for later. The Goals settings and `stats.goals` are untouched.
- `UserMenu`'s trigger drops the email span.
- Chart: Visitors become bars, Pageviews an area/line over them, and Revenue and key goal are extra bars in the same bucket group. Tile toggles keep driving visibility. Hourly and daily series use the same composition.
- Card metric: the existing Visitors ⇄ Revenue switch becomes a three-way metric (`visitors | pageviews | revenue`) in a URL param shared by all cards. `rankEntries` and the breakdown queries already carry pageviews, visitors and revenue per key, and the filtered view must return the same three. Revenue is offered only when the site's revenue source isn't None. For session dims, "pageviews" is whatever the rollups already store per key. If a dim has no pageviews count, the toggle skips Pageviews for that card and the label says so.
- Map: replace the choropleth with a dot-matrix world map (precomputed land dots, rendered as SVG) and a static country-centroid table. Bubble radius scales with the square root of the value. Data comes from the existing country breakdown, so no backend change. It is still lazy-loaded.

### Navigation and routes

- Site tabs: Analytics, Pages, Users, Live, Settings, with lucide icons. `SiteSection` gains `pages` and `users` and drops `customers`.
- New routes under the site: `pages` and `users`, each a Suspense-wrapped client page like the others.
- The `customers` route redirects to `users` with the Customers filter on. The visitor profile route redirects to `users?visitor=<id>`.
- `?range=` and `?f=` are preserved across tab links.
- Drawers use the shadcn Sheet (right side, full width under `sm`). Their state lives in `?page=` / `?visitor=`.

### Page titles (script and schema)

- The script sends `document.title` (trimmed, capped at ~200 characters) with each pageview. Stay inside the 3 KB gzipped budget.
- New table `pageTitles` (siteId, path, title, updatedAt), indexed by site and path, upserted at ingest with the latest non-empty title. It holds the grouped path when grouping is on.

### Per-page rollups

- The `page` dim rows gain `sessions`, `bounces`, `engagedMs` and `durationCount`, so that per-page sessions, bounce rate and average duration can be summed over any range without raw reads. Definitions:
  - A page's sessions are the sessions that viewed it.
  - Bounce is attributed to the entry page of a one-pageview session with no goal.
  - Duration is the engaged time pinged on that page's pageviews.
- These are bumped at ingest, next to the existing page dim bump. Pings add to `engagedMs` on the page's row for that day.
- A one-off backfill migration (like 5b's `backfillSources`) rebuilds the new fields from the stored sessions and pageviews, per site, in self-rescheduling batches. Cookieless days get duration but no sessions or bounce.
- The previous-period sessions per page (for the change column) come from the same rollups over the previous window.

### New and changed Convex queries (all behind `requireSite`)

- `pages.list`: domain, range, filters, sort, search, cursor. Returns rows (path, title, views, share, sessions, previous sessions, bounce, avg duration, revenue, a daily sparkline series), a total count and totals for the tiles.
  - Unfiltered, it reads the page dim rollups only.
  - With `?f=` filters, it goes through the bounded filtered view, as the dashboard does.
  - Search and sort happen over the range's aggregated keys. That is bounded because the page dim is per day and rankEntries already caps keys.
- `pages.detail`: domain, range, path. Returns the page's tiles, a daily pageviews series, and the Sources / Countries / Devices / Browsers lists. It reuses the filtered view with `page:<path>`.
- `visitors.list`: domain, range, kind (`all | customers`), search, cursor. Paginates visitors whose `lastSeen` falls on or after the range start, via `by_site_lastSeen` descending. It drops those first seen after the range end. To avoid N reads per row, the `visitors` table gains denormalised fields kept up to date at ingest and backfilled once: pageviews, engagedMs, latest country/region/city, device, browser, latest entry and exit paths. The customers kind reuses the current rule (paid, or reached the key goal).
- `visitors.summary`: tiles, the daily visitors series and the Sources / Countries / Devices card for the range. Built from dailyStats and the dims.
- `visitors.profile` is reused for the drawer, extended with the "first visit" block and per-session event counts if they're missing.
- The `sites` table gains:
  - `cookieless` (boolean, default false)
  - `excludedPaths` (string array, capped at ~50)
  - `pathGrouping` (an object holding enabled, placeholder and an ordered list of named patterns)

  `sites.update`-style mutations set each of them with validation (glob syntax, pattern count, placeholder format).

### Ingest changes

- In `/api/collect` and the ingest functions, in this order, for every hit type:
  1. Look up the site.
  2. If the path matches an excluded glob, drop the hit and return 204.
  3. If grouping is enabled, rewrite the path with the named patterns, then auto-detection (UUIDs, segments of 6 or more all-digit characters, hex/base64-ish segments of 16 or more characters).
  4. If the site is `cookieless`, strip the visitor and session ids before storing.
- Path matching and grouping are pure functions shared by the route and Convex, with unit tests.
- The collect response tells the script the mode (a header or tiny JSON flag). When it says cookieless, the script stops setting cookies and deletes the ones it set.
- "Ignore my visits": the script checks `localStorage` for an ignore flag before sending anything. Opening the site with `?_va_ignore=1` sets the flag, and `?_va_ignore=0` clears it. The settings section builds both links from the domain.

### MCP server

- A Streamable HTTP MCP endpoint in the Next.js app (an API route under the app's own URL), built with the official TypeScript MCP SDK or Vercel's MCP handler, using the Node.js runtime. The proxy lets this route through without Clerk, as it does for `/api/collect`.
- Auth: `Authorization: Bearer <key>`. Keys are random, shown once, and stored hashed in a new `apiKeys` table (ownerId, name, hash, prefix, createdAt, lastUsedAt, revokedAt), indexed by hash and by owner. They are created by an authenticated action (as `createApiKey` does for payments) and listed and revoked by owner.
- The route can't use a Clerk session, so it calls public Convex functions guarded by `INGEST_SECRET` (the `checkSecret` pattern from payments). Those functions take the key hash, resolve the owner, then run the same internals as the UI queries.
  - So the stats logic is split into owner-id-taking internal helpers, used by both the Clerk-authed queries and the MCP path. There must be no second copy of the maths.
  - `lastUsedAt` is updated at most once a minute.
- Tools (all read-only):
  - `list_sites`
  - `get_summary`
  - `get_timeseries`
  - `get_breakdown` (dim enum)
  - `get_pages`
  - `get_visitors`
  - `get_visitor_journey`
  - `get_live`

  Each takes a domain and, where relevant, a range string in the existing `?range=` grammar and the existing filter syntax. Sites the key's owner doesn't own resolve as "not found".
- Account Settings gets an "MCP server" section (keys and setup). Site Settings' MCP section shows the setup with that domain filled in and links to the account keys.

### Settings page

- `SiteSettings` is split into section components behind a sidebar layout. `?section=` picks one (tracking, timezone, goals, revenue, mcp, identity, ignore, paths, excluded, danger). Today's snippet, timezone, goals and revenue forms move over as they are, restyled.

## Out of Scope

- Piqo's other tabs: Journeys, Search, Revenue, Signups, Outbound, Funnels, Goals, Ask AI.
- The Filter button's menu-based filtering (the button stays hidden). Events and Funnels cards (hidden, not deleted).
- Google Search Console and Bing Webmaster data, so no Clicks / Impressions / CTR / Position columns, no "Search clicks" tile and no "Search queries" in the page drawer.
- The Path / URL toggle on Pages (only paths are stored).
- Settings sections not chosen for V1: Custom domain, Signups/Auth (Firebase, Supabase, Clerk), Public share links, Public API, Team members, Cookie consent, Import stats, the multi-provider revenue tabs (Polar, Paddle, etc.) and the "exclude tax" option.
- Renaming a site's domain from Settings.
- OAuth for the MCP server (needed for claude.ai web connectors). Write tools in the MCP.
- Rewriting history for excluded paths, path grouping or cookie mode. Those apply to new hits only, and only the per-page rollups and visitor totals are backfilled.
- Changing the Live tab's MapLibre map beyond picking up the new tokens.
- Per-city map bubbles.

## Further Notes

- **Suggested build order** (for `prd-to-plan`): tokens and dashboard clean-up → chart and card metric toggle → dotted map → nav and routes → per-page rollups and backfill, plus titles → Pages tab and drawer → visitor totals and backfill → Users tab and drawer → settings layout → identity, ignore, paths and excluded → MCP keys and server.
- **Script budget.** Title capture, the cookieless reply and the ignore flag all touch `src/script/script.js`. Check the gzipped size stays under 3 KB and extend `script.test.ts`.
- **Production steps.** Schema changes (`pageTitles`, `apiKeys`, new `sites`, `dailyDims` and `visitors` fields) are all optional or new tables, so the deploys are safe. The two backfills must be run once on Convex prod after deploy, as with 5b.
- **Clerk dev instance.** API keys are tied to the `tokenIdentifier` owner, like sites. Moving to a Clerk production instance means migrating `apiKeys.ownerId` along with `sites.ownerId` (add this to the open item in PROGRESS).
- **Read budgets.** `visitors.list` with search, and filtered Pages, must stay within Convex read limits. Reuse the filtered view's budget notice where a result is truncated.
- The brief's screenshots are piqo's live demo. Copy its layout and look, not its wording or brand.

# Plan: Dashboard design v2

> Source PRD: `plans/dashboard-design-v2.md` (brief `docs/DESIGN-V2.md`, screenshots in `public/design-v2/`, local only)

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: unchanged. `/websites`, `/sites/[domain]` (the Analytics tab, formerly "Visitors"), `/sites/[domain]/live`, `/sites/[domain]/customers`, `/sites/[domain]/visitors/[visitorId]`, `/sites/[domain]/settings`. "Add site" opens `/websites?add=1`.
- **URL state**: `?range=` accepts `today`, `yesterday`, `24h`, `7d`, `30d`, `90d`, `6m`, `12m` or `YYYY-MM-DD_YYYY-MM-DD`. The default is `7d`, and old values keep parsing. `?f=` click-to-filter is unchanged.
- **Schema**: no changes. Hourly numbers are computed from the raw `sessions`, `pageviews`, `events` and `payments` through their existing time indexes.
- **Query shapes**: the dashboard has three data sources (rollups for day ranges without filters, the filtered view when filters are set, and hourly for ranges of up to 2 days). All three return the same shapes (`lib/statsShapes`), so components don't care which one served them. The 12,000-document read budget and the `tooMany` notice apply to filtered and hourly.
- **Range model**: each range has a granularity, `hour` (today, yesterday, 24h) or `day` (everything else). `24h` is a rolling window ending at the client's current hour, passed in from the client, because queries can't read the clock.
- **UI foundation**: shadcn/ui on Tailwind v4 with shadcn's CSS variables in light and dark sets. The old colour names (`panel`, `line`, `muted`, `strong`, `accent`, `bar`, `up`, `down`) stay as aliases until the remaining pages are restyled. `next-themes` uses the class strategy and follows the system by default. Charts use shadcn Chart (Recharts) with monochrome `--chart-*` colours. New icons come from `lucide-react`; the existing `react-icons` stay.
- **Navigation**: one sticky app bar on every signed-in page. Tabs: Analytics | Live | Customers | Settings. The section value `visitors` becomes `analytics`.
- **Auth**: unchanged. Every stats query goes through `requireSite`.
- **Per-browser preferences** (the theme, which chart series are on): `localStorage`, wrapped in try/catch, never needed for the page to render.

---

## Phase 1: shadcn foundation and theme

**User stories**: 12, 13, 85, 86, 87, 88, 89

### What to build

Set up shadcn/ui in the project and move the theme onto shadcn's tokens, with a full light set and dark set. Map the old colour names onto the new tokens so every page keeps working. Add next-themes with a temporary theme toggle, theme Clerk's components to match, and switch the live map between OpenFreeMap's light and dark styles. No layout changes yet.

### Acceptance criteria

- [x] `components.json` exists and shadcn components can be added with the CLI
- [x] The app follows the system theme on first load, the toggle switches it, and the choice survives a reload with no wrong-theme flash
- [ ] Websites, dashboard, settings, customers, profile, live and sign-in are all readable in light and dark mode (checked in Chrome). All checked except sign-in, which redirects while signed in
- [ ] Clerk's sign-in and user button match the theme. The user button was checked in both themes. Sign-in uses the same mechanism but wasn't viewed (it redirects while signed in)
- [x] The live map uses a light style in light mode and the dark style in dark mode
- [x] The build, tsc, lint and tests all pass

---

## Phase 2: Sticky top bar

**User stories**: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19

### What to build

Replace the old site header with one sticky top bar used on every signed-in page. The left side has a placeholder logo (linking to `/websites`), a "/" separator, and the site switcher (favicon, domain, chevron). The switcher opens a menu: "Switch site" with a check on the current site, then "All sites" and "Add site". The right side has a green dot with "N online" (linking to Live, hidden on cookieless sites and on `/websites`), the theme toggle and Clerk's user button. Below are underlined text tabs: Analytics, Live, Customers, Settings. Content scrolls under the bar. The tabs scroll sideways on phones.

### Acceptance criteria

- [x] The bar stays on screen while the page scrolls, on every signed-in page
- [x] Switching sites keeps the current tab and range
- [x] "Add site" opens `/websites` with the add form open
- [x] "N online" matches the old online-now number and links to Live, and it's hidden for cookieless sites
- [x] A visitor profile keeps the Customers tab active
- [x] The old header and the "All sites" tab are gone
- [x] It looks like the example screenshots in both themes and fits one line at 375px wide (checked in a 375px iframe; not yet on a real phone)

---

## Phase 3: Page header and day ranges

**User stories**: 20, 21, 22, 23, 24, 25, 26, 27, 28, 29

### What to build

Add the new range model (every preset, granularity, `7d` default, old URLs still parsing) and the dashboard's page header. It has the "Analytics" title with the range in words, the segmented Today | 24h | 7d | 30d control, a dropdown with every preset and Custom range… (a two-month range calendar, at most 365 days), and the disabled Filter button with a "Coming soon" tooltip. The ‹ › arrows go away. The click-to-filter chips become badges under the header. Today, Yesterday and 24h appear but are disabled until Phase 10.

### Acceptance criteria

- [x] Opening a site with no `?range=` shows Last 7 days
- [x] 7d, 30d, 90d, 6m, 12m and a custom range all load the correct days, and `?range=` updates
- [x] Old `?range=30d` and custom-span URLs still work
- [x] The segmented control highlights only when the range is one of its four
- [x] The Filter button is visible, disabled, and shows its tooltip
- [x] Filter chips can be removed and the page stays in step with the URL
- [x] Unit tests cover the new presets, the default, granularity and backward compatibility

---

## Phase 4: Joined stat tiles

**User stories**: 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 45

### What to build

Replace the old stat row with the example's joined tiles, one bordered block attached to the top of the chart area. The tiles are Visitors, Pageviews, Revenue, Conv. rate, the key goal (pluralised and title-cased name), Bounce rate and Visit duration. Each has a dot, a label, a large number and a coloured % change. Tiles hide when their metric doesn't apply (no revenue, no key goal, cookieless). The dropped numbers move into tooltips: sessions and time on page on Visit duration, and refunds, payments and revenue per visitor on Revenue. Tiles wrap into two columns on phones. They are display only in this phase.

### Acceptance criteria

- [x] A revenue site with a key goal shows all 7 tiles, a site with neither shows Visitors, Pageviews, Bounce rate and Visit duration, and a cookieless site shows its reduced set (7 tiles checked with a temporary key goal on the dev `localhost`; "neither" checked in code, no such dev site)
- [x] % changes are green for good and red for bad (bounce rate up is red), and "–" shows where the periods aren't comparable
- [ ] "≈" still shows on the Visitors fallback (kept in code; no dev site has enough sessions to see it)
- [x] The tooltips show the moved numbers
- [x] Filtered views update every tile
- [x] It matches the example's spacing and type in both themes (16px side padding with 6–7 tiles, as the page is narrower than the example)

---

## Phase 5: Monochrome chart driven by the tiles

**User stories**: 40, 41, 42, 43, 44, 46, 47, 48, 49, 50, 51, 53, 54, 55, 56

### What to build

Rebuild the chart on shadcn Chart in monochrome. Visitors is a foreground line with a gradient area, Pageviews a grey line with a fainter area, Revenue foreground bars and the key goal grey bars. Conv. rate, Bounce rate and Visit duration are dashed or dotted lines. Each extra series has its own hidden scale. The tiles become toggles (`aria-pressed`, dot coloured when on, at least one on, choice remembered per browser). By default Visitors, Pageviews, Revenue and the key goal are on. The day timeseries gains the key-goal completions and the per-day bounce rate, conversion rate and visit duration, in the rollup and filtered paths. There's a tooltip with a vertical cursor, active dots and one row per series. The tracking-start marker is faint, and the old chart's legend is removed.

### Acceptance criteria

- [ ] The default view matches the example's first screenshot (series and styling) on a revenue site with a key goal (checked on the dev `localhost`, which has revenue but no key goal; the goal bars are covered by tests, not seen)
- [x] Clicking tiles adds and removes series, the last one can't be switched off, and the choice survives a reload
- [x] With every series on, it looks like the example's "all on" screenshot (six series; no key goal on dev)
- [x] The tooltip lists each visible series with correct values
- [x] The chart is correct in both themes and under filters
- [x] convex-test covers the key-goal and per-day rate fields in the timeseries

---

## Phase 6: Card grid and rows

**User stories**: 57, 58, 59, 60, 61, 63, 64, 66, 67, 68, 69, 70, 72, 75, 76, 77, 78, 79

### What to build

Replace the lists with the example's card grid: one bordered block holding a 2-column grid with inner dividers (one column on phones). The cards are:

- Sources: Sources, Channels, Referrers, and More ▾ with the six campaign lists
- Pages: Pages, Entry, Exit, Outbound
- Countries: Countries, Cities, and More ▾ with Regions
- Devices: Devices, Browsers, OS

Rows have the new bar style with icon or flag, label and a right-aligned number, and the header names the metric. Each card shows 7 rows, "View all N →" expands in place and "Show less" collapses. Click to filter, the outlined active row, the 3-filter limit and the ↗ links keep working. Each card keeps its tab across range changes and has empty and skeleton states. The old Outbound list moves into the Pages card.

### Acceptance criteria

- [x] Every list that existed before is reachable from a tab or a More ▾ item (Goals stay in their old panel below the grid until Phase 8)
- [x] View all and Show less work, and N matches the row count
- [x] Clicking a row filters the whole page as before, and with 3 filters the other rows can't be clicked (the 3-filter rule is the unchanged `canFilter`; not clicked through)
- [x] Empty tabs keep the card's height, and loading shows skeleton rows
- [ ] It matches the example in both themes and stacks on phones (both themes checked in Chrome; phones not yet looked at)

---

## Phase 7: AI tab and Revenue ⇅

**User stories**: 62, 65

### What to build

Add the AI tab to the Sources card. It shows the `source` breakdown limited to the AI channel, done server-side through an optional channel argument that works in the rollup, filtered and (later) hourly paths. On revenue sites, the card header becomes "Visitors ⇅", and clicking it switches the card to "Revenue ⇅", re-sorting by revenue and showing amounts. Sites without revenue show a plain metric label.

### Acceptance criteria

- [x] The AI tab lists only AI sources (for example ChatGPT from the 5b test hit) and filters on click
- [x] ⇅ switches numbers and order between visitors and revenue on revenue sites, and is missing on others
- [x] convex-test covers the channel limit in the rollup and filtered paths

---

## Phase 8: Events and Funnels cards

**User stories**: 73, 74

### What to build

Fill the grid's bottom row. The Events card lists goals by completions, with a badge on the key goal and a tooltip showing completions, visitors and conversion rate, and rows filter on click. The Funnels card has an empty state, "Funnels are coming soon", at the same height. The old Goals panel is removed.

### Acceptance criteria

- [x] Goals from the dev `localhost` site show with correct counts, and the key goal is marked (checked with a temporary key goal on the dev `localhost`, cleared afterwards)
- [x] Clicking a goal filters the page
- [x] The Funnels placeholder sits beside Events and matches its height
- [x] The old Goals panel is gone

---

## Phase 9: Map tab

**User stories**: 71

### What to build

Add a Map tab to the Countries card. It's a small SVG world map (110m country outlines, loaded only when the tab is opened) with countries shaded on a monochrome scale by visitors, or by revenue when the card is on Revenue. Hovering shows a tooltip with the country and value, and clicking a country adds the country filter.

### Acceptance criteria

- [x] The map shades the same countries the Countries tab lists, with consistent values (countries too small for the 110m outlines, such as Singapore, are only in the list)
- [x] The tooltip and click to filter work
- [x] The map code isn't in the dashboard's first load (it loads when the tab opens)
- [x] It reads well in both themes

---

## Phase 10: Hourly ranges

**User stories**: 21, 22, 23 (the hour presets), 52, 80, 81, 82, 83, 84

### What to build

Add the hourly data source. It reads raw sessions, pageviews, events and payments through their time indexes for the window and the previous window of equal length, buckets by hour in the site's timezone, and returns the standard shapes, reusing the filtered view's aggregation, so filters work too. Enable Today, Yesterday and 24h (24h ends at the client's current hour, refreshed as time passes). The chart shows `HH:00` points. Cookieless pageviews count toward pageviews and pageview-based lists, and session numbers show "–". Over the read budget, a notice shows.

### Acceptance criteria

- [x] Today, Yesterday and 24h show hourly charts, and the tiles and cards are counted for exactly that window (Today and 24h end at the end of the current hour)
- [x] % changes compare against the previous window of equal length
- [x] Hours are correct in a non-UTC site timezone
- [x] Filters combine with hourly ranges
- [x] convex-test covers bucketing, the timezone, the previous window, cookieless pageviews, filters and the budget notice
- [x] The build, tsc, lint and tests pass, and `docs/PROGRESS.md` is updated to replace the "Layout from Simple Analytics" decision with this design

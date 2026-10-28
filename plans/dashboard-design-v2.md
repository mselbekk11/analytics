# PRD: Dashboard design v2

Source brief: `docs/DESIGN-V2.md`, with the reference screenshots in `public/design-v2/` (local only, not committed). Context: `docs/PHASE5.md`, `docs/PROGRESS.md`.

## Problem Statement

The dashboard works, but it looks like a Simple Analytics copy with a custom dark theme. Its components are hand-rolled, it only has a dark mode, and the header, range picker, stat row, chart and lists don't match the product I want. I've found a reference design (piqo.app's demo) that is clearer and more polished. It has a sticky top bar with a logo, a site switcher, online count, a theme toggle and an account menu. It has a range control with quick presets and a dropdown, and a row of joined stat tiles that switch series on and off a monochrome chart. Below that is a grid of tabbed cards with bar rows. I want my app's navigation and site dashboard to look exactly like that, built on shadcn so the rest of the app can follow later.

Today's ranges are also whole days only, so I can't see "Today" or "the last 24 hours" hour by hour.

## Solution

Rebuild the site dashboard and the app-wide navigation on shadcn/ui, matching the reference design:

- A **sticky top bar** that content scrolls under. On the left: a placeholder logo, a "/" separator, and a site selector (favicon, domain, chevron) that opens a "Switch site" menu with a check on the current site, then "All sites" and "Add site". On the right: a green dot with "N online", a light/dark toggle, and the Clerk user button. Under it are underlined text tabs: Analytics, Live, Customers and Settings.
- A **page header** with the title "Analytics" and the range in words ("Last 7 days"). On the right are a segmented control (Today | 24h | 7d | 30d), a dropdown (Today, Yesterday, Last 24 hours, Last 7/30/90 days, Last 6/12 months, Custom range…), and a **Filter** button that is shown but inactive for now.
- **Joined stat tiles** on top of the chart, in one bordered block: Visitors, Pageviews, Revenue, Conv. rate, the key goal (for example "Signups"), Bounce rate and Visit duration. Each tile has a dot, a label, a large number and a green or red % change. Clicking a tile adds or removes its series on the chart, and the dot shows whether it is on.
- A **monochrome chart** like the example: Visitors as a white line with a soft area, Pageviews as a grey line with an area, Revenue as white bars and the key goal as grey bars. The other metrics draw as dashed or dotted lines when switched on. The tooltip has a vertical cursor and lists each visible series. It shows hourly points for Today, Yesterday and Last 24 hours, and daily points for longer ranges.
- **Cards under the chart** in a 2-column grid inside one bordered block, exactly like the example. Each has text tabs and a "More ▾" overflow, and a "Visitors ⇅" header that switches to "Revenue ⇅" on sites with revenue. Rows have full-width light bars behind an icon or flag, the label and a right-aligned number. "View all N →" expands the card in place. The cards are Sources, Pages, Countries and Devices, then Goals and a Funnels placeholder.
- **Light and dark mode**, following the system by default, with the toggle remembering the choice.
- Default range: **Last 7 days**.

The other pages (websites list, settings, customers, visitor profile, live) get the new top bar and theme tokens now. Their content is restyled in a later PRD.

## User Stories

### Navigation

1. As the owner, I want the top bar to stay fixed while the page scrolls under it, so that switching sites or tabs is always one click away.
2. As the owner, I want a simple logo mark at the far left, so that the app has an identity even before I design a real logo.
3. As the owner, I want the logo to take me to my websites list, so that I can get back to all sites quickly.
4. As the owner, I want a "/" separator and the current site's favicon and domain next to the logo, so that I always know which site I'm looking at.
5. As the owner, I want clicking the site name to open a "Switch site" menu listing all my sites with their favicons and a check on the current one, so that I can jump between sites.
6. As the owner, I want switching sites to keep me on the same tab and range, so that I can compare sites quickly.
7. As the owner, I want "All sites" in that menu, so that I can open the websites list.
8. As the owner, I want "Add site" in that menu, so that I can add a website without hunting for the form.
9. As the owner, I want a green dot and "N online" at the top right, so that I see live activity on every tab.
10. As the owner, I want clicking "N online" to open the Live tab, so that I can see who those visitors are.
11. As the owner, I want the online count hidden for cookieless sites, so that I'm not shown a number the site can't measure (and "live pageviews" moves into the Live tab for them).
12. As the owner, I want a sun/moon button that switches between light and dark mode, so that I can use whichever is comfortable.
13. As the owner, I want the app to follow my system theme until I choose one, and to remember my choice after that, so that it looks right from the first visit.
14. As the owner, I want my Clerk avatar at the top right, so that I can manage my account and sign out.
15. As the owner, I want underlined text tabs (Analytics, Live, Customers, Settings) under the top bar, so that I can move between a site's sections.
16. As the owner, I want the current tab underlined in the foreground colour and the others muted, so that I know where I am.
17. As the owner, I want a visitor profile to keep the Customers tab active, so that I know how to get back.
18. As the owner, I want the websites list to use the same top bar (without the site selector's current site), so that the app feels consistent.
19. As the owner on a phone, I want the tabs to scroll sideways instead of wrapping, so that the bar stays one line tall.

### Range and filter controls

20. As the owner, I want the page to show a large "Analytics" title with the range in words underneath ("Last 7 days", or "1 Oct – 14 Oct 2026" for a custom range), so that I know what I'm looking at.
21. As the owner, I want a segmented control with Today, 24h, 7d and 30d, so that the common ranges are one click away.
22. As the owner, I want the selected segment highlighted and none highlighted when the range isn't one of those four, so that the control never lies.
23. As the owner, I want a dropdown showing the current range's name, with Today, Yesterday, Last 24 hours, Last 7 days, Last 30 days, Last 90 days, Last 6 months, Last 12 months and Custom range…, with a check on the current one, so that I can pick any common range.
24. As the owner, I want Custom range… to open a calendar where I pick a start and end date, so that I can look at any period up to a year.
25. As the owner, I want the range kept in the URL, so that I can bookmark or share a view and the back button works.
26. As the owner, I want the dashboard to open on Last 7 days by default, so that I see the current week without choosing.
27. As the owner, I want my old bookmarks with `?range=30d` or a custom span to keep working, so that nothing breaks.
28. As the owner, I want a Filter button next to the dropdown, so that the layout is ready for the filter builder. It's disabled for now, with a "Coming soon" tooltip.
29. As the owner, I want my click-to-filter chips (from rows) shown as small removable badges under the page header, so that filters still work and are visible.

### Stat tiles

30. As the owner, I want the stat tiles joined into one bordered block attached to the top of the chart, so that they read as the chart's legend.
31. As the owner, I want Visitors, Pageviews, Revenue, Conv. rate, my key goal, Bounce rate and Visit duration as the tiles, so that I see the numbers that matter.
32. As the owner of a site without revenue, I want the Revenue tile hidden, so that I don't see an empty metric.
33. As the owner of a site without a key goal, I want the key-goal tile hidden, so that I don't see an empty metric.
34. As the owner, I want the key-goal tile labelled with a nicely formatted goal name (for example "signup" shows as "Signups"), so that it reads naturally.
35. As the owner, I want Conv. rate hidden when the site has neither revenue nor a key goal, so that every tile has a meaning.
36. As the owner, I want each tile to show the % change from the previous period in green when it's good and red when it's bad (bounce rate up is red), so that I can read trends at a glance.
37. As the owner, I want "–" in place of a % change when the periods can't be compared (before visitor tracking started, or no previous data), so that I'm not misled.
38. As the owner, I want the Visitors tile to show "≈" when it falls back to summed daily visitors, as today, so that I know it's an estimate.
39. As the owner, I want a tooltip on Revenue with refunds and payment count, and on Visit duration with sessions and time on page, so that the dropped tiles' numbers are still one hover away.
40. As the owner, I want clicking a tile to add or remove its series on the chart, so that I can compare the metrics I care about.
41. As the owner, I want each tile's dot to show its series colour when on and a dim grey when off, so that the tiles double as the legend.
42. As the owner, I want at least one series always on, so that the chart is never empty.
43. As the owner, I want the tiles to be keyboard focusable with a visible focus ring (as in the example's blue outline) and to announce on/off state, so that the chart is accessible.
44. As the owner, I want my chosen series remembered in this browser, so that the chart looks the way I left it.
45. As the owner on a phone, I want the tiles to wrap into two columns, so that the numbers stay large and readable.

### Chart

46. As the owner, I want the chart monochrome like the example, white and greys in dark mode and black and greys in light mode, so that it looks clean.
47. As the owner, I want Visitors, Pageviews, Revenue and the key goal on by default, so that the default view matches the example.
48. As the owner, I want Visitors drawn as a solid foreground line with a gradient area, and Pageviews as a grey line with a fainter area, so that the traffic shape is clear.
49. As the owner, I want Revenue as foreground bars and the key goal as grey bars, each on its own hidden scale, so that money and conversions show up under the traffic lines.
50. As the owner, I want Conv. rate, Bounce rate and Visit duration drawn as dashed or dotted lines, each on its own hidden scale, so that they can be compared by shape without clutter.
51. As the owner, I want a y-axis on the left for Visitors and Pageviews and an x-axis with times or dates, so that I can read values.
52. As the owner, I want hourly points (00:00 to 23:00) for Today and Yesterday, and 24 hourly points ending at the current hour for Last 24 hours, so that I can see the day's shape.
53. As the owner, I want daily points for 7 days and longer, so that long ranges stay readable.
54. As the owner, I want hovering the chart to show a vertical cursor line, dots on the lines, and a tooltip with the time and each visible series' value, so that I can read exact numbers.
55. As the owner, I want the "visitor tracking on" marker kept as a faint vertical line, so that I know where the numbers' definition changed.
56. As the owner, I want the chart to follow the active click-to-filter chips, so that filtering still changes everything.

### Cards

57. As the owner, I want the cards in a 2-column grid inside one bordered block with dividers, exactly as in the example, so that the page reads as one dashboard.
58. As the owner on a phone, I want the cards stacked in one column, so that each list is full width.
59. As the owner, I want each card's tabs as plain text with the active one in the foreground colour, so that it matches the example.
60. As the owner, I want rows with a full-width light bar showing the row's share, the icon or flag, the label and a right-aligned number, so that I can compare at a glance.
61. As the owner, I want the top 7 rows shown and "View all N →" to expand the card in place to all rows (and "Show less" to collapse it), so that I can see everything without leaving the page.
62. As the owner, I want the "Visitors ⇅" header on sites with revenue to switch the card to "Revenue ⇅", showing amounts and re-sorting by revenue, so that I can see which sources make money.
63. As the owner of a site without revenue, I want the header to just read "Visitors" (or "Pageviews" on Pages, "Sessions" on Entry and Exit, "Completions" on Goals), so that I know what the numbers count.
64. As the owner, I want the Sources card's tabs to be Sources, Channels, Referrers, AI and More ▾, with Sources first, so that I see named sources by default.
65. As the owner, I want the AI tab to list only sources in the AI channel (ChatGPT, Claude, Perplexity and others), so that I can track AI referrals.
66. As the owner, I want More ▾ on the Sources card to hold the campaign lists (Campaign, Source, Medium, Term, Content, ref / via), and the selected one to replace "More" as the tab's label, so that campaign data is still reachable.
67. As the owner, I want sources to keep their favicons (Google's "G", X, GitHub and so on) and Direct a neutral icon, so that rows are easy to scan.
68. As the owner, I want the Pages card's tabs to be Pages, Entry, Exit and Outbound, so that outbound links sit with pages as in the example.
69. As the owner, I want outbound rows to keep the small ↗ link that opens the target site, so that I can check where people went.
70. As the owner, I want the Countries card's tabs to be Countries, Cities, Map and More ▾ (Regions), so that location is in one place.
71. As the owner, I want the Map tab to show a small world map with countries shaded by visitors for the range, and a tooltip with the country and count, so that I can see where traffic comes from at a glance.
72. As the owner, I want the Devices card's tabs to be Devices, Browsers, OS and More ▾ if needed, so that technology data is in one place.
73. As the owner, I want a Goals card (titled "Events" as in the example) listing each goal with its count, and the key goal marked, so that conversions are visible.
74. As the owner, I want a Funnels card next to Goals showing an empty state ("Funnels are coming soon"), so that the grid matches the example and the slot is reserved.
75. As the owner, I want clicking a row to add a filter chip as today, and the active row outlined, so that click-to-filter keeps working.
76. As the owner, I want rows that can't be filtered (cookieless sites, the 3-filter limit) shown without hover affordance, so that I don't click dead rows.
77. As the owner, I want each card to keep its chosen tab when I change the range, so that I don't lose my place.
78. As the owner, I want empty tabs to show a short "No data for this range" message at the card's normal height, so that the grid doesn't jump.
79. As the owner, I want loading cards to show skeleton rows, so that the page doesn't flash.

### Hourly ranges

80. As the owner, I want Today, Yesterday and Last 24 hours to show the same tiles and cards as day ranges, counted from that window, so that the whole page agrees.
81. As the owner, I want Last 24 hours compared with the 24 hours before it, and Today and Yesterday with the day before each, so that % changes make sense.
82. As the owner, I want hours computed in the site's timezone, so that 09:00 means 09:00 where the site's audience is.
83. As the owner of a cookieless site, I want hourly ranges to still show pageviews, so that short ranges aren't blank (session-based numbers show "–").
84. As the owner, I want a notice instead of an error if an hourly window ever has too much data to read, so that the page degrades gracefully.

### Theme and foundation

85. As the owner, I want the whole app themed with shadcn's tokens (background, foreground, card, muted, border, ring and so on) in light and dark, so that later pages can be restyled consistently.
86. As the owner, I want Clerk's sign-in and user button to follow the theme, so that nothing flashes white in dark mode.
87. As the owner, I want no flash of the wrong theme on load, so that the app feels polished.
88. As the owner, I want the live map to switch to a light style in light mode, so that the Live tab isn't a dark block on a light page.
89. As the owner, I want the existing pages (websites, settings, customers, profile, live) to keep working and stay readable in both themes, even before they're restyled, so that nothing regresses.

## Implementation Decisions

### Foundation

- **Initialise shadcn/ui** in the project (Tailwind v4, App Router, `components.json`, the neutral base colour) using the shadcn skill. Components needed: Button, Toggle Group (segmented range control), Dropdown Menu (site switcher, range menu, More ▾), Popover and Calendar (custom range), Tooltip, Tabs (or plain styled buttons, if Tabs can't be made to look like the example's text tabs), Badge (filter chips), Skeleton, Separator, Chart (shadcn's Recharts wrapper, for theme-aware chart colours).
- **Theme tokens** move to shadcn's CSS variables (`--background`, `--foreground`, `--card`, `--muted`, `--muted-foreground`, `--border`, `--ring`, `--primary`, `--chart-1..5`) with light and dark sets. The current tokens (`panel`, `line`, `muted`, `strong`, `accent`, `bar`, `up`, `down`) are mapped onto them as aliases for one release, so the pages not restyled yet keep working, and are removed when those pages are redone. `up`/`down` stay as green and red for % changes.
- **Chart colours are monochrome:** `--chart-1` is the foreground (Visitors, Revenue), and `--chart-2..5` are greys (Pageviews, key goal, extra lines), inverted per theme.
- **Theme switching** with `next-themes` (class strategy, `defaultTheme="system"`, `enableSystem`, stored in `localStorage`, `suppressHydrationWarning` on `<html>`). Clerk components get the matching base theme (`@clerk/themes` dark when dark).
- **Font:** keep Geist (the example uses a similar grotesk).
- **Icons:** move new UI to `lucide-react` (shadcn's default). Existing `react-icons` uses (device, browser, OS icons) stay.

### Navigation (new `AppNav` replacing `SiteHeader`)

- One sticky (`top-0`, background with slight blur, bottom border) client component used by every signed-in page. It takes the current domain (optional) and section.
- Left: placeholder logo (a ring or circle mark in a rounded square, as in the example) that links to `/websites`. Then a muted "/", then the **site switcher**: a Dropdown Menu trigger with the favicon, domain and an up/down chevron. Menu: a "Switch site" label, each site with its favicon and a check on the current one, a separator, "All sites" (grid icon) and "Add site" (plus icon, opens `/websites` with the add form open, for example `?add=1`).
- Right: an online indicator (green dot, bold count, muted "online") reading `stats.online` for the current site, linking to Live. It's hidden on `/websites` and on cookieless sites. Then the theme toggle (ghost icon button) and Clerk `UserButton`.
- Tabs row: Analytics (the existing dashboard route, renamed from "Visitors"), Live, Customers, Settings. Active tab: foreground text with a 2px underline sitting on the nav's bottom border. "All sites" leaves the tab row (it's in the switcher). It scrolls sideways on narrow screens.
- The `SiteSection` value `visitors` is renamed `analytics`. Routes don't change.

### Range model

- **New presets:** `today`, `yesterday`, `24h`, `7d`, `30d`, `90d`, `6m`, `12m`, plus the existing custom `YYYY-MM-DD_YYYY-MM-DD`. `DEFAULT_PRESET` becomes `7d`. `6m` is the 183 days ending today, `12m` the 365 days ending today (within `MAX_RANGE_DAYS`).
- The range module gains a **granularity**: `hour` for `today`, `yesterday` and `24h`, otherwise `day`. Today and Yesterday are single local dates. `24h` is a rolling window ending at the current hour, so it needs the client's `now` (snapped to the hour, like `stats.live`'s `since`, because queries can't read the clock).
- The ‹ › step arrows of the old RangePicker are dropped (not in the design). Old URLs keep parsing.
- The segmented control shows Today, 24h, 7d and 30d. The dropdown lists every preset plus Custom range…, which opens a Popover with a two-month range Calendar, capped at 365 days.

### Data: hourly ranges

- **New query `stats.hourly`** (or an `hourly` mode on the filtered path): given the domain, a start and end timestamp, and the active filters, it reads `sessions`, `pageviews`, `events` and `payments` through their time indexes for the window and the previous window of equal length. It buckets into hours in the site's timezone and returns the same shapes as the rollup queries (summary, timeseries with an `hour` label, every breakdown list, goals and conversions). It reuses the in-memory aggregation from `lib/filtered.ts`, so the hourly view and the filtered view count identically.
- The same document budget as the filtered view applies (12,000 reads). Over budget returns `status: "tooMany"` and the dashboard shows a notice.
- Cookieless and old-script pageviews (no session) count toward pageviews and the pageview-based lists in hourly ranges. Session-based numbers show "–" for cookieless sites.
- The dashboard picks its data source from three options: rollups (day ranges, no filters), filtered (filters present), or hourly (hour granularity, with or without filters). Components get one shape, as today.
- No schema change and no backfill.

### Stat tiles (`StatTile` rewritten, new `StatRow`)

- Tiles: Visitors, Pageviews, Revenue (only on revenue sites), Conv. rate (revenue or key goal), the key goal (key goal set; label pluralised and title-cased from the goal name), Bounce rate and Visit duration (session time). Sessions, Time on page and Revenue / visitor leave the row and move into tooltips (Visit duration: sessions and time on page; Revenue: refunds, payments and revenue per visitor).
- Cookieless sites show Visitors, Pageviews and Visit duration ("time on page" for them), as today's rules allow.
- Each tile is a toggle button (`aria-pressed`) that adds or removes its series. Default on: Visitors, Pageviews, Revenue and key goal. At least one stays on. The choice is kept in `localStorage` per browser, wrapped in try/catch.
- The key-goal series needs daily (and hourly) completion counts. The rollup timeseries gains a `goal` field from the key goal's `dailyDims` row (`dim: goal`, the key goal's name, `events`). Bounce rate, conversion rate and visit duration per day come from `dailyStats` (bounces/sessions, sessionEngagedMs/sessions) and conversions per day. Conversion rate per day is key-goal visitors (or paying visitors from `payments`) ÷ visitors for that day.

### Chart (`TrafficChart` rewritten on shadcn Chart)

- Recharts `ComposedChart`: Visitors (Area, solid foreground stroke, vertical gradient fill), Pageviews (Area, grey stroke, fainter fill), Revenue (Bar, foreground) and key goal (Bar, grey). Each bar series has its own hidden y-axis capped to the lower part of the chart, as revenue is today. Conv. rate, Bounce rate and Visit duration are Lines with distinct dash patterns on hidden axes.
- Visible left y-axis for Visitors and Pageviews. No grid lines, as in the example; only axis labels. X labels are `HH:00` for hours and short dates for days, with Recharts thinning them.
- Tooltip: a vertical cursor line, active dots on lines, and a card with the time or date and a row per visible series (square swatch, name, formatted value), ordered as in the example.
- The tracking-start marker stays, faint.
- The legend and toggles at the bottom right of the old chart are removed (the tiles are the legend).

### Cards (`Breakdowns` / `BreakdownList` rewritten as `StatsCard`)

- Layout: one bordered, rounded block containing a 2-column grid with inner borders: Sources | Pages, Countries | Devices, Goals ("Events") | Funnels. One column below `md`.
- Card header: tabs as small text buttons on the left (active in foreground, others muted). `More ▾` is a Dropdown Menu, and the chosen item becomes the active tab's label. On the right the metric header: "Visitors ⇅" (a button that switches between Visitors and Revenue on revenue sites, re-ranking rows server-side by `revenueMinor`), otherwise a static label for the tab's metric (Pageviews, Sessions, Completions).
- Tabs: **Sources** (Sources, Channels, Referrers, AI, More: Campaign, Source, Medium, Term, Content, ref / via). **Pages** (Pages, Entry, Exit, Outbound). **Countries** (Countries, Cities, Map, More: Regions). **Devices** (Devices, Browsers, OS). **Events** (goals; key goal marked with a small badge). **Funnels** (empty state).
- **AI tab:** the `source` breakdown limited to sources the classifier puts in the AI channel. This is done server-side by an optional `channel` argument on `stats.breakdown` (and the same in the filtered and hourly paths), using the shared classifier's list of AI sources.
- Rows: the bar is a rounded rectangle from the left whose width is the row's share of the top row (as in the example), in a muted fill. Then the icon or flag, the label (truncated in the middle as now), and the number right-aligned outside the bar. 7 rows by default. "View all N →" expands in place, and "Show less" collapses. The ↗ link stays on referrer and outbound rows.
- Click to filter is unchanged (same filter keys and the 3-filter rule). The active row is outlined with the ring colour.
- The old GoalsPanel's conversion-rate column is dropped from the card (the Conv. rate tile and the goal tooltip carry it). The goal row tooltip shows completions, visitors and conversion rate.
- **Map tab:** a small SVG world map (country outlines from `world-atlas` 110m TopoJSON, ISC, rendered with `d3-geo` and `topojson-client`, lazy-loaded with the tab), with countries filled on a monochrome scale by visitors (or revenue when the card is on Revenue), and a tooltip. Country keys are already ISO alpha-2. A small lookup maps them to the TopoJSON's numeric ids. Clicking a country adds the country filter.
- **Funnels card:** title "Funnels", muted text "Funnels are coming soon", the same height as Events.

### Page header and filters

- The title "Analytics" with the range description under it. The controls (segmented control, range dropdown, disabled Filter button with a Tooltip) sit on the right and wrap below the title on phones.
- Active filter chips (from 5g) render as Badges with an × under the header, and the 90-day and "too many" notices show in a muted bordered block in place of the stats.

### Other pages

- `/websites`, settings, customers, visitor profile and live use `AppNav` and render on the new tokens through the aliases. No layout changes beyond what's needed to fit under a sticky nav and look right in light mode (for example, the live map uses OpenFreeMap's `positron` style in light mode and `dark` in dark mode).

### Testing

- Unit tests for the range module: new presets, default `7d`, granularity, the `24h` window from `now`, the previous-window maths and old URL compatibility.
- convex-test for `stats.hourly`: hour bucketing in a non-UTC timezone, the previous window, cookieless pageviews counted, filter combination, and the budget notice. Also for the AI `channel` restriction on breakdowns, and the key-goal series in the timeseries.
- The usual four checks (`npm run build`, `npx tsc --noEmit`, `npm run lint`, `npm test`), plus a click-through in Chrome in light and dark mode: range presets, the custom range, tile toggles, View all, ⇅, the Map tab, the switcher and click to filter.

## Out of Scope

- Restyling the content of the websites list, settings, customers, visitor profile, live and sign-in pages (later PRD, on the same shadcn foundation).
- A working Filter button or filter builder (the button is present but disabled).
- Funnels (placeholder card only).
- The example's extra tabs (Pages, Users, Journeys, Search, Revenue, Signups, Outbound, Funnels, Goals, Ask AI) as separate pages.
- The example's "Live demo with sample data / Start free trial" footer pill.
- A real logo.
- Hourly rollup tables. Hourly data comes from raw rows only, and only for ranges of up to 2 days.
- Weekly or monthly chart buckets for 6- and 12-month ranges (daily points for now).
- Any change to tracking, ingest, the schema or the stored data.

## Further Notes

- Reference screenshots: the full page, the site-switcher menu, the range dropdown, the tooltip, and the chart with every series on. They're in `public/design-v2/` (local only). Like the SA screenshots, don't commit them, because anything in `public/` is served by the live site. Move them to `docs/design-v2/` or add them to `.gitignore` before committing.
- "Exactly like the example" is the bar for the top bar, range controls, tiles, chart and cards. Match spacing, type sizes, border radius and muted tones from the screenshots, in both themes.
- Suggested build order (vertical slices): (1) shadcn init, tokens, next-themes and AppNav on every page. (2) The range model, page header and controls with `7d` default, on day data. (3) Stat row and monochrome chart with toggles, including the key-goal series. (4) Cards (tabs, rows, View all, ⇅, AI tab, Funnels placeholder). (5) Map tab. (6) Hourly ranges (`stats.hourly`, Today, Yesterday, 24h).
- Update `docs/PROGRESS.md` when this ships. The "Layout from Simple Analytics, look from the original dark theme" decision is replaced by this design.

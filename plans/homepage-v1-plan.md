# Plan: Homepage v1

> Source PRD: `plans/homepage-v1.md` (owner's brief `plans/homepage-v1-brief.md`, screenshots in `public/homepage/`, reference https://piqo.app/)

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes:** `/` is the homepage, public and static, and replaces the splash. The proxy still redirects signed-in visitors on `/` to `/websites`. `/privacy` is a new public static page (added to the proxy's public routes in Phase 2). Every CTA is a plain link to `/sign-in`. Sign-up stays invite-only.
- **Section anchors:** `s-traffic`, `s-revenue`, `s-funnels`, `s-search`, `s-live`, `s-ai`, `s-setup`, `s-pricing`, `s-customers`, `s-faq`. Nav: Features → `#s-traffic`, Pricing → `#s-pricing`, FAQ → `#s-faq`. Hero pill → `#s-ai`, "See features" → `#s-traffic`.
- **Backend:** none. No Convex queries, schema changes or Clerk components on the page.
- **Rendering:** server components by default. Client islands only for the theme toggle (existing `ThemeToggle`), the scroll-spy sidebar and the pricing toggle. The FAQ uses native `<details>`.
- **Content model:** all words and numbers live in typed content data, separate from layout: hero copy, integrations, section list (id, number, eyebrow, sidebar label, icon, heading lines, paragraph with an optional highlighted phrase, figure captions, `soon` flag), plans, "every plan includes" list, quotes (with a `placeholder` flag), FAQ entries, footer links. Mockup numbers live in fixture data.
- **Mockups:** static, non-interactive, `aria-hidden` React components drawn with HTML and inline SVG (no recharts), using the dashboard's v4 tokens (`--line`, series colours, `--bar`, the near-black dark palette) so they follow light and dark. Chart shapes come from small pure helpers over fixture arrays. They reuse existing components only where those are purely presentational (e.g. `LogoMark`, `NavIcons`, the world-dots data).
- **Theme:** follows the system through the existing `ThemeProvider`, with a toggle in the nav. Both themes designed.
- **Branding:** "Analytics" with `LogoMark`. Piqo's layout and rhythm are copied, never its name, logo, wording or screenshots.
- **Honesty:** unbuilt features (Funnels, Search, built-in Ask AI, import) carry a "Soon" badge. Placeholder quotes carry an "Example" label. Claims about the live product (≈2 KB script, Stripe + API, cookieless mode, MCP) must be true.
- **Checks per phase:** `npm run build` (with `/` static, and `/privacy` once it exists), `npx tsc --noEmit`, `npm run lint`, `npm test`. A look in Chrome on a production build in light and dark at 1440, 1024 and 375 px, with no sideways scroll and no console errors. Stop for owner review after each phase, and update PROGRESS.md.

---

## Phase 1: Page shell and scroll-spy sidebar

**User stories:** 1–7, 10–26, 46, 48–49, 52–55, 57, 59, 62

### What to build

Replace the splash at `/` with the full homepage structure, using real copy and empty figure frames:

- **Nav:** a sticky bar with logo and "Analytics", Features / Pricing / FAQ, the theme toggle and a "Dashboard" button.
- **Hero:** the "New · MCP server" pill, a two-line headline, a paragraph, "Go to dashboard" and "See features", five overlapping persona avatars with "Built for founders & small teams · 7-day free trial, no card", and "Integrates with" with monochrome brand marks (Stripe, Claude, Cursor, Vercel, Next.js, React, WordPress, Shopify, Webflow).
- **Features grid:** two columns on `lg` and up, with the sticky Contents sidebar (icons, labels, "Go to dashboard", "7 days free, then from $5/mo") beside the ten sections.
- **Sections:** each has its eyebrow, heading, paragraph (with the highlighted phrase where set) and captioned figure frames ("Fig. N"), with rules between sections. "Soon" badges on Funnels and Search, in the section and in the sidebar. The Pricing, Customers and FAQ sections hold headings and intros only for now.
- **Final CTA and footer:** the final CTA block and a slim footer.

The scroll spy highlights the section being read (`aria-current`). Clicking an item scrolls smoothly (instant with reduced motion) and replaces the hash. A link with a hash opens at the right section, below the nav. Below `lg` the sidebar is hidden and sections stack. The page metadata is updated for a public product.

### Acceptance criteria

- [x] Signed out, `/` shows the new page, and signed in still redirects to `/websites`. `/` builds as static.
- [x] Scrolling through all ten sections moves the sidebar highlight in order. Clicking an item or a nav link lands with the heading visible below the nav and sets the hash without adding history entries.
- [x] Opening `/#s-revenue` lands on Revenue with its item active.
- [x] "Soon" shows on Funnels and Search, in both the section and the sidebar, and is driven by a content flag.
- [x] Every CTA goes to `/sign-in`, and the pill goes to `#s-ai`.
- [x] The theme toggle switches light and dark, and both read well. There's no sideways scroll at 375 px, where the sidebar is hidden.
- [x] Keyboard Tab reaches every link and button with a visible focus ring, and the sidebar is a labelled `nav`.
- [x] Unit tests cover the active-section picker.

---

## Phase 2: Pricing, Customers, FAQ and `/privacy`

**User stories:** 38–45, 47, 56, 58, 61

### What to build

Fill in the last three sections and the privacy page:

- **Pricing:** Starter, Growth (Popular) and Scale at piqo's numbers ($5 / $8 / $19 a month, $49 / $69 / $179 a year, 500k / 1M / 2.5M events), from one config object. There's a Monthly | "Yearly, save up to 28%" toggle, Growth's button is filled and the others outlined, all buttons go to `/sign-in`, and a two-column "every plan includes" checklist sits under the plans (unbuilt items marked Soon).
- **Customers:** a responsive grid of quote cards with persona avatars, each labelled "Example".
- **FAQ:** eight true FAQ entries as disclosures, with the contact address as a content placeholder.
- **`/privacy`:** a public, static page with wording adapted from `docs/PRIVACY.md` for the product, linked from the footer.

### Acceptance criteria

- [ ] Pricing matches the screenshot's layout in both themes. The toggle switches every plan between monthly and yearly, and the "save up to 28%" figure agrees with the config (unit-tested).
- [x] Quote cards show the "Example" label, and turning one into a real quote is a content-only edit.
- [x] FAQ entries open and close with mouse and keyboard.
- [x] `/privacy` returns 200 without cookies and builds as static. The footer links to it.
- [x] No sideways scroll at 375 px. Plans and quotes stack.

---

## Phase 3: Hero dashboard mockup (Fig. 1)

**User stories:** 8, 9, 50, 51

### What to build

The large framed Analytics replica under the hero:
- **Top bar:** logo, "Acme" switcher, "12 online", theme icon, initials.
- **Tabs:** Analytics, Pages, Users, Live, Settings.
- **Header:** "Analytics / Last 24 hours" with Today | 24h | 7d | 30d and the range menu.
- **Tiles:** seven joined tiles (Visitors, Pageviews, Revenue, Conv. rate, Signups, Bounce rate, Visit duration) with green and red changes.
- **Chart:** a legend and the bar-and-line chart.

The frame fades into the page so the fold cuts it off. This phase sets up the shared mockup pieces (frame styling, tokens, pure chart helpers for bars, lines and sparklines, and the fixture data format) that later figures reuse.

### Acceptance criteria

- [x] The mockup reads as our dashboard in light and dark, using the dashboard's own tokens. Changing a token (e.g. `--line`) changes it.
- [x] It isn't interactive and is hidden from assistive tech.
- [x] It scales or clips inside its frame at 375 px with no page scroll, and causes no layout shift on load.
- [x] No new client JS for the mockup (it renders on the server).
- [x] Unit tests cover the chart path and bar helpers.

---

## Phase 4: Traffic figure (Fig. 2)

**User stories:** 27

### What to build

The Pages mockup in 01 Traffic: a "Pages / Last 30 days" header with a range menu, tiles (Pages viewed, Pageviews with change, Sessions, Avg. bounce, Avg. duration), and the All pages table with titles over paths, trend sparklines, views with share, sessions with change, bounce, duration and revenue.

### Acceptance criteria

- [x] It fills the Fig. 2 frame with the caption, in both themes.
- [x] Sparklines come from the shared helpers and fixture data.
- [x] No sideways scroll at 375 px.

---

## Phase 5: Revenue figure and stat strip (Fig. 3)

**User stories:** 28, 29

### What to build

The Revenue mockup in 02 Revenue: tiles (Revenue, Conversions, Avg. order value, Avg. time to convert, with changes), a daily revenue bar chart with axis labels, and Sources and Countries ranked by revenue with share bars, favicons and flags. Under it, the three-column stat strip ("Stripe + API", "Journeys", "Key goal").

### Acceptance criteria

- [x] The figure and strip match the screenshot's layout in both themes.
- [x] The strip makes only true claims, and stacks on phones.
- [x] No external image requests (favicons and flags are drawn or emoji).

---

## Phase 6: Funnels and goals figures (Figs. 4–5)

**User stories:** 30

### What to build

Two mockups side by side in 03 Funnels and goals (stacked below `md`). A signup funnel (steps with bars, conversion and drop-off, an overall conversion side panel) and a goals table (tiles for goals tracked, total conversions and average rate, then rows with type, conversions and rate bars, and the top source). The section keeps its "Soon" badge.

### Acceptance criteria

- [x] Both figures have captions, side by side on desktop and stacked on phones.
- [x] They read in both themes, and the Soon badge is visible.

---

## Phase 7: Search figure (Fig. 6)

**User stories:** 31

### What to build

The Search mockup in 04 Search: a header with "synced" note, a Performance | Indexing toggle and a range menu, tiles (Clicks, Impressions, Click-through rate, Avg. position, with changes), a legend and a bar-and-line chart (clicks as bars, impressions and position as lines), and the top of the keywords table with its filter chips. The section keeps its "Soon" badge.

### Acceptance criteria

- [ ] It fills the Fig. 6 frame, built from the shared chart helpers.
- [ ] It reads in both themes, with no sideways scroll at 375 px.

---

## Phase 8: Realtime figure (Fig. 7)

**User stories:** 32

### What to build

The Live mockup in 05 Realtime and visitors: a left panel ("Acme", Live dot, "Realtime" with the visitors-in-5-minutes count, a per-minute bar strip, Sources | Countries | Devices with ranked rows, and a visitor feed with persona avatars, path, flag, city, source, browser and device). On the right, the dotted world map with visitor dots. It reuses the dot-matrix land data from the dashboard's map.

### Acceptance criteria

- [ ] The map draws from the existing dot data with no extra network request beyond the page.
- [ ] It matches the screenshot's layout in dark and reads in light.
- [ ] It stacks or clips cleanly at 375 px with no page scroll.

---

## Phase 9: Ask AI and Setup

**User stories:** 33–37

### What to build

- **06 Ask AI:** the example card (question bubble, a one-line answer, and a three-row table with bars and values). Beside it, the ways to connect, with rules between rows: Ask AI / Built into the dashboard / Soon, Claude Code / MCP, Claude Desktop / MCP, Cursor / MCP.
- **07 Setup and privacy:** the code block with the `<!-- paste before </head> -->` comment and the real embed tag (from the existing snippet helper, placeholder domain), plus the three-column strip ("~2 KB" gzipped, "30 s" to the first visitor, "0" cookies in cookieless mode).

### Acceptance criteria

- [ ] The code block shows the same tag format the app's Snippet produces.
- [ ] The built-in Ask AI row shows Soon, and the MCP rows name only tools the setup guide covers.
- [ ] Both sections match the screenshots' layout in both themes and stack on phones.
- [ ] With every figure filled, a full pass in Chrome (light and dark, 1440 / 1024 / 375 px) shows no empty frames, no sideways scroll and no console errors. PROGRESS.md gets its "Homepage v1" section finalised.

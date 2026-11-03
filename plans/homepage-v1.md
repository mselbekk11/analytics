# Homepage v1 PRD

Owner's brief: `plans/homepage-v1-brief.md`. Reference screenshots: `public/homepage/` (local only). Reference site: https://piqo.app/.

## Problem Statement

The public homepage at `/` is a bare splash: a logo, one headline, one line of copy and a Log in button. It doesn't explain what the product does or show the dashboard. It gives no reason to sign in or come back. Meanwhile the app has grown a lot: traffic, revenue attribution, a live map, visitor journeys, cookieless mode and an MCP server. None of that shows to anyone landing on the site.

The owner wants a homepage that copies piqo.app's layout and feel like for like: a centred hero over a large dashboard preview, then a long features page with a sticky "Contents" sidebar on the left that tracks the section being read on the right. The page should present the product as a real public product, including features that aren't built yet.

## Solution

Replace the splash with a long, static marketing page modelled on piqo.app, under our own name ("Analytics"), logo and words:

- A sticky nav bar: logo and "Analytics", the links Features, Pricing and FAQ (in-page anchors), the theme toggle and a "Dashboard" button.
- A hero: a "New · MCP server" pill, a two-line headline, a paragraph, two buttons ("Go to dashboard" and "See features"), a row of placeholder persona avatars with a short line, an "Integrates with" logo row, and a big framed mockup of the Analytics dashboard that the fold cuts off.
- Under the hero, two columns: a sticky "Contents" sidebar (icon + label per section, the active one highlighted, then a "Go to dashboard" button and "7 days free, then from $5/mo") and ten numbered sections on the right. Each section has a numbered eyebrow, a two-line heading, a paragraph and one or two framed figures with "Fig. N" captions. Sections are separated by a rule.
- Sections: 01 Traffic, 02 Revenue, 03 Funnels and goals (Soon), 04 Search (Soon), 05 Realtime and visitors, 06 Ask AI, 07 Setup and privacy, 08 Pricing, 09 Customers, 10 FAQ.
- A final call-to-action block and a slim footer.

The figures are coded mockups, not screenshots. They are static React components drawn to look like our own dashboard (the v4 tokens, tiles, bar-and-line chart, tables and the dotted world map) and filled with realistic made-up numbers, so they stay sharp, follow light and dark, and can show features that don't exist yet. Features that aren't built carry a small "Soon" badge. Statements about the product that's live (script size, Stripe + API, cookieless mode, MCP) stay true. Every call to action goes to `/sign-in`.

## User Stories

### Visitor: first impression

1. As a visitor, I want a clear headline above the fold, so that I know within seconds this is website analytics that ties revenue to traffic.
2. As a visitor, I want a short paragraph under the headline, so that I understand what is counted, where visitors came from and how payments link to visits.
3. As a visitor, I want a "Go to dashboard" primary button, so that I can sign in straight away.
4. As a visitor, I want a "See features" secondary button, so that I can jump to the features without scrolling blindly.
5. As a visitor, I want a "New · MCP server" pill above the headline, so that I notice the newest feature, and clicking it takes me to the Ask AI section.
6. As a visitor, I want a row of avatars with a short line next to them, so that the page feels like a product used by people like me.
7. As a visitor, I want an "Integrates with" row of logos, so that I can see at a glance that it works with my stack (Stripe, Claude, Cursor, Vercel, Next.js and so on).
8. As a visitor, I want a large preview of the dashboard right under the hero, so that I can see what I'd get before I sign in.
9. As a visitor, I want the dashboard preview to look like the real app (top bar, tabs, the Analytics header with range buttons, joined stat tiles, the bar-and-line chart), so that what I see is what I'll get.

### Visitor: navigation

10. As a visitor, I want a nav bar that stays at the top while I scroll, so that I can always reach the links, the theme toggle and Dashboard.
11. As a visitor, I want Features, Pricing and FAQ links in the nav, so that I can jump to the part I care about.
12. As a visitor on a desktop, I want a sticky "Contents" sidebar beside the features, so that I always know where I am on a long page.
13. As a visitor, I want the sidebar item for the section I'm reading to be highlighted, so that it reads like a table of contents that follows me.
14. As a visitor, I want to click a sidebar item and scroll smoothly to its section, so that I can skip around.
15. As a visitor, I want the section heading not to hide behind the sticky nav after a jump, so that I land on the heading itself.
16. As a visitor, I want the URL to change to the section's anchor (e.g. `#s-revenue`) when I click an item, so that I can share a link to one section.
17. As a visitor opening a link with a section anchor, I want the page to open at that section with its sidebar item active, so that shared links work.
18. As a visitor, I want a "Go to dashboard" button and the line "7 days free, then from $5/mo" under the sidebar items, so that the call to action is always in view.
19. As a keyboard user, I want every nav link, sidebar item and button to be reachable with Tab and to show a visible focus ring, so that I can use the page without a mouse.
20. As a screen-reader user, I want the sidebar marked as navigation with the current item announced, so that I know where I am.
21. As a visitor on a phone, I want the sidebar hidden and the sections stacked in one column, so that nothing is cramped or scrolls sideways.
22. As a visitor on a phone, I want the nav links to still jump to sections, so that I can move around a long page.

### Visitor: the feature sections

23. As a visitor, I want each section to start with a numbered eyebrow ("01 Traffic"), so that the page reads like a structured tour.
24. As a visitor, I want a two-line heading and one short paragraph per section, so that I get the point quickly.
25. As a visitor, I want one key phrase in some paragraphs set in the foreground colour (e.g. "Click any row to filter the whole dashboard by it."), so that the most important idea stands out.
26. As a visitor, I want each figure framed like a screenshot and captioned "Fig. N" with one sentence, so that I know what I'm looking at.
27. As a visitor reading Traffic, I want a Pages mockup (tiles: Pages viewed, Pageviews, Sessions, Avg. bounce, Avg. duration, then the All pages table with trend sparklines, views, sessions, bounce, duration and revenue), so that I see how pages are ranked.
28. As a visitor reading Revenue, I want a Revenue mockup (tiles: Revenue, Conversions, Avg. order value, Avg. time to convert, a daily revenue bar chart, and Sources and Countries ranked by revenue), so that I see payments credited to traffic.
29. As a visitor reading Revenue, I want a three-column stat strip under the figure (e.g. Stripe + API, every payment credited to its visit, full customer journeys), so that the key facts are easy to scan.
30. As a visitor reading Funnels and goals, I want two side-by-side mockups (a signup funnel with step bars, and a goals table with conversion rates) marked "Soon", so that I know what's coming without being misled.
31. As a visitor reading Search, I want a Search Console & Bing mockup (Clicks, Impressions, CTR, Avg. position tiles, a bar-and-line chart and the start of a keywords table) marked "Soon", so that I know it's planned.
32. As a visitor reading Realtime, I want a mockup of the Live view (a panel with the online count, a per-minute bar strip, a sources list and a visitor feed, beside a dark world map with dots), so that I see who is on a site right now.
33. As a visitor reading Ask AI, I want an example question and answer card (question bubble, a one-sentence answer and a small table with bars), so that I can picture asking questions about my stats.
34. As a visitor reading Ask AI, I want a list of the ways to connect (built-in Ask AI marked Soon, then Claude Code, Claude Desktop and Cursor through MCP), so that I know which tools work today.
35. As a visitor reading Setup, I want a code block with the real one-line script tag, so that I see how little setup there is.
36. As a visitor reading Setup, I want a three-column stat strip (script size, time to first visitor, cookieless option), so that the privacy and speed claims are concrete.
37. As a visitor reading Setup, I want the text to say plainly that a first-party cookie is the default and that a site can switch to cookieless, so that the privacy claims are honest.

### Visitor: pricing, customers, FAQ

38. As a visitor, I want three plans (Starter, Growth with a "Popular" badge, Scale), each with a one-line audience, a price per month, the yearly price and the events per month, so that I can compare at a glance.
39. As a visitor, I want a Monthly / "Yearly, save up to 28%" toggle, so that I can see yearly pricing.
40. As a visitor, I want the Growth plan's button filled and the others outlined, so that the recommended plan stands out.
41. As a visitor, I want a two-column checklist of what every plan includes under the plans, so that I know I'm not missing features on a cheaper plan.
42. As a visitor, I want each "Choose …" button to take me to sign-in, so that the next step is obvious.
43. As a visitor, I want a Customers section with short quote cards, so that the page has the same rhythm as piqo's.
44. As a visitor, I want the quote cards to be clearly example placeholders, so that I'm never shown made-up reviews as if they were real.
45. As a visitor, I want an FAQ of about eight questions that expand and collapse, so that I can find answers without reading everything.
46. As a visitor, I want a final call to action ("Start free trial" button with "7 days free, then from $5/mo"), so that I have one last obvious next step.
47. As a visitor, I want a slim footer with the copyright and Features, Pricing, FAQ and Privacy links, so that the page ends cleanly.

### Visitor: theme and quality

48. As a visitor, I want the page to follow my system's light or dark theme, so that it matches my setup.
49. As a visitor, I want a theme toggle in the nav, so that I can switch to light or dark.
50. As a visitor in either theme, I want the mockups to use the same colours as the real dashboard in that theme, so that they look native.
51. As a visitor, I want the page to load fast and not shift as it loads, so that the first impression is good.
52. As a visitor, I want no sideways scroll at 375px, so that the page works on any phone.
53. As a visitor using reduced motion, I want jumps without smooth scrolling, so that the page respects my settings.

### Owner

54. As the owner, I want to stay redirected from `/` to `/websites` when signed in, so that the homepage never gets in my way.
55. As the owner, I want all copy, plans, FAQ entries, integrations, quotes and section metadata in one or a few typed content files, so that I can edit words and numbers without touching layout code.
56. As the owner, I want to swap a placeholder quote for a real one by editing one entry, so that social proof can be added later without a redesign.
57. As the owner, I want to remove a feature's "Soon" badge by flipping one flag when it ships, so that the page keeps up with the product.
58. As the owner, I want prices kept in one config object, so that changing them later is one edit.
59. As the owner, I want the homepage to stay a static page with no Convex or Clerk calls, so that it costs nothing to serve and can't break when the backend is down.
60. As the owner, I want the mockups made only from our own design tokens and components, so that they change with the app's theme.
61. As the owner, I want a `/privacy` page reachable from the footer, so that the page has the basic links a public product needs.
62. As the owner, I want nothing on the page to use piqo's name, logo or exact wording, so that we copy the design, not the brand.

## Implementation Decisions

### Route and rendering

- `/` stays public and static. The proxy keeps redirecting signed-in visitors to `/websites`, as decided in design v3 Phase 1.
- The page is a server component that renders the layout and content. Client islands are kept to the minimum: the nav's theme toggle (the existing `ThemeToggle`), the scroll-spy sidebar, the pricing Monthly / Yearly toggle and the FAQ disclosure (native `<details>` is fine and needs no JS).
- No Convex queries, no Clerk components on the page. Every CTA is a plain link to `/sign-in`, including "Dashboard", "Go to dashboard", "Start free trial" and "Choose …". Sign-up stays closed: Clerk remains invite-only.
- A new public `/privacy` route renders a privacy page (static). `/privacy` is added to the proxy's public routes. Its text is adapted from `docs/PRIVACY.md`. That file is written for the tracked sites' visitors, so the page's wording should cover the product, and the owner reviews it.
- The homepage's metadata (title and description) is updated for a public product.

### Module layout

A new homepage module (components under a `home` folder) holds:

- **Content** (typed data, no JSX layout): the hero copy, integrations, avatar personas, the section list (id, number, eyebrow, sidebar label, icon, heading lines, paragraph with an optional highlighted phrase, figure captions, `soon` flag), the plans, the "every plan includes" list, the quotes (each with a `placeholder: true` flag), the FAQ entries and the footer links.
- **Layout pieces:** `HomeNav`, `Hero`, `FeatureLayout` (the two-column grid), `ContentsSidebar` (client, scroll spy), `Section` (eyebrow, heading, paragraph, children), `Figure` (frame + "Fig. N" caption), `StatStrip` (three-column facts with a top rule), `CodeBlock` (the script tag), `PricingTable` (client), `Quotes`, `Faq`, `FinalCta`, `HomeFooter`.
- **Mockups:** one presentational component per figure: `AnalyticsMock` (Fig. 1), `PagesMock`, `RevenueMock`, `FunnelMock`, `GoalsMock`, `SearchMock`, `LiveMock`, `AskAiCard`. Each takes no props or only fixture data from a fixtures file. They are drawn with plain HTML and inline SVG, not recharts, so the page ships little JS and renders on the server. Charts are generated from fixture arrays by small pure helpers (bar heights, line path, sparkline path) so the shapes look like real data.
- Mockups use the dashboard's design tokens (`--line`, series colours, `--bar`, the v4 near-black dark palette) and the same type sizes, so they follow the theme. They reuse existing components only where those are purely presentational and free of Convex, router or URL-state hooks. `LogoMark`, the Nucleo `NavIcons` and the dotted world map's dot path data (the `world-dots` asset) are good candidates. Nothing inside a mockup is interactive: there are no links, focusable controls or hover states, and each mockup is `aria-hidden` with the figure caption as its accessible description.
- The mockups are scaled-down replicas, small text included, like piqo's screenshots. On narrow screens a figure keeps its desktop layout scaled to fit the column, or is clipped inside its frame. It never makes the page scroll sideways.

### Layout and look (like for like with the screenshots)

- Page container width as piqo: content spans about 1040px, with the nav aligned to the same edges. The app's own pages use `max-w-[1200px]`; the homepage may use its own width to match the screenshots.
- **Nav:** h-14 with a bottom border (`--line`), sticky with the page background behind it. Logo, "Analytics", then the links in muted text. On the right: the theme toggle and a solid "Dashboard" button (light fill in dark mode, as in the screenshot).
- **Hero:** centred. The pill has a small green dot, then "New · MCP server: ask Claude or Cursor about your stats →" in muted text, linking to `#s-ai`. The headline is about 48px, semibold and tight, in two lines. The paragraph is muted, about 18px, max ~560px wide. The two buttons are a filled "Go to dashboard" and an outlined "See features" (→ `#s-traffic`). Then the overlapping round avatars and the line "Built for founders & small teams · 7-day free trial, no card". Then "Integrates with" and a row of small logo tiles.
- **Fig. 1:** a large rounded frame (an outer border and an inner panel, as in the screenshot) holding `AnalyticsMock`: the top bar (logo, "Acme" switcher, "12 online", theme icon, initials), the tab row (Analytics, Pages, Users, Live, Settings), the "Analytics / Last 24 hours" header with Today | 24h | 7d | 30d and the range menu, seven joined tiles (Visitors, Pageviews, Revenue, Conv. rate, Signups, Bounce rate, Visit duration, with green and red changes), a legend, and the bar-and-line chart. The bottom of the frame fades into the page, so the fold cuts it off as in the screenshot.
- **Features grid:** two columns on `lg` and up. The left column is ~200px wide and holds a sticky "Contents" label, the items (lucide icon + label, active item with a filled muted background and foreground text, the others muted), a rule, the "Go to dashboard" button at full width, and the muted line "7 days free, then from $5/mo". The right column holds the sections. Below `lg` the sidebar is hidden.
- **Section:** an eyebrow "01 Traffic" in a small muted mono number plus a muted label, then the heading (~28px semibold, two lines), a muted paragraph max ~560px wide, then figures. Sections are separated by a horizontal rule with generous vertical padding (~96px), and each has `scroll-margin-top` larger than the nav.
- **"Soon" badge:** a small outlined badge after the eyebrow label and after the sidebar label for sections whose `soon` flag is set (Funnels and goals, Search), and on the built-in Ask AI row.
- **Figure frame:** a rounded outer border with padding, an inner rounded panel on the card background, and the caption under it: "Fig. N" muted, then the sentence.

### Sections and content

Section ids are `s-traffic`, `s-revenue`, `s-funnels`, `s-search`, `s-live`, `s-ai`, `s-setup`, `s-pricing`, `s-customers` and `s-faq`. The nav's Features → `#s-traffic`, Pricing → `#s-pricing`, FAQ → `#s-faq`. The copy is written fresh for each section. It may follow piqo's structure but not its sentences. Its claims about the live product must be true:

- **01 Traffic:** sources, referrers, campaigns, pages, countries and devices, each ranked. AI assistants (ChatGPT, Claude, Perplexity) get their own channel. Highlighted phrase: click any row to filter the whole dashboard. Fig. 2 is `PagesMock`.
- **02 Revenue:** connect Stripe or send payments through the API, and each payment is credited to the visit that brought it. Fig. 3 is `RevenueMock`. The stat strip reads "Stripe + API" / "payments credited to a visit", "Journeys" / "every session before a payment", and "Key goal" / "signups counted as conversions". Don't claim six providers, renewals syncing or Firebase/Supabase.
- **03 Funnels and goals (Soon):** describes funnels of two to eight steps and goals. Figs. 4 and 5 are `FunnelMock` and `GoalsMock`, side by side on `md` and up, stacked below.
- **04 Search (Soon):** Search Console and Bing next to traffic. Fig. 6 is `SearchMock`.
- **05 Realtime and visitors:** the live map (each visitor's page, location and source) and opening a visitor to see every session (both built). Fig. 7 is `LiveMock`.
- **06 Ask AI:** The left card is `AskAiCard`: a question bubble, a one-line answer, and a three-row table with bars and revenue values. The right is a list with a top and bottom rule on each row: Ask AI / "Built into the dashboard" / Soon, Claude Code / "In your terminal" / MCP, Claude Desktop / "Desktop and web" / MCP, Cursor / "Ask while you build" / MCP. The copy says the built-in assistant is coming and MCP works today.
- **07 Setup and privacy:** the text says a first-party cookie is the default, and one switch turns a site cookieless (Settings → Privacy → Visitor identity). Highlighted phrase: switch a site to cookieless. The code block is a muted comment `<!-- paste before </head> -->` and then the script tag in the real embed format (built with the existing snippet helper and a placeholder `data-site="your-site.com"`). Stat strip: "~2 KB" / "gzipped, loads async", "30 s" / "to your first visitor", "0" / "cookies in cookieless mode". Don't claim "under 1 KB": the script is about 2.3 KB gzipped.
- **08 Pricing:** piqo's numbers exactly, kept in one config object:
  - Starter, "Side projects and new launches", $5 / month or $49 billed yearly, 500,000 events / month.
  - Growth (Popular), "Growing products and small teams", $8 / month or $69 billed yearly, 1,000,000 events / month.
  - Scale, "Busy sites and agencies", $19 / month or $179 billed yearly, 2,500,000 events / month.
  - Toggle: Monthly | "Yearly, save up to 28%". In Yearly the big number shows the yearly price with "/ year" and the sub-line "or $N / month billed monthly".
  - Heading idea: pay for events, not features. Every plan includes every feature and up to 20 sites.
  - The "every plan includes" list is our own features, with unbuilt ones marked Soon: revenue and goal attribution, customer journeys, the realtime map, MCP access, cookieless mode, excluded paths and path grouping, funnels (Soon), Search Console and Bing (Soon).
  - Billing isn't built (`/billing` is "coming soon"). The plan buttons go to `/sign-in`.
- **09 Customers:** a grid of quote cards (3 columns on `lg`, 2 on `md`, 1 on phones), each with a persona avatar, a name and role line, and a quote. The content is placeholders: the names are personas (from the existing persona generator, e.g. "brown fox"), and each card carries a small "Example" label. Real quotes later replace entries in the content file and drop the flag. No invented people, companies or reviews presented as genuine.
- **10 FAQ:** eight entries as `<details>` disclosures with a rule between them, written to be true for this product: how it differs from Plausible or Fathom (revenue attribution, AI channel, MCP); what counts as an event; whether a cookie banner is needed (not in cookieless mode); what happens over the limit; performance impact; importing data (not yet, Soon); cancelling; how to get in touch (a contact address in the content file, left as a placeholder for the owner to fill in).
- **Final CTA:** a centred heading, a "Start free trial" button and "7 days free, then from $5/mo" under it.
- **Footer:** "© 2026 Analytics" on the left. On the right, Features, Pricing, FAQ and Privacy.

### Hero details

- The avatars are five overlapping circles made from the existing persona generator (emoji and colour), so no photos and no external requests.
- The integrations row shows only things that really work today, as monochrome brand marks from `react-icons` (Simple Icons): Stripe, Claude, Cursor, Vercel, Next.js, React, WordPress, Shopify and Webflow. The script tag works on any site. Each logo has an accessible name (its brand).

### Scroll spy

- `ContentsSidebar` watches the section elements with an `IntersectionObserver`. The active section is the last one whose top has passed a line just under the nav (about 30% down the viewport), falling back to the first. Picking the active id from the section positions is a small pure function so it can be unit-tested.
- Clicking an item scrolls to the section (smooth unless `prefers-reduced-motion`) and sets the hash with `history.replaceState`, so jumps don't fill the back history. Scrolling by hand updates the highlight but not the URL.
- On load with a hash, the browser's own anchor jump plus `scroll-margin-top` places the section, and the spy highlights it.
- The active item has `aria-current="true"`, and the sidebar is a `<nav aria-label="Contents">`.

### Theme

- Follows the system through the existing `ThemeProvider`, with `ThemeToggle` in the nav. Both themes are designed. The screenshots show dark, and light uses the app's light tokens. The pill dot and the green and red changes use the existing up and down colours.

### Testing and checks

- Unit tests (Vitest) for the pure pieces: the scroll-spy active-section picker, the chart path and bar helpers used by the mockups, and the pricing display (monthly and yearly strings, the "save up to 28%" figure computed from the config rather than hard-coded, or checked against it).
- The proxy keeps `/` public and adds `/privacy`: curl with no cookies gets 200 for both.
- `npm run build` shows `/` and `/privacy` as static. `npx tsc --noEmit`, `npm run lint` and `npm test` are clean.
- Checked in Chrome on a production build: light and dark, 1440px, 1024px and 375px wide; the sidebar highlight follows scrolling through all ten sections; clicking items and the nav links lands on the headings below the nav; `#s-pricing` opens at Pricing; the pricing toggle; FAQ open and close; no sideways scroll at 375px; no console errors; every CTA goes to `/sign-in`.

## Out of Scope

- Building any of the "Soon" features: funnels, Search Console / Bing, built-in Ask AI, data import, a public stats API, or shareable dashboards.
- Billing: Stripe checkout, plans, trials, event limits and their enforcement. The pricing section is presentation only.
- Opening sign-up. Clerk stays invite-only, and changing that is a separate decision.
- A live or public demo dashboard ("Open the live demo" becomes "See features").
- Docs pages, blog, changelog and Terms / DPA pages.
- Real testimonials, real customer logos and real user counts.
- Screenshot images of the app. The figures are coded mockups.
- Changing the signed-in redirect on `/`.
- SEO work beyond the page's title and description (no OG images, sitemap or structured data in v1).
- A mobile version of the Contents sidebar (it's hidden on phones).
- Animation beyond smooth scrolling and the theme switch.

## Further Notes

- **Brand:** the layout, spacing and rhythm copy piqo.app as closely as possible. The name, logo, wording, testimonials and screenshots must not. Our page says "Analytics", uses `LogoMark`, and has its own copy.
- **Honesty:** the page is public-facing, so claims about the live product must be true. Unbuilt features are marked "Soon", and placeholder quotes are labelled "Example". The owner flips the flags as features ship and real quotes come in.
- **Things for the owner to fill in:** the FAQ contact address, the privacy page wording, and eventually real quotes and a real social-proof line.
- **Size:** the hero mockup and the seven figures are the bulk of the work. Each mockup can be its own phase after a first phase that ships the shell: nav, hero copy, the two-column layout with the scroll spy, all section text with empty figure frames, pricing, FAQ, CTA and footer.
- Design references: piqo screenshots in `public/homepage/` (hero, Traffic, Revenue, Funnels, Search, Realtime, Ask AI, Setup and Pricing). The site itself has Customers, FAQ, the final CTA and the footer, which weren't captured.
- PROGRESS.md should gain a "Homepage v1" section when phases are built: decisions, checks, and the content files the owner edits.

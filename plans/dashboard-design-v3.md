# PRD: Design v3, account navigation, onboarding and homepage

Owner's brief: `plans/dashboard-design-v3-brief.md`. Screenshots: `public/design-v3/` (local only). Builds on design v2 (`plans/dashboard-design-v2.md`, `docs/PROGRESS.md`).

## Problem Statement

Design v2 made the site pages (Analytics, Live, Customers, Settings) feel like one product. The account side hasn't caught up yet:

- The websites list has no navigation of its own. It shows the site switcher reading "All sites", with no tabs. Account things like billing or account settings have nowhere to live.
- The top-right account control is Clerk's default avatar button. It doesn't match the shadcn look and doesn't show who is signed in.
- Adding a website is a small inline form that appears above the grid through `?add=1`. It asks for a domain and a timezone, then shows the snippet in a green sentence. A first-time user who has just signed in sees the same thin form inside an empty page. Nothing guides them through installing the script, and nothing tells them when it works.
- Signing out drops the user on the Clerk sign-in page. There is no public face for the product: `/` only redirects.

## Solution

1. **Account tabs.** `/websites`, `/billing` and `/settings` share a sub nav in the sticky top bar: **Websites | Billing | Settings**, styled like the site tabs. On these account pages the site switcher is hidden. The bar shows only the logo and the product name, and you open a site from the grid.
2. **A shadcn user menu.** The Clerk button is replaced by a trigger that shows a circle with the user's initials and their email (the email is truncated, and hidden on narrow screens). It opens **downwards** into a shadcn Dropdown Menu: "Signed in as" with the full email, then Websites, Billing and Settings, a separator, and a red **Sign out**. The theme toggle stays its own button in the bar.
3. **An add-website flow on its own page.** `/websites/new` is a two-step flow that matches the screenshots:
   - A stepper reading "1 Site details · 2 Install tracker".
   - A main card. Step 1 asks only for the domain and previews "We'll track example.com" as you type. Step 2 shows the snippet with Copy and a live "Waiting for your first event…" row.
   - A "How it works" side panel with three steps that tick off as you go, and an honest privacy note.

   When the first hit arrives, the row turns green, the third step ticks, and a **Go to dashboard** button appears. A new account with no sites lands here automatically, so this page is also the onboarding.
4. **A splash homepage at `/`.** Signed-out visitors see a minimal hero with the logo, "Analytics", a headline, one line of copy and a **Log in** button. Signing out lands here. Signed-in visitors who open `/` go straight to `/websites`.

## User Stories

### Account navigation

1. As the owner, I want the websites page to have Websites | Billing | Settings tabs under the top bar, so that account pages feel like the site pages.
2. As the owner, I want the Websites tab active when I'm on `/websites` or `/websites/new`, so that I know where I am.
3. As the owner, I want the tabs to be links with `aria-current` on the active one, so that they work with the keyboard, middle-click and screen readers.
4. As the owner, I want the account tabs to look exactly like the site tabs (underline, spacing, sideways scroll on mobile), so that the two levels feel like one design.
5. As the owner, I want no site switcher on account pages, so that the bar isn't showing a meaningless "All sites" and I pick a site from the grid.
6. As the owner, I want the logo and the name "Analytics" next to it on account pages, so that the bar doesn't look empty without the switcher.
7. As the owner, I want the logo to still take me to `/websites` from anywhere, so that I always have a way home.
8. As the owner, I want the site pages to keep their switcher and Analytics | Live | Customers | Settings tabs exactly as they are now, so that nothing I rely on changes.
9. As the owner, I want the "Add site" item in the site switcher to open `/websites/new`, so that every way of adding a site uses the same flow.

### User menu

10. As the owner, I want a circle with my initials in the top right, so that I can see at a glance that I'm signed in and as whom.
11. As the owner, I want my email next to the circle on wider screens, so that I know which account I'm using.
12. As the owner, I want only the circle on a phone, so that the bar stays on one line.
13. As the owner, I want the menu to open downwards from the top bar, so that it fits where the button sits.
14. As the owner, I want the menu to start with "Signed in as" and my full email, so that a long email is readable there even when the trigger cuts it short.
15. As the owner, I want Websites, Billing and Settings items with icons in the menu, so that I can reach account pages from any page, including inside a site.
16. As the owner, I want a red Sign out item, set apart by a separator, so that I don't click it by accident.
17. As the owner, I want initials taken from my name, or from my email when I have no name, so that the circle is never blank.
18. As the owner, I want the menu to work with the keyboard (open, arrow, Enter, Escape), so that it's accessible.
19. As the owner, I want the menu and trigger to read well in light and dark, so that they match the rest of the bar.
20. As the owner, I want the theme toggle to stay as its own button in the bar, so that switching theme is still one click.

### Billing and account settings

21. As the owner, I want a Billing page with a simple "Billing is coming soon" card, so that the tab isn't broken while billing doesn't exist.
22. As the owner, I want an account Settings page showing my email, so that I can confirm which account I'm in.
23. As the owner, I want a link on account Settings to manage my profile, password and email through Clerk, so that I can still change them now that the Clerk button is gone.
24. As the owner, I want a theme choice (Light / Dark / System) on account Settings, so that I can set it to follow the system again after using the toggle.
25. As the owner, I want a Sign out button on account Settings, so that signing out is also findable there.
26. As the owner, I want both pages to use the same page header and container as `/websites`, so that the three tabs look like one section.

### Add website: step 1 (site details)

27. As the owner, I want "Add website" on `/websites` to open `/websites/new`, so that adding a site gets a focused page with its own URL.
28. As the owner, I want a stepper at the top showing "1 Site details" and "2 Install tracker", so that I know how many steps there are.
29. As the owner, I want a card titled "Add your website" with "Enter the domain you want to track.", so that the task is clear.
30. As the owner, I want a single Domain field with a globe icon and an Enter hint, so that adding a site is one field and one keystroke.
31. As the owner, I want the field focused when the page opens, so that I can start typing straight away.
32. As the owner, I want a hint under the field ("No https:// or paths, subdomains work too"), so that I know what to enter.
33. As the owner, I want to paste a full URL like `https://www.example.com/` and see "We'll track example.com", so that I know how it will be stored before I submit.
34. As the owner, I want the field's icon to show the site's favicon once the domain looks valid, so that I can see it's the right site.
35. As the owner, I want "Create site →" disabled until the domain looks valid, so that I can't submit an empty or broken domain.
36. As the owner, I want "Create site" to show a pending state while it saves, so that I don't press it twice.
37. As the owner, I want a clear inline error if the domain is invalid or already added, so that I can fix it without losing what I typed.
38. As the owner, I want the timezone taken from my browser without asking, so that step 1 stays one field.
39. As the owner, I want a small hint showing that timezone ("Timezone: Europe/Oslo · change it in the site's settings"), so that I know which one was picked and where to change it.
40. As the owner, I want a Cancel link back to `/websites`, so that I can leave without adding anything.
41. As a new user with no sites, I want no Cancel link (there's nothing to go back to), so that the page reads as onboarding.

### Add website: step 2 (install tracker)

42. As the owner, I want the stepper to show step 1 with a green tick and step 2 as current once the site is created, so that I can see my progress.
43. As the owner, I want step 2's URL to name the new site (for example `/websites/new?site=example.com`), so that reloading or coming back keeps me on the install step.
44. As the owner, I want a card titled "Install the tracker" saying "Add this line inside the `<head>` of your site.", so that I know where the snippet goes.
45. As the owner, I want a row with the site's favicon, domain and a green "Created" badge, so that I can see the site exists.
46. As the owner, I want the snippet in a code block labelled "HTML · paste in `<head>`" with a Copy button, so that I can install it in one click.
47. As the owner, I want the snippet to be the same one site Settings shows, so that there is one source of truth.
48. As the owner, I want a "Waiting for your first event…" row with a pulsing dot, so that I know the page is listening.
49. As the owner, I want that row to turn into "First pageview received" with a green tick as soon as a hit lands, without reloading, so that I know the install worked.
50. As the owner, I want a "Go to dashboard →" button once the first hit is in, so that the next step is obvious.
51. As the owner, I want a "Skip to dashboard" link while it's still waiting, so that I'm not stuck if I'll install it later.
52. As the owner, I want a note that the snippet is also in the site's Settings, so that I don't worry about losing it.
53. As the owner, I want a site added with a cookieless snippet to count as installed too, so that the waiting row works in either mode.
54. As the owner, I want `?site=` naming a site that isn't mine (or doesn't exist) to fall back to step 1, so that a stale link can't show someone else's data.

### "How it works" panel

55. As the owner, I want a "How it works" panel beside the card ("live in about two minutes"), so that I know what's coming.
56. As the owner, I want three steps (Add your domain, Paste one line, See visitors live), each with an icon and a one-line hint, so that the process is clear.
57. As the owner, I want the current step highlighted and finished steps ticked, so that the panel follows my progress.
58. As the owner, I want the "Paste one line" hint to state the script's real size, so that the copy is true.
59. As the owner, I want an honest privacy note (no personal data sold or shared; add `data-cookieless` to run without cookies) in a muted alert, so that the claim matches how the script works.
60. As the owner on a phone, I want the panel to stack under the main card, so that the page reads top to bottom with no sideways scroll.

### Onboarding

61. As a new user who signs in with no sites, I want to land on `/websites/new` instead of an empty grid, so that the first thing I see is how to get started.
62. As the owner who deletes their last site, I want `/websites` to send me to `/websites/new`, so that the empty state is always the onboarding flow.
63. As the owner with sites, I want `/websites` to show the grid as now, so that the onboarding never gets in my way.

### Homepage and sign out

64. As a signed-out visitor, I want `/` to show a simple splash page instead of redirecting to sign-in, so that the product has a front door.
65. As a signed-out visitor, I want the logo and "Analytics" top left and Log in top right, so that it looks like a product page.
66. As a signed-out visitor, I want a centred headline, one line of copy and a Log in button, so that I know what this is and how to get in.
67. As a signed-out visitor, I want Log in to open the existing sign-in page, so that it works.
68. As a signed-out visitor, I want the homepage to follow my system's light or dark mode, so that it matches the app.
69. As a signed-out visitor on a phone, I want the homepage to fit with no sideways scroll, so that it reads well.
70. As the owner, I want Sign out (from the menu or account Settings) to take me to `/`, so that I land on the homepage, not the sign-in form.
71. As a signed-in user, I want `/` to redirect to `/websites`, so that bookmarks of the root still open the app.
72. As the owner, I want signing in to land me on `/websites` (or `/websites/new` with no sites), so that the flow continues where it should.

### Quality

73. As the owner, I want every new piece built from shadcn components (Dropdown Menu, Avatar, Card, Badge, Alert, Input, Button), so that the look stays consistent and easy to change.
74. As the owner, I want all new pages to read well in light and dark, so that both themes stay first-class.
75. As the owner, I want every new page at 375px wide to have no sideways scroll, so that the app works on a phone.

## Implementation Decisions

### Top bar

- The top bar takes one of two modes. **Site mode** is today's behaviour: switcher, online count, and the Analytics / Live / Customers / Settings tabs. **Account mode** takes a section (`websites | billing | settings`) and shows the logo plus the "Analytics" wordmark, no switcher, and the Websites / Billing / Settings tabs.
- Both tab rows use one shared tab-strip piece, so the styles can't drift apart.
- `/websites/new` uses account mode with Websites active.
- The visitor profile keeps site mode with Customers active, as now.

### User menu

- A new client component replaces Clerk's `UserButton` in the bar, built on the existing shadcn Dropdown Menu (Base UI) plus shadcn Avatar (added with the shadcn CLI). It aligns to the end and opens below the trigger.
- It reads the user with Clerk's `useUser` (primary email, first and last name) and signs out with Clerk's `useClerk().signOut({ redirectUrl: "/" })`.
- The initials rule is a small pure function with unit tests. It uses the first letters of the first and last name. Without a name, it uses the first two letters of the email's local part, upper-cased.
- On narrow screens the trigger shows the avatar only (the email is hidden below the `sm` breakpoint and truncated above it).

### Routes

- `/websites`: the grid. If the site list loads empty, it does a client-side `replace` to `/websites/new`.
- `/websites/new`: the add flow. The step comes from the URL: no `?site=` means step 1, and `?site=<domain>` means step 2 for a site the user owns, checked with `sites.get`, which returns null for one that isn't theirs. After `sites.create` succeeds the page `replace`s to `?site=<normalised domain>`.
- `/billing` and `/settings`: account pages. These top-level names don't clash with `/sites/[domain]/settings`.
- `/`: a public splash page. The proxy adds `/` to the public routes. The page checks `auth()` on the server and redirects signed-in users to `/websites`.
- `?add=1` on `/websites` is dropped. The switcher's "Add site" and the header's "Add website" button link to `/websites/new`.
- Clerk's after-sign-in fallback stays `/websites`, which then forwards empty accounts to `/websites/new`.

### Add-website flow

- Step 1 sends `{ domain, timezone }` to the existing `sites.create`, with the timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`. The mutation is unchanged.
- The live preview ("We'll track …") uses the same `normalizeDomain` the server uses, so the preview and the stored domain always agree (for example, `www.` is stripped).
- Server errors (duplicate, invalid) show inline under the field from the `ConvexError` message, as the current form does.
- Step 2 reuses `embedSnippet` and `CopyButton`. The old inline `AddWebsiteForm` is removed once nothing uses it. The `Snippet` piece stays for site Settings, restyled to the step 2 code-block look so both match.
- The "How it works" panel is presentational. Its state (step 1, step 2 waiting, step 2 received) comes from the flow.

### First-event signal (backend)

- A new query in the sites module (for example `sites.firstHit`) is guarded the same way as `sites.get`. It returns whether the site has any pageview, or the timestamp of the first one.
- It reads **one** row through the existing `by_site_ts` index, so it costs one document read whatever the site's size.
- This works for cookieless sites, unlike `trackingStartedAt`, which only hits with visitor ids set.
- The page subscribes to it, so Convex's reactivity flips the row with no polling. The screenshot's "checks every 5s" label is dropped.
- It is covered by convex-test cases: not yours returns null; no hits returns false; a cookieless hit returns true.

### Account pages

- Billing is a page header ("Billing") plus one card: "Billing is coming soon".
- Settings is a page header ("Settings"). It has an account card with the email and a "Manage account" button that opens Clerk's hosted profile (or a `UserProfile` route if that is simpler with the current Clerk setup). It also has a theme card (Light / Dark / System through next-themes) and a Sign out button.

### Homepage

- The homepage is a server component, with no Convex. It reuses the logo mark and the shadcn Button.
- The copy is placeholder-quality and easy to edit: the headline "Simple, private website analytics" and one supporting line.
- It has only a Log in button. There is no Sign up while Clerk is Invite-only.

### Styling

- All new UI uses shadcn tokens, light and dark, the shared `max-w-[1200px]` container, and `pt-10 pb-20` page padding.
- The add flow's two columns are about 60/40 at `lg` and stack below it.

## Out of Scope

- Real billing (Stripe subscriptions for the app itself, plans, trials). The screenshot's "Trial · 7 days left" badge and the notification bell are not built.
- Public sign-up and the Clerk switch from Invite-only. The homepage has Log in only.
- A full marketing site (feature sections, pricing, docs, troubleshooting and platform guides).
- Naming or renaming a site, or a display name separate from the domain.
- Changing the snippet format (the screenshot's `data-site` id and `data-domain`). We keep the current domain-based snippet.
- A cookieless toggle in site settings. The note points to the `data-cookieless` attribute.
- A left sidebar layout like the screenshots. We keep the v2 sticky top bar.
- Moving to a Clerk production instance or a custom domain.

## Further Notes

- The screenshots come from another product. Only the add-flow layout and the user menu's contents are being copied. The surrounding shell (sidebar, trial badge) is not.
- `trackingStartedAt` is deliberately not used for the first-event signal, because it stays empty for cookieless sites.
- If a later phase adds public sign-up, the onboarding redirect already covers new users. The homepage only needs a Sign up button then.
- PROGRESS.md should get a "Design v3" decisions section when this ships: account mode in the top bar, the `/websites/new` routes, `?add=1` removed, `/` public, and the first-hit query.

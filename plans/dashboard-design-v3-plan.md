# Plan: Design v3, account navigation, onboarding and homepage

> Source PRD: `plans/dashboard-design-v3.md` (owner's brief: `plans/dashboard-design-v3-brief.md`, screenshots in `public/design-v3/`)

Work one phase at a time and stop after each one for the owner to review. At the end of every phase, `npm run build`, `npx tsc --noEmit`, `npm run lint` and `npm test` must all pass. Click the change through in Chrome in light and dark, and check it at 375px. Then update `docs/PROGRESS.md`.

## Architectural decisions

These decisions apply to every phase:

- **Routes**:
  - `/` is a public splash page. Signed-in users are redirected to `/websites`.
  - `/websites` is the grid.
  - `/websites/new` is the add flow. `?site=<domain>` means step 2 for a site the user owns.
  - `/billing` and `/settings` are account pages.
  - The site pages under `/sites/[domain]/…` don't change.
  - `?add=1` on `/websites` is removed.
  - Sign out redirects to `/`.
  - Sign-in still lands on `/websites`.
- **Auth**:
  - The proxy adds `/` to the public routes. Everything else stays protected.
  - Clerk stays Invite-only, so the homepage has Log in only.
  - Ownership checks stay as they are (`requireSite` / `findOwnedSite`). A site that isn't yours reads as missing.
- **Top bar**:
  - The sticky top bar has two modes.
  - **Site mode** is today's: switcher, online count, and Analytics / Live / Customers / Settings.
  - **Account mode** shows the logo plus the "Analytics" wordmark, no switcher, and Websites / Billing / Settings. `/websites/new` uses account mode with Websites active.
  - Both tab rows share one tab-strip piece.
- **Schema**:
  - No schema changes.
  - The first-event signal is a new owner-guarded query in the sites module. It reads one row of `pageviews` through the existing `by_site_ts` index.
  - It is deliberately not based on `trackingStartedAt`, which cookieless sites never set.
- **Site creation**:
  - The existing `sites.create({ domain, timezone })` is unchanged.
  - The timezone comes from the browser.
  - The client preview uses the server's `normalizeDomain`.
- **UI**:
  - Every new piece is a shadcn component, added with the shadcn CLI (base-nova, Base UI).
  - Pages use the shared `max-w-[1200px]` container with `px-4 sm:px-6 lg:px-8` and `pt-10 pb-20`.
  - Every page works in light and dark, and has no sideways scroll at 375px.

---

## Phase 1: Public homepage and sign-out landing

**User stories**: 64, 65, 66, 67, 68, 69, 70 (with the current Clerk button), 71

### What to build

`/` stops being a bare redirect and becomes a minimal, public splash page:

- Top left: the logo mark and "Analytics". Top right: Log in.
- In the centre: a headline ("Simple, private website analytics"), one line of copy and a Log in button. Both Log in buttons open the existing sign-in page.

The page renders on the server with no Convex. It follows the system theme. A signed-in user who opens `/` is redirected to `/websites`. The proxy lets `/` through without signing in. The existing Clerk user button signs out to `/`, so signing out lands on the homepage.

### Acceptance criteria

- [ ] Signed out, `/` shows the splash page, not the sign-in form.
- [ ] Log in (both buttons) opens `/sign-in`, and signing in lands on `/websites`.
- [ ] Signed in, `/` redirects to `/websites`.
- [ ] Signing out from the current user button lands on `/`.
- [ ] Every other route still requires sign-in.
- [ ] The page reads well in light and dark and has no sideways scroll at 375px.

---

## Phase 2: Account tabs and placeholder pages

**User stories**: 1, 2, 3, 4, 5, 6, 7, 8, 21, 22, 23, 24, 25, 26

### What to build

The top bar gains account mode. On `/websites`, `/billing` and `/settings`:

- It shows the logo plus "Analytics" with no site switcher.
- It shows a Websites | Billing | Settings tab row that looks exactly like the site tabs: underline, spacing, sideways scroll on mobile, and `aria-current` on the active tab.

The logo still links to `/websites`. Site pages keep site mode unchanged.

`/billing` has the shared page header ("Billing") and one card: "Billing is coming soon".

`/settings` has the page header ("Settings") and three things:

- An account card with the signed-in email and a "Manage account" button that opens Clerk's profile.
- A theme card with Light / Dark / System through next-themes.
- A Sign out button that goes to `/`.

### Acceptance criteria

- [ ] `/websites` shows the account tabs with Websites active, and no switcher.
- [ ] `/billing` and `/settings` show their tab active and their content.
- [ ] The account and site tab rows look the same, and both scroll sideways on a phone.
- [ ] Site pages still show the switcher, the online count and their four tabs exactly as before.
- [ ] Manage account opens Clerk's profile, and the theme choice survives a reload. Choosing System follows the OS again.
- [ ] Sign out on `/settings` lands on `/`.
- [ ] Light and dark, and 375px, checked on all three pages.

---

## Phase 3: shadcn user menu

**User stories**: 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 70

### What to build

Clerk's user button in the bar is replaced by a shadcn trigger: an Avatar circle with the user's initials, plus the email (hidden below `sm`, truncated above it). The initials come from the first and last name, or else the first two letters of the email's local part. That rule is a pure function with unit tests.

The trigger opens a shadcn Dropdown Menu below the bar, aligned to the end. It holds:

- "Signed in as" and the full email.
- Websites, Billing and Settings, each with an icon.
- A separator, then a red Sign out that goes to `/`.

The theme toggle stays its own button. The menu appears in both modes of the bar.

### Acceptance criteria

- [ ] The trigger shows the right initials and email, and only the circle at 375px.
- [ ] The menu opens downwards and its items go to `/websites`, `/billing` and `/settings`.
- [ ] Sign out lands on `/`.
- [ ] Keyboard works: open, arrow through the items, Enter, Escape.
- [ ] The initials rule has unit tests covering a full name, no name, and a one-letter local part.
- [ ] The menu reads well in light and dark, inside a site and on account pages.
- [ ] Clerk's `UserButton` is no longer used in the bar.

---

## Phase 4: Add website, step 1 (site details)

**User stories**: 9, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 55, 56, 59, 60

### What to build

`/websites/new` (account mode, Websites active) has:

- A stepper reading "1 Site details · 2 Install tracker", with step 1 current.
- A main card, "Add your website / Enter the domain you want to track."
- A "How it works" side panel. It stacks under the card below `lg` and sits beside it at roughly 60/40.

The card holds one focused Domain field with a globe icon and an Enter hint. Under it:

- The hint "No https:// or paths, subdomains work too".
- As you type, a live "We'll track example.com" preview using the server's normaliser. The icon becomes the site's favicon once the domain is valid.
- A small "Timezone: <browser tz> · change it in the site's settings" hint.

Below these sit Cancel (back to `/websites`) and "Create site →". The button is disabled until the domain is valid and shows a pending state while saving. Errors show inline from the server's message.

The panel shows the three steps with icons and hints:

- Add your domain (current).
- Paste one line (with the script's real size).
- See visitors live.

Under them is a muted Alert with the honest privacy note: no personal data sold or shared, and `data-cookieless` to run without cookies.

On success the page replaces the URL with `?site=<normalised domain>`. Step 2 shows the stepper advanced, with a minimal "site created" state and the snippet until Phase 5 fills it in.

The "Add website" header button and the switcher's "Add site" now link to `/websites/new`. The `?add=1` handling and the old inline add form are removed (the empty state temporarily links to `/websites/new` too).

### Acceptance criteria

- [ ] The "Add website" button and the switcher's "Add site" both open `/websites/new`.
- [ ] Pasting `https://www.example.com/path` previews "We'll track example.com", and the stored domain matches.
- [ ] Create is disabled for an empty or invalid domain. Adding a duplicate shows the server's error inline and keeps the input.
- [ ] A new site is created with the browser's timezone, visible in its Settings.
- [ ] After create, the URL has `?site=` and the stepper shows step 1 ticked.
- [ ] Cancel returns to `/websites`.
- [ ] `/websites?add=1` no longer opens anything special.
- [ ] Light and dark checked. At 375px the panel sits under the card with no sideways scroll.

---

## Phase 5: Add website, step 2 (install tracker) and first-hit detection

**User stories**: 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 57, 58

### What to build

**Backend.** A new owner-guarded query returns whether a site has any pageview yet. It returns null for a site that is missing or not yours. It reads one row through `by_site_ts` and counts cookieless hits. convex-test cases cover:

- A site that isn't yours returns null.
- A site with no hits returns false.
- A cookieless hit returns true.
- A hit with visitor ids returns true.

**Step 2.** It renders only for a `?site=` the user owns. Otherwise it falls back to step 1. It shows:

- "Install the tracker / Add this line inside the `<head>` of your site."
- A row with the favicon, the domain and a green "Created" badge.
- The snippet in a code block labelled "HTML · paste in `<head>`" with Copy. This is the same `embedSnippet` output, and site Settings is restyled to the same block.
- A live status row. It reads "Waiting for your first event…" with a pulsing dot, then flips to "First pageview received" with a green tick through the reactive query, with no polling. "Go to dashboard →" then appears.
- While waiting, a "Skip to dashboard" link.
- A note that the snippet is also in the site's Settings.

**The panel.** It ticks Add your domain and highlights Paste one line. It ticks the rest once the first hit arrives.

### Acceptance criteria

- [ ] Reloading `/websites/new?site=<your domain>` stays on step 2.
- [ ] A `?site=` for a domain you don't own, or one that doesn't exist, shows step 1.
- [ ] Copy copies the exact snippet, and site Settings shows the same snippet in the same style.
- [ ] Loading `/test.html` for a fresh `localhost` site (or curling `/api/collect`) flips the row to received without a reload.
- [ ] A cookieless hit flips it too.
- [ ] Go to dashboard and Skip to dashboard both open `/sites/<domain>`.
- [ ] convex-test cases for the new query pass, and the query reads at most one pageview.
- [ ] Light and dark checked, and 375px checked.

---

## Phase 6: Onboarding redirect

**User stories**: 41, 61, 62, 63, 72

### What to build

When the user's site list loads empty, `/websites` replaces itself with `/websites/new`. This covers a brand-new account signing in and the owner deleting their last site. The old empty-state section is removed.

On `/websites/new`, Cancel is hidden when the user has no sites, so the page reads as onboarding. Users with sites see the grid and Cancel exactly as before.

### Acceptance criteria

- [ ] With no sites (a throwaway Clerk user on Convex dev, or temporarily deleting dev sites), signing in lands on `/websites/new` with no Cancel.
- [ ] Deleting the last site and returning to `/websites` lands on `/websites/new`.
- [ ] With at least one site, `/websites` shows the grid and `/websites/new` shows Cancel.
- [ ] There is no flash of an empty grid before the redirect (the loading skeleton shows until the list is known).
- [ ] `docs/PROGRESS.md` has a "Design v3" decisions section covering:
  - Account mode in the top bar.
  - The `/websites/new` routes.
  - `?add=1` removed.
  - `/` public.
  - The first-hit query.
  - The user menu.

"use client";

import { useEffect, useRef, type ComponentType } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Authenticated, useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatFiltersParam, parseFiltersParam } from "../../convex/lib/filters";
import { useNow } from "@/components/dashboard/useNow";
import LogoMark from "@/components/LogoMark";
import {
  ArrowOutIcon,
  BanknoteIcon,
  ChartLineIcon,
  CreditCardIcon,
  GearIcon,
  GlobeIcon,
  PageIcon,
  RadioIcon,
  TargetIcon,
  UsersIcon,
} from "@/components/NavIcons";
import SiteSwitcher from "@/components/SiteSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import { formatNumber } from "@/lib/format";
import { trialLabel } from "@/lib/trial";

export type SiteSection =
  | "analytics"
  | "pages"
  | "users"
  | "revenue"
  | "goals"
  | "outbound"
  | "live"
  | "settings";
export type AccountSection = "websites" | "billing" | "settings";

type Icon = ComponentType<{ className?: string }>;

const SITE_TABS: { section: SiteSection; label: string; icon: Icon }[] = [
  { section: "analytics", label: "Analytics", icon: ChartLineIcon },
  { section: "pages", label: "Pages", icon: PageIcon },
  { section: "users", label: "Users", icon: UsersIcon },
  { section: "revenue", label: "Revenue", icon: BanknoteIcon },
  { section: "goals", label: "Goals", icon: TargetIcon },
  { section: "outbound", label: "Outbound", icon: ArrowOutIcon },
  { section: "live", label: "Live", icon: RadioIcon },
  { section: "settings", label: "Settings", icon: GearIcon },
];

// Views that take a range, filters and the cards' metric, which carry over when switching between them
const RANGED: SiteSection[] = ["analytics", "pages", "users", "revenue", "goals", "outbound"];

const ACCOUNT_TABS: { section: AccountSection; label: string; href: string; icon: Icon }[] = [
  { section: "websites", label: "Websites", href: "/websites", icon: GlobeIcon },
  { section: "billing", label: "Billing", href: "/billing", icon: CreditCardIcon },
  { section: "settings", label: "Settings", href: "/settings", icon: GearIcon },
];

// Same window and refresh as the Live tab's "online now"
const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const ONLINE_REFRESH_MS = 30 * 1000;

export function sitePath(domain: string, section: SiteSection): string {
  const base = `/sites/${encodeURIComponent(domain)}`;
  return section === "analytics" ? base : `${base}/${section}`;
}

/** The Users tab with a visitor's drawer open. */
export function visitorPath(domain: string, visitorId: string): string {
  return `${sitePath(domain, "users")}?visitor=${encodeURIComponent(visitorId)}`;
}

type TopBarProps =
  | { site: { domain: string; section: SiteSection }; account?: never }
  | { account: AccountSection; site?: never };

/**
 * The sticky bar on every signed-in page, in one of two modes. Site mode (a site's pages):
 * logo, site switcher, online count and the site's section tabs. Account mode (websites,
 * billing, settings): logo and "Simple Stats" and the account tabs. Both have the trial pill
 * (while trialing, or "Payment failed" while past due), the theme toggle and the user menu. The current tab is a link too, so a visitor profile (under
 * Users) can go back.
 */
export default function TopBar({ site, account }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Link
              href="/websites"
              aria-label="All sites"
              className="shrink-0"
            >
              <LogoMark />
            </Link>
            {site ? (
              <>
                <span aria-hidden className="px-1 text-muted-foreground/50">
                  /
                </span>
                <Authenticated>
                  <SiteSwitcher current={site.domain} section={site.section} />
                </Authenticated>
              </>
            ) : (
              <span className="pl-1 font-semibold tracking-tight">Simple Stats</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Authenticated>
              <TrialPill />
              {site && <OnlineNow domain={site.domain} />}
            </Authenticated>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
        {site ? (
          <SiteTabs domain={site.domain} section={site.section} />
        ) : (
          <TabStrip
            label="Account"
            tabs={ACCOUNT_TABS.map((t) => ({ label: t.label, href: t.href, icon: t.icon, active: t.section === account }))}
          />
        )}
      </div>
    </header>
  );
}

/**
 * The site's tabs. From one ranged view to another (Analytics, Pages, Users, Revenue,
 * Goals, Outbound) the links keep `?range=`, `?f=` and `?metric=`, so you compare like
 * with like. Revenue shows only on sites that take payments. Site pages render inside
 * Suspense, so reading the query string here is fine.
 */
function SiteTabs({ domain, section }: { domain: string; section: SiteSection }) {
  const searchParams = useSearchParams();
  const { isAuthenticated } = useConvexAuth();
  const site = useQuery(api.sites.get, isAuthenticated ? { domain } : "skip");
  const payments = site != null && site.revenueSource !== "none";
  const ranged = RANGED.includes(section);
  const range = ranged ? searchParams.get("range") : null;
  const filters = ranged ? formatFiltersParam(parseFiltersParam(searchParams.get("f"))) : "";
  const metric = ranged ? searchParams.get("metric") : null;
  const query = [
    range && `range=${encodeURIComponent(range)}`,
    filters && `f=${filters}`,
    metric && `metric=${encodeURIComponent(metric)}`,
  ]
    .filter(Boolean)
    .join("&");
  const shown = SITE_TABS.filter((t) => t.section !== "revenue" || payments || section === "revenue");
  return (
    <TabStrip
      label="Site sections"
      tabs={shown.map((t) => ({
        label: t.label,
        icon: t.icon,
        href: `${sitePath(domain, t.section)}${query && RANGED.includes(t.section) ? `?${query}` : ""}`,
        active: t.section === section,
      }))}
    />
  );
}

/**
 * The underlined tab row under the bar; scrolls sideways on narrow screens, with the
 * current tab scrolled into view.
 */
function TabStrip({
  label,
  tabs,
}: {
  label: string;
  tabs: { label: string; href: string; active: boolean; icon?: Icon }[];
}) {
  const current = useRef<HTMLAnchorElement>(null);
  const active = tabs.find((t) => t.active)?.label;
  useEffect(() => {
    const tab = current.current;
    const strip = tab?.parentElement;
    if (!tab || !strip || strip.scrollWidth <= strip.clientWidth) return;
    // Only the strip scrolls, not the page
    const left = tab.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + tab.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = left - (strip.clientWidth - tab.offsetWidth) / 2;
    }
  }, [active]);
  return (
    <nav aria-label={label} className="-mb-px flex gap-6 overflow-x-auto text-sm [scrollbar-width:none]">
      {tabs.map((t) => (
        <Link
          key={t.label}
          ref={t.active ? current : undefined}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={
            t.active
              ? "flex shrink-0 items-center gap-1.5 border-b-2 border-foreground pt-1 pb-3 text-foreground"
              : "flex shrink-0 items-center gap-1.5 border-b-2 border-transparent pt-1 pb-3 text-muted-foreground transition-colors hover:text-foreground"
          }
        >
          {t.icon && <t.icon className="size-4 shrink-0" />}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

// The pill's day count only needs to move a few times a day
const TRIAL_REFRESH_MS = 60 * 1000;

/**
 * "Trial · N days left" while trialing, or a red "Payment failed" while past due (Phase 5),
 * linking to Billing; nothing once subscribed, comped or locked.
 */
function TrialPill() {
  const now = useNow(TRIAL_REFRESH_MS);
  const account = useQuery(api.accounts.me);
  if (account?.access === "past_due") {
    return (
      <Link
        href="/billing"
        className="mr-1 flex shrink-0 items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-destructive transition-colors hover:bg-destructive/20"
      >
        <span aria-hidden className="size-1.5 rounded-full bg-destructive" />
        Payment failed
      </Link>
    );
  }
  if (account?.access !== "trialing") return null;
  return (
    <Link
      href="/billing"
      className="mr-1 flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap text-foreground transition-colors hover:bg-accent"
    >
      {/* useNow snaps down a step, which made a fresh 7-day trial read "8 days"; round up instead */}
      {trialLabel(account.trialEndsAt, now + TRIAL_REFRESH_MS)}
    </Link>
  );
}

/**
 * Green dot and "N online", linking to Live; nothing for cookieless sites (no visitor ids)
 * or a locked account (the server would refuse the count).
 */
function OnlineNow({ domain }: { domain: string }) {
  const now = useNow(ONLINE_REFRESH_MS);
  const site = useQuery(api.sites.get, { domain });
  const account = useQuery(api.accounts.me);
  const tracking = site != null && site.trackingStartedAt !== null && account != null && account.access !== "locked";
  const online = useQuery(api.stats.online, tracking ? { domain, since: now - ONLINE_WINDOW_MS } : "skip");
  if (!tracking) return null;
  return (
    <Link
      href={sitePath(domain, "live")}
      title="Visitors with a pageview or ping in the last 5 minutes"
      className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
    >
      <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
      <span className="font-medium text-foreground tabular-nums">
        {online === undefined ? "–" : formatNumber(online)}
      </span>
      <span className="text-muted-foreground">online</span>
    </Link>
  );
}

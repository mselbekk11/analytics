"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Authenticated, useQuery } from "convex/react";
import { ChartLineIcon, FileTextIcon, RadioIcon, SettingsIcon, UsersIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { formatFiltersParam, parseFiltersParam } from "../../convex/lib/filters";
import { useNow } from "@/components/dashboard/useNow";
import LogoMark from "@/components/LogoMark";
import SiteSwitcher from "@/components/SiteSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import { formatNumber } from "@/lib/format";

export type SiteSection = "analytics" | "pages" | "users" | "live" | "settings";
export type AccountSection = "websites" | "billing" | "settings";

type Icon = ComponentType<{ className?: string }>;

const SITE_TABS: { section: SiteSection; label: string; icon: Icon }[] = [
  { section: "analytics", label: "Analytics", icon: ChartLineIcon },
  { section: "pages", label: "Pages", icon: FileTextIcon },
  { section: "users", label: "Users", icon: UsersIcon },
  { section: "live", label: "Live", icon: RadioIcon },
  { section: "settings", label: "Settings", icon: SettingsIcon },
];

// Views that take a range and filters, which carry over when switching between them
const RANGED: SiteSection[] = ["analytics", "pages", "users"];

const ACCOUNT_TABS: { section: AccountSection; label: string; href: string }[] = [
  { section: "websites", label: "Websites", href: "/websites" },
  { section: "billing", label: "Billing", href: "/billing" },
  { section: "settings", label: "Settings", href: "/settings" },
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
 * billing, settings): logo and "Analytics" and the account tabs. Both have the theme toggle
 * and the user menu. The current tab is a link too, so a visitor profile (under
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
              <span className="pl-1 font-semibold tracking-tight">Analytics</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {site && (
              <Authenticated>
                <OnlineNow domain={site.domain} />
              </Authenticated>
            )}
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
        {site ? (
          <SiteTabs domain={site.domain} section={site.section} />
        ) : (
          <TabStrip
            label="Account"
            tabs={ACCOUNT_TABS.map((t) => ({ label: t.label, href: t.href, active: t.section === account }))}
          />
        )}
      </div>
    </header>
  );
}

/**
 * The site's tabs. From one ranged view to another (Analytics, Pages, Users) the links keep
 * `?range=` and `?f=`, so you compare like with like. Site pages render inside Suspense,
 * so reading the query string here is fine.
 */
function SiteTabs({ domain, section }: { domain: string; section: SiteSection }) {
  const searchParams = useSearchParams();
  const range = RANGED.includes(section) ? searchParams.get("range") : null;
  const filters = RANGED.includes(section) ? formatFiltersParam(parseFiltersParam(searchParams.get("f"))) : "";
  const query = [range && `range=${encodeURIComponent(range)}`, filters && `f=${filters}`].filter(Boolean).join("&");
  return (
    <TabStrip
      label="Site sections"
      tabs={SITE_TABS.map((t) => ({
        label: t.label,
        icon: t.icon,
        href: `${sitePath(domain, t.section)}${query && RANGED.includes(t.section) ? `?${query}` : ""}`,
        active: t.section === section,
      }))}
    />
  );
}

/** The underlined tab row under the bar; scrolls sideways on narrow screens. */
function TabStrip({
  label,
  tabs,
}: {
  label: string;
  tabs: { label: string; href: string; active: boolean; icon?: Icon }[];
}) {
  return (
    <nav aria-label={label} className="-mb-px flex gap-6 overflow-x-auto text-sm [scrollbar-width:none]">
      {tabs.map((t) => (
        <Link
          key={t.label}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={
            t.active
              ? "flex shrink-0 items-center gap-1.5 border-b-2 border-foreground pt-1 pb-3 text-foreground"
              : "flex shrink-0 items-center gap-1.5 border-b-2 border-transparent pt-1 pb-3 text-muted-foreground transition-colors hover:text-foreground"
          }
        >
          {t.icon && <t.icon aria-hidden className="size-4" />}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Green dot and "N online", linking to Live; nothing for cookieless sites (no visitor ids). */
function OnlineNow({ domain }: { domain: string }) {
  const now = useNow(ONLINE_REFRESH_MS);
  const site = useQuery(api.sites.get, { domain });
  const tracking = site != null && site.trackingStartedAt !== null;
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

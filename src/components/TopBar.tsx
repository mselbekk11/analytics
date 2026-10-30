"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Authenticated, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNow } from "@/components/dashboard/useNow";
import LogoMark from "@/components/LogoMark";
import SiteSwitcher from "@/components/SiteSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import { formatNumber } from "@/lib/format";

export type SiteSection = "analytics" | "live" | "customers" | "settings";

const TABS: { section: SiteSection; label: string }[] = [
  { section: "analytics", label: "Analytics" },
  { section: "live", label: "Live" },
  { section: "customers", label: "Customers" },
  { section: "settings", label: "Settings" },
];

// Same window and refresh as the Live tab's "online now"
const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const ONLINE_REFRESH_MS = 30 * 1000;

export function sitePath(domain: string, section: SiteSection): string {
  const base = `/sites/${encodeURIComponent(domain)}`;
  return section === "analytics" ? base : `${base}/${section}`;
}

/**
 * The sticky bar on every signed-in page: logo, site switcher, online count, theme and
 * account, and on a site's pages the section tabs. Without `site` (the websites list)
 * the switcher has no current site and there are no tabs. The current tab is a link
 * too, so a visitor profile (under Customers) can go back.
 */
export default function TopBar({ site }: { site?: { domain: string; section: SiteSection } }) {
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
            <span aria-hidden className="px-1 text-muted-foreground/50">
              /
            </span>
            <Authenticated>
              <SiteSwitcher current={site?.domain ?? null} section={site?.section ?? "analytics"} />
            </Authenticated>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {site && (
              <Authenticated>
                <OnlineNow domain={site.domain} />
              </Authenticated>
            )}
            <ThemeToggle />
            <span className="flex size-8 items-center justify-center">
              <UserButton />
            </span>
          </div>
        </div>
        {site && (
          <nav className="-mb-px flex gap-6 overflow-x-auto text-sm [scrollbar-width:none]">
            {TABS.map((t) => (
              <Link
                key={t.section}
                href={sitePath(site.domain, t.section)}
                aria-current={t.section === site.section ? "page" : undefined}
                className={
                  t.section === site.section
                    ? "shrink-0 border-b-2 border-foreground pt-1 pb-3 text-foreground"
                    : "shrink-0 border-b-2 border-transparent pt-1 pb-3 text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {t.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
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

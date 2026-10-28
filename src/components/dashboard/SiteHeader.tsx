"use client";

import Link from "next/link";
import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { Authenticated } from "convex/react";
import { FiActivity, FiSettings, FiUsers } from "react-icons/fi";
import SiteSwitcher from "./SiteSwitcher";

export type SiteSection = "visitors" | "customers" | "settings";

const TABS: { section: SiteSection; label: string; icon: React.ReactNode }[] = [
  { section: "visitors", label: "Visitors", icon: <FiActivity aria-hidden /> },
  { section: "customers", label: "Customers", icon: <FiUsers aria-hidden /> },
  { section: "settings", label: "Settings", icon: <FiSettings aria-hidden /> },
];

export function sitePath(domain: string, section: SiteSection): string {
  const base = `/sites/${encodeURIComponent(domain)}`;
  return section === "visitors" ? base : `${base}/${section}`;
}

/**
 * Header band for a site's pages: favicon, domain switcher, account and section tabs.
 * The current tab is a link too, so a visitor profile (under Customers) can go back.
 */
export default function SiteHeader({ domain, section }: { domain: string; section: SiteSection }) {
  return (
    <header className="border-b border-line bg-panel/40">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-8 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Favicon key={domain} domain={domain} />
            <Authenticated>
              <SiteSwitcher current={domain} section={section} />
            </Authenticated>
          </div>
          <UserButton />
        </div>
        <nav className="flex gap-8 text-sm">
          {TABS.map((t) => (
            <Link
              key={t.section}
              href={sitePath(domain, t.section)}
              aria-current={t.section === section ? "page" : undefined}
              className={
                t.section === section
                  ? "flex items-center gap-2 border-b-2 border-strong pb-3 text-strong"
                  : "flex items-center gap-2 pb-3 text-muted hover:text-strong"
              }
            >
              {t.icon} {t.label}
            </Link>
          ))}
          <Link href="/websites" className="pb-3 text-muted hover:text-strong">
            All sites
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** The site's own favicon in a white tile, as SA shows it; a letter if there is none. */
function Favicon({ domain }: { domain: string }) {
  const [failed, setFailed] = useState(domain === "localhost");
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white text-lg font-medium text-zinc-700">
      {failed ? (
        domain[0]?.toUpperCase()
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- external favicon, any size
        <img
          src={`https://${domain}/favicon.ico`}
          alt=""
          className="size-6"
          onError={() => setFailed(true)}
          // The server-rendered <img> can fail before React hydrates and misses onError
          ref={(img) => {
            if (img?.complete && img.naturalWidth === 0) setFailed(true);
          }}
        />
      )}
    </span>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { FiChevronDown } from "react-icons/fi";
import { api } from "../../../convex/_generated/api";
import { sitePath, type SiteSection } from "./SiteHeader";

/**
 * The large domain in the header, SA-style, with a chevron. A transparent native
 * <select> sits on top so switching works with mouse, keyboard and screen readers.
 * Stays on the same section and keeps the current `?range=` when switching.
 */
export default function SiteSwitcher({
  current,
  section,
}: {
  current: string;
  section: SiteSection;
}) {
  const sites = useQuery(api.sites.list);
  const router = useRouter();
  const searchParams = useSearchParams();
  const canSwitch = sites !== undefined && sites.length > 1;

  return (
    <div className="relative flex min-w-0 items-center gap-2">
      <span className="truncate text-3xl text-strong sm:text-4xl">{current}</span>
      {canSwitch && (
        <>
          <FiChevronDown className="shrink-0 text-2xl text-accent" aria-hidden />
          <select
            value={current}
            onChange={(e) => {
              const qs = searchParams.toString();
              router.push(`${sitePath(e.target.value, section)}${qs ? `?${qs}` : ""}`);
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Switch site"
          >
            {!sites.some((s) => s.domain === current) && <option value={current}>{current}</option>}
            {sites.map((s) => (
              <option key={s.domain} value={s.domain}>
                {s.domain}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}

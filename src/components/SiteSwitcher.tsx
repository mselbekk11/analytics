"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { CheckIcon, ChevronsUpDownIcon, LayoutGridIcon, PlusIcon } from "lucide-react";
import { api } from "../../convex/_generated/api";
import SiteFavicon from "@/components/SiteFavicon";
import { sitePath, type SiteSection } from "@/components/TopBar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Favicon, domain and chevron; opens "Switch site", "All sites" and "Add site".
 * Switching stays on the same section and keeps `?range=` (filters belong to one site).
 */
export default function SiteSwitcher({ current, section }: { current: string; section: SiteSection }) {
  const sites = useQuery(api.sites.list);
  const router = useRouter();
  const searchParams = useSearchParams();

  function open(domain: string) {
    const range = searchParams.get("range");
    router.push(`${sitePath(domain, section)}${range ? `?range=${encodeURIComponent(range)}` : ""}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:bg-accent">
        <SiteFavicon key={current} domain={current} />
        <span className="truncate">{current}</span>
        <ChevronsUpDownIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {sites !== undefined && sites.length > 0 && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Switch site</DropdownMenuLabel>
              {sites.map((s) => (
                <DropdownMenuItem key={s.domain} onClick={() => open(s.domain)} className="gap-2 py-1.5">
                  <SiteFavicon domain={s.domain} />
                  <span className="truncate">{s.domain}</span>
                  {s.domain === current && <CheckIcon aria-label="Current site" className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push("/websites")} className="gap-2 py-1.5">
            <LayoutGridIcon aria-hidden className="text-muted-foreground" />
            All sites
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/websites/new")} className="gap-2 py-1.5">
            <PlusIcon aria-hidden className="text-muted-foreground" />
            Add site
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

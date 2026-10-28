"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { Area, AreaChart, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import SiteFavicon from "@/components/SiteFavicon";
import { formatNumber } from "@/lib/format";
import { sitePath } from "@/components/TopBar";

type Day = { date: string; pageviews: number; visitors: number };

// The dashboard chart's monochrome series: Visitors in the foreground, Pageviews grey
const config = {
  visitors: { label: "Visitors", color: "var(--chart-1)" },
  pageviews: { label: "Pageviews", color: "var(--chart-2)" },
} satisfies ChartConfig;

/**
 * One site on /websites: the favicon and domain, the 30-day pageview total and a
 * sparkline of visitors and pageviews. The whole card opens the dashboard; the gear
 * opens settings (a separate link layered above the card's, since links cannot nest).
 */
export default function SiteCard({
  domain,
  pageviews,
  days,
}: {
  domain: string;
  pageviews: number;
  days: Day[];
}) {
  // Gradient ids are page-wide, so each card needs its own
  const id = domain.replace(/[^a-z0-9]/gi, "-");
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-background transition-colors hover:border-ring">
      <div className="flex items-center gap-2 px-5 pt-5">
        <SiteFavicon domain={domain} />
        <Link
          href={sitePath(domain, "analytics")}
          title={domain}
          className="min-w-0 truncate text-sm font-medium outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring/50"
        >
          {domain}
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`${domain} settings`}
          className="relative z-10 -my-1 -mr-1.5 ml-auto text-muted-foreground"
          render={<Link href={sitePath(domain, "settings")} />}
          nativeButton={false}
        >
          <Settings aria-hidden />
        </Button>
      </div>
      <div className="flex flex-col gap-1 px-5 pt-4">
        <span className="text-[1.625rem] leading-8 font-semibold tracking-tight tabular-nums">
          {formatNumber(pageviews)}
        </span>
        <span className="text-sm text-muted-foreground">Pageviews, last 30 days</span>
      </div>
      <div className="h-24 pt-3" aria-hidden>
        <ChartContainer config={config} className="aspect-auto h-full w-full">
          <AreaChart data={days} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`card-visitors-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-visitors)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--color-visitors)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`card-pageviews-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-pageviews)" stopOpacity={0.14} />
                <stop offset="100%" stopColor="var(--color-pageviews)" stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* Keeps a flat line at the bottom for a site with no traffic yet */}
            <YAxis hide domain={[0, (max: number) => Math.max(max * 1.1, 1)]} />
            {(["pageviews", "visitors"] as const).map((k) => (
              <Area
                key={k}
                type="linear"
                dataKey={k}
                stroke={`var(--color-${k})`}
                strokeWidth={1.5}
                fill={`url(#card-${k}-${id})`}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  );
}
